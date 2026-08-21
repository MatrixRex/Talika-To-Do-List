# Folder Share Links Design Specification

**Date:** 2026-08-21  
**Status:** Approved  
**Topic:** Direct Folder Share Links & Join Flow  
**Targets:** Web / GitHub Pages, PWA, Android Capacitor, MV3 Chrome Extension  

---

## 1. Overview & Objective

Enable users to share folders using direct shareable URLs. When a recipient opens the link:
1. The app loads (works seamlessly on GitHub Pages subpaths, custom domains, and PWAs).
2. If the user is unauthenticated, they are prompted to sign in with Google while preserving the pending join intent.
3. Once authenticated:
   - If the user is already a member, they are taken directly to the folder.
   - If the user is not yet a member, a **"Join Folder"** preview dialog is displayed (showing folder name, icon, color, owner details, and member count).
4. Upon clicking **"Join Folder"**, the user is added to `folder.memberIds` with the `editor` role, and all tasks in that folder have their `memberIds` updated via batched writes (≤500 ops).
5. If the folder previously contained private reminders and was single-user, reminders are stripped in accordance with **Invariant 5** (`memberIds.length > 1 → reminder == null`).
6. The joined folder is immediately opened in the app.

---

## 2. URL Schema & Routing

### 2.1 Link Structure
```
${window.location.origin}${window.location.pathname}#join=${folderId}
```
Example on GitHub Pages:
`https://matrixrex.github.io/Talika-To-Do-List/#join=f7b1897e-1234-4567-89ab-cdef01234567`

### 2.2 Why Hash-Based Routing
- **GitHub Pages compatibility:** GitHub Pages serves static files and returns 404 for unconfigured path-based routes like `/join/:id`. Hash fragments (`#join=...`) are parsed purely client-side and never trigger server 404s.
- **Cross-platform consistency:** Identical behavior across Desktop web, GitHub Pages, PWA, Android Capacitor WebView, and MV3 Extension.

### 2.3 Hash State Lifecycle
- **On App Load / HashChange:** `App.tsx` inspects `window.location.hash` matching `#join=([a-zA-Z0-9_-]+)`.
- **Unauthenticated State:** The hash is retained while displaying `LoginView`.
- **Authenticated State:**
  - Check if `activeFolders.some(f => f.id === joinFolderId)`:
    - If true: Clear `#join` and set `activeFolderId = joinFolderId`, updating hash to `#folder-${joinFolderId}`.
    - If false: Fetch folder doc from Firestore (`getDoc(doc(db, 'folders', joinFolderId))`) and open `JoinFolderDialog`.
  - On Dialog Cancel / Decline: Clear hash to `''` or `#`.
  - On Successful Join: Clear hash to `#folder-${joinFolderId}` and set `activeFolderId = joinFolderId`.

---

## 3. Data Layer & Security Rules

### 3.1 Data Flow (`src/lib/db.ts`)

#### Function `getFolderPreview(folderId: string): Promise<{ folder: Folder; owner: User | null } | null>`
- Fetches folder document by ID using `getDoc(doc(db, 'folders', folderId))`.
- If exists, fetches owner user profile with `getDoc(doc(db, 'users', folder.ownerId))`.
- Returns folder and owner details for preview.

#### Function `joinFolder(folderId: string, actorId: string): Promise<{ strippedCount: number }>`
- Validates that `folderId` exists.
- Calculates `newMemberIds = [...folder.memberIds, actorId]`.
- Sets `roles[actorId] = 'editor'`.
- Fetches all items belonging to `folderId`.
- In client-side batched writes (≤500 ops per batch):
  1. Updates `folders/{folderId}` with `memberIds: newMemberIds` and `roles`.
  2. Updates every item in the folder with `memberIds: newMemberIds`, `updatedAt`, `updatedBy: actorId`.
  3. If `folder.memberIds.length === 1` (transitioning to shared), strips reminders (`reminder: null`) and counts stripped reminders.
- Returns `{ strippedCount }`.

### 3.2 Firestore Security Rules (`firestore.rules`)

#### `match /folders/{folderId}`
- `allow get: if isSignedIn();` (Allows reading specific folder metadata for join previews).
- `allow list: if isMember(resource.data.memberIds);` (Prevents listing/searching unauthorized folders).
- Update rule permits:
  1. Existing member updates (owner permissions / editor updates).
  2. **Self-join update (`isSelfJoin`)**:
     - `request.auth.uid` is being appended to `memberIds`.
     - `request.resource.data.roles[request.auth.uid] == 'editor'`.
     - `ownerId`, `name`, `icon`, `color`, `sortKey`, and existing `memberIds`/`roles` are unmodified.

#### `match /items/{itemId}`
- Update rule permits:
  1. Item members (`isMember(resource.data.memberIds)`).
  2. Members of the item's folder (`request.auth.uid in get(/databases/$(database)/documents/folders/$(resource.data.folderId)).data.memberIds`).

---

## 4. UI Components

### 4.1 `ShareFolderDialog.tsx`
- Adds a prominent **"Copy Share Link"** / **"Share"** section.
- Supports `navigator.share` on mobile devices with fallback to `navigator.clipboard.writeText`.
- Displays temporary "Link copied to clipboard!" confirmation toast / pill.

### 4.2 `JoinFolderDialog.tsx`
- Modal dialog using `src/ui/` primitives (`Dialog`, `Button`, `Icon`, `getFolderColorStyle`).
- Displays:
  - Folder icon with corresponding Radix semantic color style.
  - Folder name.
  - Owner avatar/initials, display name, and email.
  - Current member count.
  - **"Decline" / "Cancel"** and **"Join Folder"** buttons with loading spinner during joining.

---

## 5. Testing & Verification

1. **Unit & Invariant Tests (`src/lib/stage8.test.ts` or `src/lib/share-links.test.ts`)**:
   - Verify link generation with various base URLs.
   - Verify `joinFolder` adds user as `editor` in `memberIds` and `roles`.
   - Verify `joinFolder` updates all items and subtasks in the folder with new `memberIds`.
   - Verify Invariant 5: reminders stripped when single-user folder is joined via link.
   - Verify duplicate join attempt is a no-op or handled gracefully.
2. **Security Rules Tests (`src/lib/rules.test.ts`)**:
   - Verify unauthenticated user cannot read folder preview.
   - Verify authenticated user can `get` folder preview.
   - Verify authenticated user can self-join as `editor`.
   - Verify self-joining user cannot elevate role to `owner` or alter folder name/color/ownerId.
3. **Manual / E2E Verification**:
   - Generate link from User A.
   - Open link in incognito / User B.
   - Verify login preservation, preview modal, acceptance, and immediate navigation to folder.
