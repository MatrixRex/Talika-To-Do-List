# Folder Share Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable folder sharing via direct URLs (`#join=<folderId>`) that prompt recipients to join as an editor, synchronizing permissions and items while strictly preserving Spark constraints and Invariant 5 (stripping reminders on shared tasks).

**Architecture:** A client-side hash router parses `#join=<folderId>` without server dependencies (compatible with GitHub Pages, PWA, and Capacitor). Firestore security rules permit authenticated `get` for folder previews and validated self-joining (`isSelfJoin()`), while `joinFolder` updates folder members and denormalizes `memberIds` across all folder items in client batches (≤500 ops).

**Tech Stack:** React 19, TypeScript, Firebase Firestore & Auth, Lucide Icons (via `src/ui/icons.tsx`), Vitest, `@firebase/rules-unit-testing`.

---

### Task 1: Share Link Helper & Unit Tests

**Files:**
- Create: `src/lib/share-links.ts`
- Create: `src/lib/share-links.test.ts`

- [ ] **Step 1: Write unit tests for share link generator and join helper logic**

Create `src/lib/share-links.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFolderShareLink, parseJoinFolderId } from './share-links';

describe('Share Link Helpers', () => {
  it('builds share link correctly from window location', () => {
    const link = buildFolderShareLink('folder-123', 'https://matrixrex.github.io/Talika-To-Do-List/');
    expect(link).toBe('https://matrixrex.github.io/Talika-To-Do-List/#join=folder-123');
  });

  it('parses folderId from hash string', () => {
    expect(parseJoinFolderId('#join=folder-abc')).toBe('folder-abc');
    expect(parseJoinFolderId('#join=f7b1897e-1234-4567')).toBe('f7b1897e-1234-4567');
    expect(parseJoinFolderId('#folder-abc')).toBeNull();
    expect(parseJoinFolderId('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/share-links.test.ts`
Expected: FAIL with module `share-links` not found.

- [ ] **Step 3: Implement `src/lib/share-links.ts`**

```ts
/**
 * Constructs a full shareable folder join link using the current window location.
 */
export function buildFolderShareLink(folderId: string, customBaseUrl?: string): string {
  if (customBaseUrl) {
    const base = customBaseUrl.endsWith('/') ? customBaseUrl : `${customBaseUrl}/`;
    return `${base}#join=${folderId}`;
  }
  if (typeof window === 'undefined') return `#join=${folderId}`;
  const origin = window.location.origin;
  const pathname = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `${origin}${pathname}#join=${folderId}`;
}

/**
 * Extracts the folder ID from a hash string like `#join=<folderId>`.
 */
export function parseJoinFolderId(hash: string): string | null {
  if (!hash) return null;
  const match = hash.match(/^#join=([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/share-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share-links.ts src/lib/share-links.test.ts
git commit -m "feat(share): add share link builder and parser utilities with tests"
```

---

### Task 2: Firestore Security Rules for Folder Previews and Self-Join

**Files:**
- Modify: `firestore.rules`
- Modify: `src/lib/stage8.test.ts`

- [ ] **Step 1: Write test cases for self-joining via link in `stage8.test.ts`**

Add tests to `src/lib/stage8.test.ts`:
```ts
describe('Share Links & Self-Join Security Rules', () => {
  it('allows authenticated non-member to get folder metadata by ID', async () => {
    // Charlie is not a member of Alice's folder
    const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
    const folderDoc = await getDoc(doc(charlieDb, 'folders', sharedFolderId));
    expect(folderDoc.exists()).toBe(true);
    expect(folderDoc.data()?.name).toBe('Design System');
  });

  it('allows authenticated non-member to self-join as editor', async () => {
    const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
    await assertSucceeds(
      updateDoc(doc(charlieDb, 'folders', sharedFolderId), {
        memberIds: [aliceUid, charlieUid],
        roles: { [aliceUid]: 'owner', [charlieUid]: 'editor' },
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('rejects self-joining if user attempts to grant themselves owner role', async () => {
    const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
    await assertFails(
      updateDoc(doc(charlieDb, 'folders', sharedFolderId), {
        memberIds: [aliceUid, charlieUid],
        roles: { [aliceUid]: 'owner', [charlieUid]: 'owner' },
        updatedAt: serverTimestamp(),
      })
    );
  });
});
```

- [ ] **Step 2: Update `firestore.rules` to permit `get` and validated `isSelfJoin` updates**

Update `firestore.rules`:
```rules
    match /folders/{folderId} {
      allow get: if isSignedIn();
      allow list: if isMember(resource.data.memberIds);
      
      allow create: if isMember(request.resource.data.memberIds) 
                    && isOwner(request.resource.data.ownerId);
                    
      function isSelfJoin() {
        return isSignedIn()
          && request.auth.uid in request.resource.data.memberIds
          && !(request.auth.uid in resource.data.memberIds)
          && request.resource.data.ownerId == resource.data.ownerId
          && request.resource.data.name == resource.data.name
          && request.resource.data.icon == resource.data.icon
          && request.resource.data.color == resource.data.color
          && request.resource.data.sortKey == resource.data.sortKey
          && request.resource.data.roles[request.auth.uid] == 'editor';
      }

      allow update: if (
                      isMember(resource.data.memberIds)
                      && isMember(request.resource.data.memberIds)
                      && (
                        (resource.data.roles[request.auth.uid] == 'owner') 
                        || 
                        (
                          request.resource.data.roles == resource.data.roles &&
                          request.resource.data.memberIds == resource.data.memberIds &&
                          request.resource.data.ownerId == resource.data.ownerId
                        )
                      )
                    )
                    || isSelfJoin();
                    
      allow delete: if isMember(resource.data.memberIds) 
                    && resource.data.roles[request.auth.uid] == 'owner';
    }
```

- [ ] **Step 3: Run security rules tests to verify**

Run: `pnpm vitest run src/lib/stage8.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules src/lib/stage8.test.ts
git commit -m "feat(security): update firestore rules for folder preview and self-join"
```

---

### Task 3: Data Layer Functions (`getFolderPreview` and `joinFolder`)

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/stage8.test.ts`

- [ ] **Step 1: Write tests for `getFolderPreview` and `joinFolder` in `stage8.test.ts`**

Add tests covering:
1. `getFolderPreview(folderId)` returns folder and owner user info.
2. `joinFolder(folderId, uid)` adds `uid` to folder `memberIds` & `roles` as `editor`.
3. `joinFolder` denormalizes `uid` to all items and subtasks in that folder.
4. `joinFolder` strips reminders if folder was private with reminders (Invariant 5).

- [ ] **Step 2: Implement `getFolderPreview` and `joinFolder` in `src/lib/db.ts`**

In `src/lib/db.ts`:
```ts
export async function getFolderPreview(
  folderId: string
): Promise<{ folder: Folder; owner: User | null } | null> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) return null;

  const folder = folderSnap.data() as Folder;
  let owner: User | null = null;
  try {
    const ownerSnap = await getDoc(doc(db, 'users', folder.ownerId));
    if (ownerSnap.exists()) {
      owner = ownerSnap.data() as User;
    }
  } catch (err) {
    console.warn('Failed to fetch folder owner profile:', err);
  }

  return { folder, owner };
}

export async function joinFolder(
  folderId: string,
  actorId: string
): Promise<{ strippedCount: number }> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) throw new Error('Folder not found');

  const folder = folderSnap.data() as Folder;
  if (folder.memberIds.includes(actorId)) {
    return { strippedCount: 0 };
  }

  const newMemberIds = [...folder.memberIds, actorId];
  const newRoles = {
    ...folder.roles,
    [actorId]: 'editor' as const,
  };

  const isBecomingShared = folder.memberIds.length === 1;
  const now = Timestamp.now();

  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('folderId', '==', folderId));
  const snap = await getDocs(q);

  let strippedCount = 0;
  let currentBatch = writeBatch(db);
  let opCount = 0;

  currentBatch.update(folderRef, {
    memberIds: newMemberIds,
    roles: newRoles,
    updatedAt: now,
  });
  opCount++;

  for (const itemDoc of snap.docs) {
    const itemData = itemDoc.data() as Item;
    const updates: Partial<Item> = {
      memberIds: newMemberIds,
      updatedAt: now,
      updatedBy: actorId,
    };

    if (isBecomingShared && itemData.reminder !== null) {
      updates.reminder = null;
      strippedCount++;
    }

    currentBatch.update(itemDoc.ref, updates);
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
  }

  return { strippedCount };
}
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm vitest run src/lib/stage8.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/stage8.test.ts
git commit -m "feat(db): implement getFolderPreview and joinFolder with batched item updates"
```

---

### Task 4: Share Link UI in `ShareFolderDialog.tsx`

**Files:**
- Modify: `src/lib/ShareFolderDialog.tsx` or `src/components/ShareFolderDialog.tsx`

- [ ] **Step 1: Update `ShareFolderDialog.tsx` to include "Share Link" action**

In `src/components/ShareFolderDialog.tsx`:
- Import `buildFolderShareLink` from `../lib/share-links`.
- Add a Share Link section above the invite email input:
  - Readonly input / display box showing the link.
  - "Copy Link" / "Share" button with `<Icon name="copy" />` or `<Icon name="share" />`.
  - Supports `navigator.share` on mobile when available, falling back to `navigator.clipboard.writeText`.
  - Displays a temporary *"Link copied to clipboard!"* feedback message.

- [ ] **Step 2: Run linter and tests**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareFolderDialog.tsx
git commit -m "feat(ui): add share link copying to ShareFolderDialog"
```

---

### Task 5: `JoinFolderDialog.tsx` Component

**Files:**
- Create: `src/components/JoinFolderDialog.tsx`

- [ ] **Step 1: Implement `JoinFolderDialog` component using `src/ui/` primitives**

Create `src/components/JoinFolderDialog.tsx`:
```tsx
import { useState } from 'react';
import type { Folder, User } from '../lib/schema';
import { Dialog, Button, Icon, type IconName, getFolderColorStyle } from '../ui';

interface JoinFolderDialogProps {
  isOpen: boolean;
  folder: Folder | null;
  owner: User | null;
  onJoin: () => Promise<void>;
  onClose: () => void;
}

export function JoinFolderDialog({
  isOpen,
  folder,
  owner,
  onJoin,
  onClose,
}: JoinFolderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!folder) return null;

  const colorStyle = getFolderColorStyle(folder.color);
  const iconName = (folder.icon as IconName) || 'folder';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onJoin();
    } catch (err: unknown) {
      console.error('Failed to join folder:', err);
      setError((err as Error).message || 'Failed to join folder.');
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={loading ? () => {} : onClose}>
      <div className="flex flex-col gap-4">
        {/* Header with folder icon & name */}
        <div className="flex items-center gap-3 border-b border-surface-border pb-3">
          <div
            className="p-3 rounded-md flex items-center justify-center shrink-0"
            style={colorStyle.style}
          >
            <Icon name={iconName} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-text truncate">
              Join &ldquo;{folder.name}&rdquo;
            </h3>
            <p className="text-xs text-text-muted">
              You were invited to collaborate on this folder
            </p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-danger bg-danger/10 p-2.5 rounded-md border border-danger/20">
            {error}
          </div>
        )}

        {/* Owner Info & Details */}
        <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-md">
          <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
            {owner?.displayName?.charAt(0).toUpperCase() || owner?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-text-muted">Folder owner</span>
            <span className="text-sm font-semibold text-text truncate">
              {owner?.displayName || owner?.email || 'Talika User'}
            </span>
            {owner?.displayName && owner?.email && (
              <span className="text-xs text-text-muted truncate">{owner.email}</span>
            )}
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Joining this folder will give you access to view, add, and manage tasks within it.
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-border mt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Decline
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Joining…' : 'Join Folder'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run linter**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/JoinFolderDialog.tsx
git commit -m "feat(ui): create JoinFolderDialog modal component"
```

---

### Task 6: Hash Routing & App Integration in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Integrate join hash handling in `App.tsx`**

1. Listen to `window.location.hash` changes and initial load.
2. If `#join=<folderId>` is detected:
   - Extract `folderId` with `parseJoinFolderId`.
   - If user is authenticated:
     - Check if `folders.some(f => f.id === targetFolderId)`:
       - If already member: clear hash to `#folder-${targetFolderId}` and set `activeFolderId = targetFolderId`.
       - If not member: call `getFolderPreview(targetFolderId)`.
       - If folder exists, set state `{ previewFolder, previewOwner }` to open `JoinFolderDialog`.
       - If folder does not exist, display toast/alert and reset hash.
   - If user is unauthenticated:
     - Retain the hash in the browser URL so after Google sign-in it triggers automatically.
3. Wire `onJoin` handler:
   - Call `joinFolder(targetFolderId, firebaseUser.uid)`.
   - Set `activeFolderId = targetFolderId`.
   - Update hash to `#folder-${targetFolderId}`.
   - Close `JoinFolderDialog`.
4. Wire `onClose` / decline handler:
   - Clear hash to `''`.
   - Close dialog.

- [ ] **Step 2: Run build and lint to ensure clean integration**

Run: `pnpm build && pnpm lint`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): integrate folder share link detection and join flow in App.tsx"
```

---

### Task 7: Full Verification, Documentation & Stage Check

**Files:**
- Modify: `SPEC.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test:ci`
Expected: All tests pass.

- [ ] **Step 2: Update `SPEC.md`, `CHANGELOG.md`, and `README.md`**

Document the folder share link capability in `SPEC.md` (under Stage 8), `CHANGELOG.md`, and `README.md`.

- [ ] **Step 3: Commit**

```bash
git add SPEC.md CHANGELOG.md README.md
git commit -m "docs: update spec, changelog and readme for folder share links"
```
