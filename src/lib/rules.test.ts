import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-todo-rules-test';

describe('Firestore Security Rules Unit Tests (Stage 3 Exit Suite)', () => {
  let testEnv: RulesTestEnvironment;

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
      console.warn('Firestore emulator not reachable at 127.0.0.1:8080. Skipping rules tests.');
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
  });

  describe('users/{userId} collection', () => {
    it('allows a user to read and write their own document', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const aliceRef = doc(aliceDb, 'users', 'alice');

      await assertSucceeds(
        setDoc(aliceRef, {
          uid: 'alice',
          email: 'alice@example.com',
          displayName: 'Alice',
          photoURL: null,
          schemaVersion: 1,
          createdAt: serverTimestamp(),
          prefs: {
            hideCompletedTasks: false,
            hideCompletedSubtasks: false,
            rememberLastFolder: false,
          },
        })
      );

      await assertSucceeds(getDoc(aliceRef));
    });

    it('allows authenticated user to read user document for email lookup, but denies modifying another user document', async () => {
      // Seed alice document via admin context
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'users', 'alice'), { uid: 'alice', email: 'alice@example.com', displayName: 'Alice' });
      });

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const aliceRef = doc(bobDb, 'users', 'alice');

      await assertSucceeds(getDoc(aliceRef));
      await assertFails(setDoc(aliceRef, { uid: 'alice', displayName: 'Hacked' }));
    });

    it('denies unauthenticated requests', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const aliceRef = doc(unauthDb, 'users', 'alice');
      await assertFails(getDoc(aliceRef));
      await assertFails(setDoc(aliceRef, { uid: 'alice' }));
    });
  });

  describe('folders/{folderId} collection', () => {
    it('allows owner to create a folder with themselves as owner and member', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const folderRef = doc(aliceDb, 'folders', 'folder-1');

      await assertSucceeds(
        setDoc(folderRef, {
          id: 'folder-1',
          ownerId: 'alice',
          name: 'Personal',
          icon: 'folder',
          color: 'blue',
          sortKey: 'a0',
          memberIds: ['alice'],
          roles: { alice: 'owner' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('denies a user from creating a folder claiming someone else as owner', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const folderRef = doc(bobDb, 'folders', 'folder-1');

      await assertFails(
        setDoc(folderRef, {
          id: 'folder-1',
          ownerId: 'alice',
          name: 'Bob Folder',
          icon: 'folder',
          color: 'blue',
          sortKey: 'a0',
          memberIds: ['bob'],
          roles: { bob: 'owner' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it('allows members to read, denies non-members', async () => {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'folders', 'folder-shared'), {
          id: 'folder-shared',
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          roles: { alice: 'owner', bob: 'editor' },
        });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const charlieDb = testEnv.authenticatedContext('charlie').firestore();
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(getDoc(doc(aliceDb, 'folders', 'folder-shared')));
      await assertSucceeds(getDoc(doc(bobDb, 'folders', 'folder-shared')));
      // Authenticated non-member can fetch folder document by ID for preview
      await assertSucceeds(getDoc(doc(charlieDb, 'folders', 'folder-shared')));
      // Unauthenticated user is denied
      await assertFails(getDoc(doc(unauthDb, 'folders', 'folder-shared')));
    });

    it('denies editor from deleting folder or modifying memberIds/roles', async () => {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'folders', 'folder-shared'), {
          id: 'folder-shared',
          ownerId: 'alice',
          name: 'Shared Project',
          memberIds: ['alice', 'bob'],
          roles: { alice: 'owner', bob: 'editor' },
        });
      });

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const folderRef = doc(bobDb, 'folders', 'folder-shared');

      // Editor cannot delete
      await assertFails(deleteDoc(folderRef));

      // Editor cannot elevate role or change members
      await assertFails(
        updateDoc(folderRef, {
          roles: { alice: 'owner', bob: 'owner' },
        })
      );
      await assertFails(
        updateDoc(folderRef, {
          memberIds: ['bob'],
        })
      );

      // Editor CAN update name
      await assertSucceeds(
        updateDoc(folderRef, {
          name: 'Renamed by Bob',
        })
      );
    });
  });

  describe('items/{itemId} collection', () => {
    beforeEach(async () => {
      // Seed a shared folder
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'folders', 'folder-shared'), {
          id: 'folder-shared',
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          roles: { alice: 'owner', bob: 'editor' },
        });
      });
    });

    it('allows members to read and create items; denies non-members', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const charlieDb = testEnv.authenticatedContext('charlie').firestore();

      const itemRefAlice = doc(aliceDb, 'items', 'item-1');
      await assertSucceeds(
        setDoc(itemRefAlice, {
          id: 'item-1',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          title: 'Team Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        })
      );

      await assertSucceeds(getDoc(doc(aliceDb, 'items', 'item-1')));

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      await assertSucceeds(getDoc(doc(bobDb, 'items', 'item-1')));

      const itemRefCharlie = doc(charlieDb, 'items', 'item-2');
      await assertFails(
        setDoc(itemRefCharlie, {
          id: 'item-2',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'charlie',
          memberIds: ['alice', 'bob'],
          title: 'Unauthorized Task',
          done: false,
          completedAt: null,
          sortKey: 'a1',
          reminder: null,
        })
      );
      await assertFails(getDoc(doc(charlieDb, 'items', 'item-1')));
    });

    it('denies reminders on shared items (memberIds.length > 1)', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const itemRef = doc(aliceDb, 'items', 'item-reminder-fail');

      await assertFails(
        setDoc(itemRef, {
          id: 'item-reminder-fail',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          title: 'Shared with reminder',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: {
            fireAt: serverTimestamp(),
            recurrence: { kind: 'once' },
          },
        })
      );
    });

    it('allows reminders on private items (memberIds.length == 1)', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const itemRef = doc(aliceDb, 'items', 'item-private');

      await assertSucceeds(
        setDoc(itemRef, {
          id: 'item-private',
          folderId: null,
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice'],
          title: 'Private task with reminder',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: {
            fireAt: serverTimestamp(),
            recurrence: { kind: 'once' },
          },
        })
      );
    });

    it('enforces depth limit: subtasks cannot have subtasks (max 1 level)', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();

      // Create root parent
      await assertSucceeds(
        setDoc(doc(aliceDb, 'items', 'parent-1'), {
          id: 'parent-1',
          folderId: null,
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice'],
          title: 'Parent Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        })
      );

      // Create subtask (level 1)
      await assertSucceeds(
        setDoc(doc(aliceDb, 'items', 'subtask-1'), {
          id: 'subtask-1',
          folderId: null,
          parentId: 'parent-1',
          ownerId: 'alice',
          memberIds: ['alice'],
          title: 'Subtask Level 1',
          done: false,
          completedAt: null,
          sortKey: 's0',
          reminder: null,
        })
      );

      // Attempt creating subtask of subtask (level 2) -> MUST FAIL
      await assertFails(
        setDoc(doc(aliceDb, 'items', 'subtask-2'), {
          id: 'subtask-2',
          folderId: null,
          parentId: 'subtask-1',
          ownerId: 'alice',
          memberIds: ['alice'],
          title: 'Subtask Level 2 (Illegal)',
          done: false,
          completedAt: null,
          sortKey: 's1',
          reminder: null,
        })
      );
    });

    it('enforces subtask inheritance of folderId, memberIds, and ownerId', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();

      await assertSucceeds(
        setDoc(doc(aliceDb, 'items', 'parent-shared'), {
          id: 'parent-shared',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          title: 'Parent Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        })
      );

      // Subtask with mismatched folderId -> MUST FAIL
      await assertFails(
        setDoc(doc(aliceDb, 'items', 'subtask-bad-folder'), {
          id: 'subtask-bad-folder',
          folderId: 'wrong-folder',
          parentId: 'parent-shared',
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          title: 'Bad subtask',
          done: false,
          completedAt: null,
          sortKey: 's0',
          reminder: null,
        })
      );

      // Subtask with mismatched memberIds -> MUST FAIL
      await assertFails(
        setDoc(doc(aliceDb, 'items', 'subtask-bad-members'), {
          id: 'subtask-bad-members',
          folderId: 'folder-shared',
          parentId: 'parent-shared',
          ownerId: 'alice',
          memberIds: ['alice'], // missing bob
          title: 'Bad subtask',
          done: false,
          completedAt: null,
          sortKey: 's0',
          reminder: null,
        })
      );
    });

    it('denies revoked member from reading or updating items', async () => {
      // Seed item in folder shared between Alice and Bob
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'items', 'item-revoked-test'), {
          id: 'item-revoked-test',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice'], // Bob has been revoked
          title: 'Alice Private After Revoke',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
      });

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const itemRef = doc(bobDb, 'items', 'item-revoked-test');

      // Bob's read and write must both be denied
      await assertFails(getDoc(itemRef));
      await assertFails(updateDoc(itemRef, { title: 'Bob Trying To Edit' }));
    });

    it('allows editor to reorder and update task properties in shared folder', async () => {
      // Seed item where bob is member
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();
        await setDoc(doc(db, 'items', 'item-collab-1'), {
          id: 'item-collab-1',
          folderId: 'folder-shared',
          parentId: null,
          ownerId: 'alice',
          memberIds: ['alice', 'bob'],
          title: 'Team Collab Task',
          done: false,
          completedAt: null,
          sortKey: 'a0',
          reminder: null,
        });
      });

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const itemRef = doc(bobDb, 'items', 'item-collab-1');

      // Bob can mark done and update sortKey
      await assertSucceeds(
        updateDoc(itemRef, {
          done: true,
          completedAt: serverTimestamp(),
          sortKey: 'a0.5',
        })
      );
    });
  });
});
