# SPEC.md — To-Do App

Single source of truth. If code and this document disagree, one of them is a bug.
Update this file in the same commit that changes behaviour.

---

## 1. Scope

A personal to-do app. Tasks, one level of subtasks, folders, reminders, folder
sharing. Offline-first, synced, free infrastructure.

**Explicitly out of scope (v1):** notes, rich text, folder nesting, subtask
nesting beyond one level, tags, attachments, comments, task detail screen.

**Targets:** Android (Capacitor), desktop (PWA), Chrome extension (MV3) — one
web codebase, three shells.

---

## 2. Data model

Firestore. Three collections. No `type` discriminator anywhere — every item is
a task.

### `users/{uid}`

```ts
{
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  createdAt: Timestamp
  schemaVersion: number
  prefs: {
    hideCompletedTasks: boolean      // default false
    hideCompletedSubtasks: boolean   // default false
    rememberLastFolder: boolean      // default false
  }
}
```

### `folders/{folderId}`

```ts
{
  id: string
  ownerId: string
  name: string
  icon: IconName                     // semantic key from src/ui/icons.tsx
  color: ColorName                   // Radix scale name, never a hex value
  sortKey: string                    // fractional index
  memberIds: string[]                // includes ownerId
  roles: { [uid: string]: 'owner' | 'editor' }
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `items/{itemId}`

```ts
{
  id: string
  folderId: string | null            // null = default folder
  parentId: string | null            // non-null = subtask
  ownerId: string
  memberIds: string[]                // denormalized from folder
  title: string
  done: boolean
  completedAt: Timestamp | null
  sortKey: string                    // fractional index
  reminder: Reminder | null
  createdAt: Timestamp
  updatedAt: Timestamp
  updatedBy: string
}

type Reminder = {
  fireAt: Timestamp                  // next occurrence
  recurrence:
    | { kind: 'once' }
    | { kind: 'daily' }
    | { kind: 'weekly'; days: number[] }        // 0 = Sunday
    | { kind: 'monthly'; day: number }          // 1–31
    | { kind: 'interval'; n: number; unit: 'day' | 'week' | 'month' }
}
```

### The default folder

The default folder is **`folderId: null`**. It has no document.

It cannot be renamed, deleted, shared, coloured, or given an icon. It shares no
attributes with a real folder, so it is not modelled as one. This makes the
folders-grid query naturally clean and makes "move back to default" a single
field write.

---

## 3. Invariants

Enforce in Zod at the boundary, in Firestore rules on the server, and as unit
tests in Stage 1.

1. `parentId != null` → parent item exists and `parent.parentId == null`
   (one level of nesting, never two)
2. `parentId != null` → `reminder == null` (reminders only on top-level tasks)
3. `folderId == null` → `memberIds == [ownerId]` (the default folder is
   unshareable)
4. `folderId != null` → `memberIds` equals that folder's `memberIds` exactly
5. `memberIds.length > 1` → `reminder == null` (**reminders are private-only**)
6. `sortKey` is unique within the `(folderId, parentId)` pair
7. A subtask always has the same `folderId`, `memberIds`, and `ownerId` as its
   parent
8. Deleting a task deletes its subtasks. Deleting a folder deletes its items.
   Both are client-side batched deletes (≤500 ops) — there are no Cloud Functions.
   Because offline deletes leave orphans on the server, the app must run an
   opportunistic sweep on startup to batch-delete orphaned items, and export
   must explicitly filter them to prevent resurrection.
9. `done == true` → `completedAt != null`

---

## 4. Reminders are private

Invariant 5 has three consequences that must all be implemented:

- **Moving a task into a shared folder strips its reminder.** Warn first:
  *"This task has a reminder. Moving it into a shared folder will remove it."*
- **Sharing a folder strips reminders from every task inside it.** Warn first:
  *"N tasks in this folder have reminders. Sharing will remove them."*
- **"Set reminder" is hidden** in the context menu for any item where
  `memberIds.length > 1`.

Reminders are scheduled device-locally via Capacitor LocalNotifications. They
are rescheduled on app open and on device boot. There is no server-side push.

---

## 5. Moving items between folders

`folderId` and `memberIds` are coupled, so a move is a permission change.

```ts
async function moveItem(itemId: string, targetFolderId: string | null, actorId: string) {
  const item = await getItem(itemId);
  const target = targetFolderId ? await getFolder(targetFolderId) : null;

  // Moving to the default folder is a CLAIM: the mover takes ownership.
  const newOwnerId  = target ? item.ownerId : actorId;
  const newMemberIds = target ? target.memberIds : [actorId];

  const batch = db.batch();
  batch.update(itemRef, {
    folderId:   targetFolderId,
    ownerId:    newOwnerId,
    memberIds:  newMemberIds,
    sortKey:    generateKeyBetween(null, firstKeyIn(targetFolderId, null)),
    reminder:   newMemberIds.length > 1 ? null : item.reminder,
  });

  // Subtasks carry the same folderId / memberIds / ownerId. Their sortKey is
  // scoped by parentId, so it does not need regenerating.
  for (const sub of await subtasksOf(itemId)) {
    batch.update(subRef(sub.id), {
      folderId: targetFolderId, ownerId: newOwnerId, memberIds: newMemberIds,
    });
  }
  await batch.commit();
}
```

### Permission rules for moves

- Owners and editors may both move items **out** of a shared folder.
- Moving out lands the item in **the mover's** default folder, transfers
  ownership to the mover, and removes it from the shared folder for everyone
  else.
- Because that is destructive for other members, confirm when the actor is not
  the sole member: *"This moves the task to your private list and removes it
  for N other people."*
- Moving **into** a shared folder silently grants access to that folder's
  members. Show a one-line notice.

---

## 6. Context

Every screen is fully described by two fields. Creation, search scope, and
available modes are all derived from it — there is no folder picker and no date
picker in the input bar, because the context already answers those questions.

```ts
type Context = { folderId: string | null; parentId: string | null }
```

| Screen                | Context          | Input creates          | Search scope |
|-----------------------|------------------|------------------------|--------------|
| Home                  | `{null, null}`   | task in default folder | global       |
| Home + task selected  | `{null, taskId}` | subtask                | global       |
| Folder view           | `{fid, null}`    | task in that folder    | that folder  |
| Folder + task selected| `{fid, taskId}`  | subtask                | that folder  |

Search scope follows **the screen, not the selection**. Selecting a task never
narrows search to its subtasks.

### Mode matrix

```
modes = parentId != null
  ? ['Subtask', 'Search']
  : ['Create', 'Search', ...(folderId == null ? ['Folder'] : [])]
```

| Screen                 | Modes                      |
|------------------------|----------------------------|
| Home                   | Create · Folder · Search   |
| Home + task selected   | Subtask · Search           |
| Folder view            | Create · Search            |
| Folder + task selected | Subtask · Search           |

Folder creation is unavailable inside a folder (no nesting) and while a task is
selected.

---

## 7. Screens

### Home
Split view. Top pane: default-folder tasks. Bottom pane: folders grid. Very
bottom: the unified input bar, above the keyboard.

### Folder view
Full screen. The folder's tasks. Same input bar, minus the Folder mode.

### Settings
- Theme: light / dark / system
- Show/hide completed tasks *(synced)*
- Show/hide completed subtasks *(synced)*
- Remember last folder — on/off *(synced)*; the folder id itself is **device-local**
- Import / export JSON
- Clear all data (full account wipe)
- Version number from the git tag

The last-folder **value** must never sync. Syncing it would drag one device into
a different folder because of activity on another.

---

## 8. Unified input

One input bar, mode selected by a visible segmented control. No sigils are
required on mobile — `#`, `/`, and `@` all live behind Gboard's `?123` layer, so
requiring them would cost two taps and a layout repaint per use.

- Placeholder text is the mode indicator: *New task… / New folder… / New
  subtask… / Search…*
- **The query is preserved across mode switches.** Typing "groceries" in Create
  and switching to Search must keep the text.
- Search runs silently in every mode. In Create mode, if the text matches
  existing items, show a dismissible row: *"3 matching tasks →"* which jumps to
  Search with the query intact.
- Swipe left/right on the input bar cycles modes.
- Mode resets to Create (or Subtask) whenever the context changes. Never persist
  the last mode.
- **Desktop only:** `#` and `/` remain as accelerators, `Cmd/Ctrl+K` opens,
  `Tab` cycles modes. They are unused on mobile and cost nothing to keep.

Search is a substring filter over the local cache. No search index.

---

## 9. Gestures and context menus

| Gesture          | Task                        | Folder          |
|------------------|-----------------------------|-----------------|
| Tap              | select → subtask mode       | open folder     |
| Tap checkbox     | toggle done                 | —               |
| Tap chevron      | expand/collapse subtasks    | —               |
| Long-press       | context menu                | context menu    |

Desktop: right-click opens the context menu, `Esc` deselects.

There is no task detail screen. Everything a task can do lives in the checkbox,
the subtask input, or the context menu.

**Task menu:** Set reminder *(hidden if shared)* · Move to folder · Rename ·
Duplicate · Delete
**Subtask menu:** Rename · Promote to task · Delete
**Folder menu:** Rename · Icon & colour · Share · Export folder · Delete

*Promote to task* is the only way a subtask escapes its parent.

---

## 10. Queries

```ts
// Home — top pane
items.where('memberIds','array-contains',uid)
     .where('folderId','==',null)
     .where('parentId','==',null)
     .orderBy('sortKey')

// Home — folders grid
folders.where('memberIds','array-contains',uid).orderBy('sortKey')

// Folder view
items.where('folderId','==',fid).where('parentId','==',null).orderBy('sortKey')

// Subtasks — read from the local cache, never a separate query
```

`hideCompleted*` filters client-side. The data is already local; a second index
is not worth it.

---

## 11. Design system

Three layers. Components may only reference the semantic layer.

```css
/* primitives — rarely touched */
--gray-2: …; --blue-9: …;
/* semantic — components use ONLY these */
--surface: var(--gray-2); --text-muted: var(--gray-11); --accent: var(--blue-9);
```

Colours come from Radix Colors (12-step scales, light/dark paired). Fixed
scales, no improvisation:

```css
--radius-sm: 6px;  --radius-md: 10px; --radius-lg: 16px; --radius-full: 999px;
--dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;
--ease: cubic-bezier(0.2, 0, 0, 1);
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px;
```

Tailwind's default radius/duration/colour scales are **deleted** from the config
so the only spellings that exist are these.

Primitives in `src/ui/`: `Button`, `IconButton`, `Input`, `Card`, `ListRow`,
`Sheet`, `Menu`, `Dialog`. All new UI composes these.

Icons go through one indirection layer (`src/ui/icons.tsx`) exporting an
`ICONS` map. Call sites use `<Icon name="folder" />`. Folder icons store the
**semantic key string** in Firestore, never a component reference, so the icon
set can be swapped without migrating data. Curate ~40 icons for the picker; do
not ship all of Lucide.

---

## 12. Infrastructure

Firebase **Spark plan only**. Verified constraints:

- Firestore: 1 GiB, 50k reads/day, 20k writes/day, 20k deletes/day
- Auth (Google provider): free well past this scale
- **Cloud Functions cannot be deployed on Spark.** Never introduce one.
- **Cloud Storage is unavailable on Spark** since 3 Feb 2026. Never introduce one.
- Spark cannot generate a bill; it stops serving at quota.

Hosting: Cloudflare Pages or Netlify free tier.
Android distribution: GitHub Releases + Obtainium (avoids the Play fee).
Extension: load unpacked during development (Chrome Web Store is a one-time $5).

**Clear all data** must therefore delete client-side in paginated batches of
500, then re-authenticate, then delete the auth user. Folders the user owns but
has shared must prompt for transfer-or-delete rather than being orphaned.

---

## 13. Stages

Ten stages. No stage begins until the previous one's exit tests pass.

**Universal gate, every stage:** exit tests pass · runs on the real entry-level
Android device · bundle within budget · zero lint violations · this file updated.

### Stage 0 — Three targets, zero features
Vite + React + TS. `tokens.css`, `icons.tsx`, Tailwind config with defaults
deleted, the 8 primitives, ESLint rules. Capacitor Android + PWA + MV3
extension, all from the same `src/`. Screen content: one button, one icon.

**Exit:** APK sideloads and opens on the real phone · extension loads unpacked
in the side panel · PWA installs on desktop · `rounded-[13px]` fails CI ·
changing one semantic token restyles all three targets.

### Stage 1 — Data layer against the emulator
Firebase Emulator Suite locally. Zod schemas. CRUD, fractional indexing, offline
persistence. JSON export/import. Debug screen only, no real UI.

**Exit:** fractional index unit tests (between neighbours, at both ends, 500
sequential same-position inserts without collision) · export → wipe → import →
byte-identical re-export · Zod rejects a subtask of a subtask · kill the
emulator mid-session and reads still serve from cache.

*Do not proceed if index generation is flaky. Everything sits on it.*

### Stage 2 — Core UI
Home split view, folder view, tasks, one level of subtasks. Composed only from
Stage 0 primitives. Touch targets ≥44px.

**Exit:** create/rename/complete/delete by hand on the phone · 200-item list at
60fps under Chrome tracing over USB · every new component imports from `src/ui/`.

### Stage 3 — Auth and the real project
Real Firebase project on Spark. Google sign-in on all three targets — three
distinct integrations (`chrome.identity` for the extension, native Google
Sign-In for Capacitor, web popup for PWA). Deploy Firestore rules.

**Exit:** rules unit tests via `@firebase/rules-unit-testing` — non-member read
denied, non-member write denied, member write allowed, client cannot modify its
own `memberIds` · signed in on all three targets showing the same data · sign
out clears the local IndexedDB cache.

*Do not proceed without the rules test suite.*

### Stage 4 — Sync and offline hardening
No new features. Break it deliberately, on two real devices.

**Exit:** same task edited on both while offline → one wins cleanly, no
duplicate · tasks created offline on both → both appear, both keep position ·
delete on A while B edits offline → deterministic, no zombie · airplane mode
24h, 50 edits, reconnect → all 50 land · cold start offline renders in <2s.

Write down what "wins" means for each case and make it deliberate.

### Stage 5 — Unified input
Segmented control, mode matrix from §6, preserved query, cross-mode match hint,
swipe to cycle. Desktop accelerators.

**Exit:** query survives all mode transitions · mode switch is one tap · titles
containing literal `#`, `/`, `@` save correctly on mobile · keystroke-to-render
under 16ms with 500 items cached on the entry-level device · search works
offline · **creating a task never requires the `?123` keyboard layer**.

### Stage 6 — Reminders
Recurrence model, `fireAt`, Capacitor LocalNotifications, reschedule on open and
on boot. Enforce invariant 5 everywhere.

**Exit:** monthly-on-31st → February · weekly across a DST transition, both
directions · recurring reminder while the device was off for two days ·
timezone change mid-recurrence · **on real hardware:** fires after reboot, fires
with the app force-closed, survives Doze overnight · reminder stripped and
warned on move-into-shared and on folder-share.

*Many entry-level Android skins kill background alarms aggressively. Expect to
need a battery-optimization exemption prompt.*

### Stage 7 — Drag & drop, icons, colours
`dnd-kit`. Curated icon picker storing semantic keys. Folder colours from the
Radix scale.

**Exit:** reorder works with a finger · **a drop writes exactly one document**
(watch the emulator log — N writes means the sort keys are wrong) · 60fps
during drag · edge autoscroll works · icon and colour survive an export/import
round-trip.

### Stage 8 — Collaboration
Highest risk, last, on top of a system already proven to sync. Invite by email,
`memberIds` denormalized down to items in a batched write, revoke, move-out
claim semantics from §5.

**Exit:** share → collaborator sees it within seconds · revoke → their cache
drops it and further writes are rejected · collaborator reorders while owner
reorders offline → no corruption · batched `memberIds` write across 500 items
completes without partial state · rules test: editor cannot delete the folder or
change roles · move-out transfers ownership and removes it for everyone else.

### Stage 9 — Performance and ship
Lazy-load the Firestore SDK: render from the IndexedDB cache first, dynamic-import
the SDK after first paint. This is worth more than every other perf change
combined. Then flip the Preact alias:

```ts
resolve: { alias: { react: 'preact/compat', 'react-dom': 'preact/compat' } }
```

Two lines, fully reversible, source stays React. Run the full suite; if
`dnd-kit` or anything else breaks, revert and move on.

**Exit:** initial JS under 200 KB gzipped · cold start to interactive under 2.5s
on the entry-level phone · full suite green with Preact aliased, or the alias
reverted without regret.
