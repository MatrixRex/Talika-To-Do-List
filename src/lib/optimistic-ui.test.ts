import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { generateKeyBetween, compareSortKeys } from './sort-keys';
import { generateUUID } from './uuid';
import { ItemSchema, FolderSchema, validateItemContext, type Item, type Folder } from './schema';
import { getCachedDoc, getCachedDocs } from './db';

describe('Optimistic UI & Instant Mutations Test Suite', () => {
  const uid = 'user-optimistic-1';

  it('optimistically creates a top-level inbox task with valid sortKey and schema', () => {
    const existingItems: Item[] = [
      {
        id: 'item-1',
        folderId: null,
        parentId: null,
        ownerId: uid,
        memberIds: [uid],
        title: 'Task 1',
        done: false,
        completedAt: null,
        sortKey: 'a0',
        reminder: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: uid,
      },
    ];

    const inboxItems = existingItems
      .filter((i) => i.folderId === null && i.parentId === null)
      .sort(compareSortKeys);
    const lastKey = inboxItems.length > 0 ? inboxItems[inboxItems.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    const now = Timestamp.now();

    const optimisticItem: Item = {
      id: generateUUID(),
      folderId: null,
      parentId: null,
      ownerId: uid,
      memberIds: [uid],
      title: 'Optimistic Inbox Task',
      done: false,
      completedAt: null,
      sortKey,
      reminder: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: uid,
    };

    // Validate schema
    const validated = ItemSchema.parse(optimisticItem);
    expect(validated.id).toBe(optimisticItem.id);
    expect(validated.title).toBe('Optimistic Inbox Task');
    expect(compareSortKeys(existingItems[0], optimisticItem)).toBeLessThan(0);
  });

  it('optimistically creates a subtask inheriting folderId, ownerId, and memberIds', () => {
    const parentTask: Item = {
      id: 'parent-1',
      folderId: 'folder-123',
      parentId: null,
      ownerId: uid,
      memberIds: [uid, 'user-2'],
      title: 'Parent Task',
      done: false,
      completedAt: null,
      sortKey: 'a0',
      reminder: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: uid,
    };

    const targetFolder: Folder = {
      id: 'folder-123',
      ownerId: uid,
      name: 'Work',
      icon: 'folder',
      color: 'blue',
      sortKey: 'a0',
      memberIds: [uid, 'user-2'],
      roles: { [uid]: 'owner', 'user-2': 'editor' },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const subtasks: Item[] = [];
    const lastSubKey = subtasks.length > 0 ? subtasks[subtasks.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastSubKey, null);
    const now = Timestamp.now();

    const optimisticSubtask: Item = {
      id: generateUUID(),
      folderId: parentTask.folderId,
      parentId: parentTask.id,
      ownerId: parentTask.ownerId,
      memberIds: [...parentTask.memberIds],
      title: 'Optimistic Subtask',
      done: false,
      completedAt: null,
      sortKey,
      reminder: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: uid,
    };

    const validated = validateItemContext(optimisticSubtask, parentTask, targetFolder);
    expect(validated.parentId).toBe(parentTask.id);
    expect(validated.folderId).toBe('folder-123');
    expect(validated.memberIds).toEqual([uid, 'user-2']);
  });

  it('optimistically creates a folder with correct sortKey and schema', () => {
    const existingFolders: Folder[] = [
      {
        id: 'folder-1',
        ownerId: uid,
        name: 'Personal',
        icon: 'folder',
        color: 'indigo',
        sortKey: 'a0',
        memberIds: [uid],
        roles: { [uid]: 'owner' },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    const sortedFolders = [...existingFolders].sort(compareSortKeys);
    const lastKey = sortedFolders.length > 0 ? sortedFolders[sortedFolders.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    const now = Timestamp.now();

    const optimisticFolder: Folder = {
      id: generateUUID(),
      ownerId: uid,
      name: 'Projects',
      icon: 'folder',
      color: 'blue',
      sortKey,
      memberIds: [uid],
      roles: { [uid]: 'owner' },
      createdAt: now,
      updatedAt: now,
    };

    const validated = FolderSchema.parse(optimisticFolder);
    expect(validated.id).toBe(optimisticFolder.id);
    expect(validated.name).toBe('Projects');
    expect(compareSortKeys(existingFolders[0], optimisticFolder)).toBeLessThan(0);
  });

  it('optimistically toggles task completion', () => {
    const item: Item = {
      id: 'task-toggle-1',
      folderId: null,
      parentId: null,
      ownerId: uid,
      memberIds: [uid],
      title: 'Toggle Task',
      done: false,
      completedAt: null,
      sortKey: 'a0',
      reminder: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: uid,
    };

    const now = Timestamp.now();
    const completedItem: Item = {
      ...item,
      done: true,
      completedAt: now,
      updatedAt: now,
    };

    expect(ItemSchema.safeParse(completedItem).success).toBe(true);

    const uncompletedItem: Item = {
      ...completedItem,
      done: false,
      completedAt: null,
      updatedAt: Timestamp.now(),
    };

    expect(ItemSchema.safeParse(uncompletedItem).success).toBe(true);
  });

  it('optimistically moves item between folders and strips reminders if shared', () => {
    const sourceItem: Item = {
      id: 'item-move-1',
      folderId: null,
      parentId: null,
      ownerId: uid,
      memberIds: [uid],
      title: 'Task with Reminder',
      done: false,
      completedAt: null,
      sortKey: 'a0',
      reminder: {
        fireAt: Timestamp.now(),
        recurrence: { kind: 'once' },
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: uid,
    };

    const sharedTargetFolder: Folder = {
      id: 'shared-folder-1',
      ownerId: uid,
      name: 'Shared Work',
      icon: 'folder',
      color: 'blue',
      sortKey: 'a0',
      memberIds: [uid, 'user-bob'],
      roles: { [uid]: 'owner', 'user-bob': 'editor' },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const now = Timestamp.now();
    const isShared = sharedTargetFolder.memberIds.length > 1;
    const movedItem: Item = {
      ...sourceItem,
      folderId: sharedTargetFolder.id,
      parentId: null,
      ownerId: sourceItem.ownerId,
      memberIds: [...sharedTargetFolder.memberIds],
      sortKey: 'a1',
      reminder: isShared ? null : sourceItem.reminder,
      updatedAt: now,
      updatedBy: uid,
    };

    const validated = validateItemContext(movedItem, null, sharedTargetFolder);
    expect(validated.reminder).toBeNull();
    expect(validated.memberIds).toEqual([uid, 'user-bob']);
  });

  it('getCachedDoc attempts getDocFromCache before falling back to getDoc', async () => {
    const mockRef = { id: 'mock-doc' } as unknown as import('firebase/firestore').DocumentReference;
    const mockDocSnap = { exists: () => true, data: () => ({ id: 'mock-doc', title: 'Test' }) } as unknown as import('firebase/firestore').DocumentSnapshot;

    const result = await getCachedDoc(mockRef, async () => mockDocSnap, async () => {
      throw new Error('Server should not be called when cache succeeds');
    });

    expect(result.exists()).toBe(true);
    expect(result.data()?.title).toBe('Test');
  });

  it('getCachedDoc falls back to server if cache lookup throws', async () => {
    const mockRef = { id: 'mock-doc' } as unknown as import('firebase/firestore').DocumentReference;
    const mockServerSnap = { exists: () => true, data: () => ({ id: 'mock-doc', title: 'From Server' }) } as unknown as import('firebase/firestore').DocumentSnapshot;

    const result = await getCachedDoc(
      mockRef,
      async () => {
        throw new Error('unavailable in cache');
      },
      async () => mockServerSnap
    );

    expect(result.exists()).toBe(true);
    expect(result.data()?.title).toBe('From Server');
  });

  it('getCachedDocs falls back to server query if cache is empty or unavailable', async () => {
    const mockQuery = {} as unknown as import('firebase/firestore').Query;
    const mockServerQuerySnap = {
      empty: false,
      docs: [{ id: 'doc-1', data: () => ({ id: 'doc-1', sortKey: 'a0' }) }],
    } as unknown as import('firebase/firestore').QuerySnapshot;

    const result = await getCachedDocs(
      mockQuery,
      async () => {
        throw new Error('cache miss');
      },
      async () => mockServerQuerySnap
    );

    expect(result.empty).toBe(false);
    expect(result.docs[0].id).toBe('doc-1');
  });
});
