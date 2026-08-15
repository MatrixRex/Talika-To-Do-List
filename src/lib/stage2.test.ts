import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { ItemSchema, validateItemContext, type Item, type Folder } from './schema';
import { generateKeyBetween } from './sort-keys';

describe('Stage 2: Core UI Logic and Operations', () => {
  const createMockItem = (overrides?: Partial<Item>): Item => ({
    id: 'item-root-1',
    folderId: null,
    parentId: null,
    ownerId: 'user-1',
    memberIds: ['user-1'],
    title: 'Top-level task',
    done: false,
    completedAt: null,
    sortKey: 'a0',
    reminder: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: 'user-1',
    ...overrides,
  });

  const createMockFolder = (overrides?: Partial<Folder>): Folder => ({
    id: 'folder-1',
    ownerId: 'user-1',
    name: 'Work',
    icon: 'folder',
    color: 'blue',
    sortKey: 'a0',
    memberIds: ['user-1', 'user-2'],
    roles: { 'user-1': 'owner', 'user-2': 'editor' },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });

  describe('Promote Subtask (§9)', () => {
    it('promotes a subtask to top-level task in the same folder with fresh sortKey', () => {
      const parentTask = createMockItem({ id: 'parent-1', folderId: 'folder-1', memberIds: ['user-1', 'user-2'] });
      const subtask = createMockItem({
        id: 'sub-1',
        parentId: parentTask.id,
        folderId: parentTask.folderId,
        ownerId: parentTask.ownerId,
        memberIds: parentTask.memberIds,
        title: 'Child subtask',
        sortKey: 's0',
      });

      // Simulate promotion
      const promotedSortKey = generateKeyBetween(parentTask.sortKey, null);
      const promotedTask: Item = {
        ...subtask,
        parentId: null,
        sortKey: promotedSortKey,
        updatedAt: Timestamp.now(),
      };

      // Validate schema and invariant
      expect(promotedTask.parentId).toBeNull();
      expect(promotedTask.folderId).toBe(parentTask.folderId);
      expect(promotedTask.sortKey).not.toBe(subtask.sortKey);
      expect(() => ItemSchema.parse(promotedTask)).not.toThrow();
      
      const folder = createMockFolder({ id: 'folder-1', memberIds: ['user-1', 'user-2'] });
      expect(() => validateItemContext(promotedTask, null, folder)).not.toThrow();
    });
  });

  describe('Duplicate Task and Subtasks', () => {
    it('duplicates a top-level task and its subtasks with fresh IDs and sortKeys', () => {
      const parent = createMockItem({ id: 'parent-orig', title: 'Original Task', sortKey: 'a0' });
      const sub1 = createMockItem({ id: 'sub-1', parentId: parent.id, title: 'Subtask 1', sortKey: 's0' });
      const sub2 = createMockItem({ id: 'sub-2', parentId: parent.id, title: 'Subtask 2', sortKey: 's1' });

      // Duplicate parent
      const newParentId = 'parent-copy';
      const newParentKey = generateKeyBetween(parent.sortKey, null);
      const newParent: Item = {
        ...parent,
        id: newParentId,
        sortKey: newParentKey,
        done: false,
        completedAt: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Duplicate subtasks under new parent
      const duplicateSubtask = (sub: Item, prevKey: string | null): Item => ({
        ...sub,
        id: `sub-copy-${sub.id}`,
        parentId: newParentId,
        sortKey: generateKeyBetween(prevKey, null),
        done: false,
        completedAt: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      const newSub1 = duplicateSubtask(sub1, null);
      const newSub2 = duplicateSubtask(sub2, newSub1.sortKey);

      expect(newParent.id).not.toBe(parent.id);
      expect(newSub1.parentId).toBe(newParentId);
      expect(newSub2.parentId).toBe(newParentId);
      expect(newSub1.sortKey < newSub2.sortKey).toBe(true);

      expect(() => ItemSchema.parse(newParent)).not.toThrow();
      expect(() => validateItemContext(newParent, null, null)).not.toThrow();
      expect(() => ItemSchema.parse(newSub1)).not.toThrow();
      expect(() => validateItemContext(newSub1, newParent, null)).not.toThrow();
    });
  });

  describe('Move Item (§5)', () => {
    it('moves item to shared folder and strips reminder if shared', () => {
      const itemWithReminder = createMockItem({
        id: 'item-1',
        folderId: null,
        reminder: { fireAt: Timestamp.now(), recurrence: { kind: 'once' } },
      });

      const sharedFolder = createMockFolder({
        id: 'shared-1',
        memberIds: ['user-1', 'user-2'],
      });

      // Moving to shared folder
      const targetFolderId = sharedFolder.id;
      const newMemberIds = sharedFolder.memberIds;
      const movedItem: Item = {
        ...itemWithReminder,
        folderId: targetFolderId,
        memberIds: newMemberIds,
        sortKey: generateKeyBetween(null, 'z9'),
        reminder: newMemberIds.length > 1 ? null : itemWithReminder.reminder,
        updatedAt: Timestamp.now(),
      };

      expect(movedItem.reminder).toBeNull();
      expect(movedItem.memberIds).toEqual(['user-1', 'user-2']);
      expect(() => ItemSchema.parse(movedItem)).not.toThrow();
      expect(() => validateItemContext(movedItem, null, sharedFolder)).not.toThrow();
    });

    it('moving out to default folder transfers ownership to mover and resets memberIds', () => {
      const sharedFolder = createMockFolder({ id: 'shared-1', memberIds: ['user-1', 'user-2'] });
      const item = createMockItem({
        id: 'item-1',
        folderId: sharedFolder.id,
        ownerId: 'user-1',
        memberIds: sharedFolder.memberIds,
      });

      const actorId = 'user-2'; // mover
      const targetFolderId = null; // default folder
      const newOwnerId = actorId;
      const newMemberIds = [actorId];

      const movedItem: Item = {
        ...item,
        folderId: targetFolderId,
        ownerId: newOwnerId,
        memberIds: newMemberIds,
        sortKey: generateKeyBetween(null, null),
        updatedAt: Timestamp.now(),
      };

      expect(movedItem.ownerId).toBe('user-2');
      expect(movedItem.memberIds).toEqual(['user-2']);
      expect(movedItem.folderId).toBeNull();
      expect(() => ItemSchema.parse(movedItem)).not.toThrow();
      expect(() => validateItemContext(movedItem, null, null)).not.toThrow();
    });
  });
});
