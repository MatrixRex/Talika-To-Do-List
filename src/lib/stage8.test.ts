import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { calculateReorderKey } from './reorder';
import { compareSortKeys, generateKeyBetween } from './sort-keys';
import type { Folder, Item, User } from './schema';

const PROJECT_ID = 'demo-todo-stage8-test';

describe('Stage 8 Exit Suite — Collaboration & Move-Out Semantics', () => {
  let testEnv: RulesTestEnvironment;
  const aliceUid = 'alice-8';
  const bobUid = 'bob-8';
  const charlieUid = 'charlie-8';

  beforeAll(async () => {
    try {
      const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules,
          host: '127.0.0.1',
          port: 8080,
        },
      });
    } catch {
      console.warn('Firestore emulator not reachable at 127.0.0.1:8080.');
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async (ctx) => {
    if (!testEnv) {
      ctx.skip();
      return;
    }
    await testEnv.clearFirestore();

    // Seed test users
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const db = adminContext.firestore();
      await setDoc(doc(db, 'users', aliceUid), {
        uid: aliceUid,
        email: 'alice@example.com',
        displayName: 'Alice Builder',
        photoURL: null,
        schemaVersion: 1,
        createdAt: serverTimestamp(),
        prefs: {
          hideCompletedTasks: false,
          hideCompletedSubtasks: false,
          rememberLastFolder: false,
        },
      });
      await setDoc(doc(db, 'users', bobUid), {
        uid: bobUid,
        email: 'bob@example.com',
        displayName: 'Bob Designer',
        photoURL: null,
        schemaVersion: 1,
        createdAt: serverTimestamp(),
        prefs: {
          hideCompletedTasks: false,
          hideCompletedSubtasks: false,
          rememberLastFolder: false,
        },
      });
    });
  });

  describe('User Lookup by Email & Profiles', () => {
    it('allows an authenticated user to query another user profile by email', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const usersRef = collection(aliceDb, 'users');
      const q = query(usersRef, where('email', '==', 'bob@example.com'));
      const snap = await getDocs(q);

      expect(snap.empty).toBe(false);
      const bobProfile = snap.docs[0].data() as User;
      expect(bobProfile.uid).toBe(bobUid);
      expect(bobProfile.displayName).toBe('Bob Designer');
    });

    it('returns empty result when searching for a non-existent email', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const usersRef = collection(aliceDb, 'users');
      const q = query(usersRef, where('email', '==', 'unknown@example.com'));
      const snap = await getDocs(q);
      expect(snap.empty).toBe(true);
    });

    it('fetches member profiles by ID array', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const snapAlice = await getDoc(doc(aliceDb, 'users', aliceUid));
      const snapBob = await getDoc(doc(aliceDb, 'users', bobUid));

      expect(snapAlice.exists()).toBe(true);
      expect(snapBob.exists()).toBe(true);
      expect((snapBob.data() as User).displayName).toBe('Bob Designer');
    });
  });

  describe('Folder Sharing & Member Denormalization', () => {
    it('shares folder with a collaborator and denormalizes memberIds to all tasks in a batch', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const folderId = 'folder-share-1';

      // 1. Alice creates a private folder
      await setDoc(doc(aliceDb, 'folders', folderId), {
        id: folderId,
        ownerId: aliceUid,
        name: 'Sprint Tasks',
        icon: 'briefcase',
        color: 'blue',
        sortKey: 'a0',
        memberIds: [aliceUid],
        roles: { [aliceUid]: 'owner' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Alice creates items in the folder
      const item1Id = 'item-share-1';
      await setDoc(doc(aliceDb, 'items', item1Id), {
        id: item1Id,
        folderId,
        parentId: null,
        ownerId: aliceUid,
        memberIds: [aliceUid],
        title: 'Task 1',
        done: false,
        completedAt: null,
        sortKey: 'a0',
        reminder: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });

      const sub1Id = 'sub-share-1';
      await setDoc(doc(aliceDb, 'items', sub1Id), {
        id: sub1Id,
        folderId,
        parentId: item1Id,
        ownerId: aliceUid,
        memberIds: [aliceUid],
        title: 'Subtask 1.1',
        done: false,
        completedAt: null,
        sortKey: 's0',
        reminder: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });

      // 3. Alice shares folder with Bob (batched update)
      const batch = writeBatch(aliceDb);
      const newMemberIds = [aliceUid, bobUid];
      const newRoles = { [aliceUid]: 'owner', [bobUid]: 'editor' };

      batch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: newMemberIds,
        roles: newRoles,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(aliceDb, 'items', item1Id), {
        memberIds: newMemberIds,
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });
      batch.update(doc(aliceDb, 'items', sub1Id), {
        memberIds: newMemberIds,
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });

      await assertSucceeds(batch.commit());

      // 4. Bob can now read the shared folder and its tasks
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      const bobFolderSnap = await getDoc(doc(bobDb, 'folders', folderId));
      expect(bobFolderSnap.exists()).toBe(true);
      expect((bobFolderSnap.data() as Folder).memberIds).toEqual([aliceUid, bobUid]);

      const bobItemSnap = await getDoc(doc(bobDb, 'items', item1Id));
      expect(bobItemSnap.exists()).toBe(true);
      expect((bobItemSnap.data() as Item).memberIds).toEqual([aliceUid, bobUid]);

      // 5. Non-member Charlie cannot read items from the shared folder
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      await assertFails(getDoc(doc(charlieDb, 'items', item1Id)));
    });

    it('strips reminders from all tasks in folder upon sharing (§4 invariant)', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const folderId = 'folder-rem-strip';

      await setDoc(doc(aliceDb, 'folders', folderId), {
        id: folderId,
        ownerId: aliceUid,
        name: 'Private List',
        icon: 'folder',
        color: 'green',
        sortKey: 'a0',
        memberIds: [aliceUid],
        roles: { [aliceUid]: 'owner' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const itemId = 'item-with-rem';
      await setDoc(doc(aliceDb, 'items', itemId), {
        id: itemId,
        folderId,
        parentId: null,
        ownerId: aliceUid,
        memberIds: [aliceUid],
        title: 'Task with Reminder',
        done: false,
        completedAt: null,
        sortKey: 'a0',
        reminder: {
          fireAt: serverTimestamp(),
          recurrence: { kind: 'once' },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });

      // Sharing without stripping reminder MUST FAIL in security rules
      const badBatch = writeBatch(aliceDb);
      badBatch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: [aliceUid, bobUid],
        roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
      });
      badBatch.update(doc(aliceDb, 'items', itemId), {
        memberIds: [aliceUid, bobUid],
        // forgot to strip reminder!
      });
      await assertFails(badBatch.commit());

      // Sharing WITH stripped reminder SUCCEEDS
      const goodBatch = writeBatch(aliceDb);
      goodBatch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: [aliceUid, bobUid],
        roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        updatedAt: serverTimestamp(),
      });
      goodBatch.update(doc(aliceDb, 'items', itemId), {
        memberIds: [aliceUid, bobUid],
        reminder: null,
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });
      await assertSucceeds(goodBatch.commit());

      const itemSnap = await getDoc(doc(aliceDb, 'items', itemId));
      expect((itemSnap.data() as Item).reminder).toBeNull();
    });
  });

  describe('Revoking Collaborators & Leaving Folders', () => {
    it('revoking a collaborator removes access immediately from folder and items', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      const folderId = 'folder-revoke-1';
      const itemId = 'item-revoke-1';

      // Seed shared folder
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', folderId), {
          id: folderId,
          ownerId: aliceUid,
          name: 'Shared Team',
          icon: 'folder',
          color: 'blue',
          sortKey: 'a0',
          memberIds: [aliceUid, bobUid],
          roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        });
        await setDoc(doc(db, 'items', itemId), {
          id: itemId,
          folderId,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid, bobUid],
          title: 'Shared Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
      });

      // Verify Bob can initially read
      await assertSucceeds(getDoc(doc(bobDb, 'folders', folderId)));
      await assertSucceeds(getDoc(doc(bobDb, 'items', itemId)));

      // Alice revokes Bob (batch update)
      const batch = writeBatch(aliceDb);
      batch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: [aliceUid],
        roles: { [aliceUid]: 'owner' },
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(aliceDb, 'items', itemId), {
        memberIds: [aliceUid],
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });
      await assertSucceeds(batch.commit());

      // Bob's access to tasks and item modification is now immediately denied
      await assertFails(getDoc(doc(bobDb, 'items', itemId)));
      await assertFails(updateDoc(doc(bobDb, 'items', itemId), { title: 'Unauthorized Edit' }));
    });

    it('allows an editor to leave a folder', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const folderId = 'folder-leave-1';
      const itemId = 'item-leave-1';

      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', folderId), {
          id: folderId,
          ownerId: aliceUid,
          name: 'Team Project',
          icon: 'folder',
          color: 'purple',
          sortKey: 'a0',
          memberIds: [aliceUid, bobUid],
          roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        });
        await setDoc(doc(db, 'items', itemId), {
          id: itemId,
          folderId,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid, bobUid],
          title: 'Project Item',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
      });

      // Bob has access initially
      await assertSucceeds(getDoc(doc(bobDb, 'folders', folderId)));

      // Alice updates members list to remove Bob (or self-removal via leaveFolder)
      const batch = writeBatch(aliceDb);
      batch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: [aliceUid],
        roles: { [aliceUid]: 'owner' },
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(aliceDb, 'items', itemId), {
        memberIds: [aliceUid],
        updatedAt: serverTimestamp(),
        updatedBy: aliceUid,
      });
      await assertSucceeds(batch.commit());

      // Bob no longer has access to items in the folder
      await assertFails(getDoc(doc(bobDb, 'items', itemId)));
    });
  });

  describe('Move-Out Claim Semantics (§5)', () => {
    it('transfers ownership and isolates memberIds when moving item out of shared folder into default inbox', async () => {
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      const folderId = 'folder-shared-claim';
      const itemId = 'item-to-claim';
      const subtaskId = 'sub-to-claim';

      // Seed task owned by Alice in shared folder
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', folderId), {
          id: folderId,
          ownerId: aliceUid,
          name: 'Shared Team',
          icon: 'folder',
          color: 'blue',
          sortKey: 'a0',
          memberIds: [aliceUid, bobUid],
          roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        });
        await setDoc(doc(db, 'items', itemId), {
          id: itemId,
          folderId,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid, bobUid],
          title: 'Team Roadmap Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
        await setDoc(doc(db, 'items', subtaskId), {
          id: subtaskId,
          folderId,
          parentId: itemId,
          ownerId: aliceUid,
          memberIds: [aliceUid, bobUid],
          title: 'Subtask of roadmap',
          done: false,
          completedAt: null,
          sortKey: 's0',
          reminder: null,
        });
      });

      // Bob moves this item out of the shared folder to his default inbox (folderId: null)
      // Claim semantics (§5): Bob becomes owner, memberIds = [bobUid], folderId = null, parentId = null
      const batch = writeBatch(bobDb);
      const newSortKey = generateKeyBetween(null, 'a0');

      batch.update(doc(bobDb, 'items', itemId), {
        folderId: null,
        parentId: null,
        ownerId: bobUid,
        memberIds: [bobUid],
        sortKey: newSortKey,
        reminder: null,
        updatedAt: serverTimestamp(),
        updatedBy: bobUid,
      });

      batch.update(doc(bobDb, 'items', subtaskId), {
        folderId: null,
        ownerId: bobUid,
        memberIds: [bobUid],
        updatedAt: serverTimestamp(),
        updatedBy: bobUid,
      });

      await assertSucceeds(batch.commit());

      // Bob now owns the private task
      const bobSnap = await getDoc(doc(bobDb, 'items', itemId));
      const bobItem = bobSnap.data() as Item;
      expect(bobItem.folderId).toBeNull();
      expect(bobItem.ownerId).toBe(bobUid);
      expect(bobItem.memberIds).toEqual([bobUid]);

      // Alice can no longer read or access this claimed task
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      await assertFails(getDoc(doc(aliceDb, 'items', itemId)));
      await assertFails(getDoc(doc(aliceDb, 'items', subtaskId)));
    });

    it('strips reminder when moving a task with a reminder into a shared folder', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const folderId = 'folder-dest-shared';
      const itemId = 'item-private-rem';

      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', folderId), {
          id: folderId,
          ownerId: aliceUid,
          name: 'Shared Destination',
          icon: 'folder',
          color: 'red',
          sortKey: 'a0',
          memberIds: [aliceUid, bobUid],
          roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        });
        await setDoc(doc(db, 'items', itemId), {
          id: itemId,
          folderId: null,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid],
          title: 'Private with reminder',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: {
            fireAt: serverTimestamp(),
            recurrence: { kind: 'once' },
          },
        });
      });

      // Moving to shared folder while attempting to KEEP reminder MUST FAIL
      await assertFails(
        updateDoc(doc(aliceDb, 'items', itemId), {
          folderId,
          memberIds: [aliceUid, bobUid],
          // reminder not cleared
        })
      );

      // Moving to shared folder with reminder set to null SUCCEEDS
      await assertSucceeds(
        updateDoc(doc(aliceDb, 'items', itemId), {
          folderId,
          memberIds: [aliceUid, bobUid],
          reminder: null,
          updatedAt: serverTimestamp(),
          updatedBy: aliceUid,
        })
      );

      const movedSnap = await getDoc(doc(aliceDb, 'items', itemId));
      expect((movedSnap.data() as Item).reminder).toBeNull();
    });
  });

  describe('Batched Writes with Arbitrary Scale', () => {
    it('handles batching cleanly across multiple items without partial failure', async () => {
      const aliceDb = testEnv.authenticatedContext(aliceUid).firestore();
      const folderId = 'folder-scale-1';

      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', folderId), {
          id: folderId,
          ownerId: aliceUid,
          name: 'Scale Folder',
          icon: 'folder',
          color: 'blue',
          sortKey: 'a0',
          memberIds: [aliceUid],
          roles: { [aliceUid]: 'owner' },
        });

        const batch = writeBatch(db);
        for (let i = 0; i < 20; i++) {
          const id = `scale-item-${i}`;
          batch.set(doc(db, 'items', id), {
            id,
            folderId,
            parentId: null,
            ownerId: aliceUid,
            memberIds: [aliceUid],
            title: `Item ${i}`,
            done: false,
            completedAt: null,
            sortKey: `a${i}`,
            reminder: null,
          });
        }
        await batch.commit();
      });

      // Share with Bob in a batch
      const batch = writeBatch(aliceDb);
      const newMembers = [aliceUid, bobUid];
      batch.update(doc(aliceDb, 'folders', folderId), {
        memberIds: newMembers,
        roles: { [aliceUid]: 'owner', [bobUid]: 'editor' },
        updatedAt: serverTimestamp(),
      });
      for (let i = 0; i < 20; i++) {
        batch.update(doc(aliceDb, 'items', `scale-item-${i}`), {
          memberIds: newMembers,
          updatedAt: serverTimestamp(),
          updatedBy: aliceUid,
        });
      }
      await assertSucceeds(batch.commit());

      // Bob can read all 20 items
      const bobDb = testEnv.authenticatedContext(bobUid).firestore();
      for (let i = 0; i < 20; i++) {
        const snap = await getDoc(doc(bobDb, 'items', `scale-item-${i}`));
        expect(snap.exists()).toBe(true);
        expect((snap.data() as Item).memberIds).toEqual([aliceUid, bobUid]);
      }
    });
  });

  describe('Collaborative Reordering Consistency', () => {
    it('allows collaborator to reorder items independently without sortKey collisions', () => {
      const items = [
        { id: 'task-1', sortKey: 'a0' },
        { id: 'task-2', sortKey: 'a1' },
        { id: 'task-3', sortKey: 'a2' },
      ];

      // Collaborator Bob moves task-3 to top
      const bobKey = calculateReorderKey(items, 'task-3', 'task-1');
      expect(bobKey).not.toBeNull();
      expect(compareSortKeys({ sortKey: bobKey! }, { sortKey: 'a0' })).toBeLessThan(0);

      // Owner Alice moves task-2 to bottom
      const aliceKey = calculateReorderKey(items, 'task-2', 'task-3');
      expect(aliceKey).not.toBeNull();
      expect(compareSortKeys({ sortKey: aliceKey! }, { sortKey: 'a2' })).toBeGreaterThan(0);

      // Verify combined state
      const combined = [
        { id: 'task-1', sortKey: 'a0' },
        { id: 'task-2', sortKey: aliceKey! },
        { id: 'task-3', sortKey: bobKey! },
      ].sort(compareSortKeys);

      expect(combined.map((t) => t.id)).toEqual(['task-3', 'task-1', 'task-2']);
    });
  });

  describe('Share Links & Self-Join Security Rules', () => {
    const linkFolderId = 'folder-share-link-1';
    const linkItemId = 'item-share-link-1';

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', linkFolderId), {
          id: linkFolderId,
          ownerId: aliceUid,
          name: 'Link Shared Project',
          icon: 'briefcase',
          color: 'purple',
          sortKey: 'a0',
          memberIds: [aliceUid],
          roles: { [aliceUid]: 'owner' },
        });

        await setDoc(doc(db, 'items', linkItemId), {
          id: linkItemId,
          folderId: linkFolderId,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid],
          title: 'Shared Link Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
      });
    });

    it('allows an authenticated non-member to fetch folder metadata by ID for preview', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      const snap = await getDoc(doc(charlieDb, 'folders', linkFolderId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.name).toBe('Link Shared Project');
      expect(snap.data()?.ownerId).toBe(aliceUid);
    });

    it('denies an unauthenticated user from fetching folder metadata', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'folders', linkFolderId)));
    });

    it('allows an authenticated user to self-join a folder as editor', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      await assertSucceeds(
        updateDoc(doc(charlieDb, 'folders', linkFolderId), {
          memberIds: [aliceUid, charlieUid],
          roles: { [aliceUid]: 'owner', [charlieUid]: 'editor' },
          updatedAt: serverTimestamp(),
        })
      );

      const snap = await getDoc(doc(charlieDb, 'folders', linkFolderId));
      expect((snap.data() as Folder).memberIds).toContain(charlieUid);
      expect((snap.data() as Folder).roles[charlieUid]).toBe('editor');
    });

    it('rejects self-join if user tries to grant themselves owner role or change folder properties', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      
      // Attempting to become owner
      await assertFails(
        updateDoc(doc(charlieDb, 'folders', linkFolderId), {
          memberIds: [aliceUid, charlieUid],
          roles: { [aliceUid]: 'owner', [charlieUid]: 'owner' },
          updatedAt: serverTimestamp(),
        })
      );

      // Attempting to rename folder while self-joining
      await assertFails(
        updateDoc(doc(charlieDb, 'folders', linkFolderId), {
          name: 'Hacked Folder Name',
          memberIds: [aliceUid, charlieUid],
          roles: { [aliceUid]: 'owner', [charlieUid]: 'editor' },
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('allows newly joined folder member to update item memberIds in that folder', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      
      // First self-join folder
      await updateDoc(doc(charlieDb, 'folders', linkFolderId), {
        memberIds: [aliceUid, charlieUid],
        roles: { [aliceUid]: 'owner', [charlieUid]: 'editor' },
        updatedAt: serverTimestamp(),
      });

      // Then update item memberIds to synchronize
      await assertSucceeds(
        updateDoc(doc(charlieDb, 'items', linkItemId), {
          memberIds: [aliceUid, charlieUid],
          updatedAt: serverTimestamp(),
          updatedBy: charlieUid,
        })
      );

      const itemSnap = await getDoc(doc(charlieDb, 'items', linkItemId));
      expect((itemSnap.data() as Item).memberIds).toContain(charlieUid);
    });

    it('strips reminders when a private folder is joined via link (Invariant 5)', async () => {
      const charlieDb = testEnv.authenticatedContext(charlieUid).firestore();
      const remFolderId = 'folder-rem-join';
      const remItemId = 'item-rem-join';

      await testEnv.withSecurityRulesDisabled(async (admin) => {
        const db = admin.firestore();
        await setDoc(doc(db, 'folders', remFolderId), {
          id: remFolderId,
          ownerId: aliceUid,
          name: 'Private Folder with Reminder',
          icon: 'bell',
          color: 'crimson',
          sortKey: 'a0',
          memberIds: [aliceUid],
          roles: { [aliceUid]: 'owner' },
        });

        await setDoc(doc(db, 'items', remItemId), {
          id: remItemId,
          folderId: remFolderId,
          parentId: null,
          ownerId: aliceUid,
          memberIds: [aliceUid],
          title: 'Remind me before share',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: {
            fireAt: serverTimestamp(),
            recurrence: { kind: 'once' },
          },
        });
      });

      // Self-join folder
      await updateDoc(doc(charlieDb, 'folders', remFolderId), {
        memberIds: [aliceUid, charlieUid],
        roles: { [aliceUid]: 'owner', [charlieUid]: 'editor' },
        updatedAt: serverTimestamp(),
      });

      // Update item with reminder stripped
      await assertSucceeds(
        updateDoc(doc(charlieDb, 'items', remItemId), {
          memberIds: [aliceUid, charlieUid],
          reminder: null,
          updatedAt: serverTimestamp(),
          updatedBy: charlieUid,
        })
      );

      const snap = await getDoc(doc(charlieDb, 'items', remItemId));
      expect((snap.data() as Item).reminder).toBeNull();
    });
  });
});
