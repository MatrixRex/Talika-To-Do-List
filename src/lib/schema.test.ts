import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { ItemSchema, validateItemContext, type Item, type Folder } from './schema';

describe('Schema Validations', () => {
  const createValidItem = (): Item => ({
    id: 'item-1',
    folderId: null,
    parentId: null,
    ownerId: 'user-1',
    memberIds: ['user-1'],
    title: 'Top level task',
    done: false,
    completedAt: null,
    sortKey: 'a0',
    reminder: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: 'user-1',
  });

  const createValidFolder = (): Folder => ({
    id: 'folder-1',
    ownerId: 'user-1',
    name: 'Shared Folder',
    icon: 'folder',
    color: 'blue',
    sortKey: 'a0',
    memberIds: ['user-1', 'user-2'],
    roles: { 'user-1': 'owner', 'user-2': 'editor' },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  describe('ItemSchema Base', () => {
    it('validates a correct item', () => {
      const item = createValidItem();
      expect(() => ItemSchema.parse(item)).not.toThrow();
    });

    it('rejects a default folder task that is shared', () => {
      const item = createValidItem();
      item.memberIds = ['user-1', 'user-2'];
      expect(() => ItemSchema.parse(item)).toThrow('Default folder tasks cannot be shared');
    });

    it('rejects reminders on subtasks', () => {
      const item = createValidItem();
      item.parentId = 'parent-1';
      item.reminder = { fireAt: Timestamp.now(), recurrence: { kind: 'once' } };
      expect(() => ItemSchema.parse(item)).toThrow('Reminders are only allowed on top-level tasks');
    });

    it('rejects reminders on shared tasks', () => {
      const item = createValidItem();
      item.folderId = 'folder-1';
      item.memberIds = ['user-1', 'user-2']; // Simulating a shared task
      item.reminder = { fireAt: Timestamp.now(), recurrence: { kind: 'once' } };
      expect(() => ItemSchema.parse(item)).toThrow('Reminders are private-only');
    });
    
    it('enforces done and completedAt sync', () => {
      const item = createValidItem();
      item.done = true;
      expect(() => ItemSchema.parse(item)).toThrow('Completed tasks must have a completedAt timestamp');
      
      item.completedAt = Timestamp.now();
      expect(() => ItemSchema.parse(item)).not.toThrow();
      
      item.done = false;
      expect(() => ItemSchema.parse(item)).toThrow('Incomplete tasks cannot have a completedAt timestamp');
    });
  });

  describe('validateItemContext', () => {
    it('rejects a subtask of a subtask', () => {
      const parentItem = createValidItem();
      parentItem.parentId = 'grandparent-1'; // Parent is already a subtask

      const subtask = createValidItem();
      subtask.parentId = parentItem.id;

      expect(() => validateItemContext(subtask, parentItem)).toThrow('Subtasks cannot have subtasks');
    });

    it('accepts a valid subtask', () => {
      const parentItem = createValidItem();
      
      const subtask = createValidItem();
      subtask.parentId = parentItem.id;

      expect(() => validateItemContext(subtask, parentItem)).not.toThrow();
    });

    it('enforces subtask inheritance of folderId, memberIds, and ownerId', () => {
      const parentItem = createValidItem();
      parentItem.folderId = 'folder-1';
      parentItem.ownerId = 'user-2';
      parentItem.memberIds = ['user-2'];

      const subtask = createValidItem();
      subtask.parentId = parentItem.id;
      // Inheriting incorrectly
      
      const folder = createValidFolder();
      folder.id = 'folder-1';
      folder.ownerId = 'user-2';
      folder.memberIds = ['user-2'];

      expect(() => validateItemContext(subtask, parentItem, folder)).toThrow('Subtasks must inherit folderId, ownerId, and memberIds from parent');
      
      // Fix inheritance
      subtask.folderId = parentItem.folderId;
      subtask.ownerId = parentItem.ownerId;
      subtask.memberIds = [...parentItem.memberIds];
      
      expect(() => validateItemContext(subtask, parentItem, folder)).not.toThrow();
    });
    
    it('enforces task matching folder memberIds exactly', () => {
      const folder = createValidFolder();
      
      const item = createValidItem();
      item.folderId = folder.id;
      item.ownerId = 'user-1';
      // Missing user-2
      item.memberIds = ['user-1'];
      
      expect(() => validateItemContext(item, null, folder)).toThrow('Task memberIds must match its folder memberIds exactly');
      
      item.memberIds = ['user-1', 'user-2'];
      expect(() => validateItemContext(item, null, folder)).not.toThrow();
    });

    it('validates editor creating a top-level task in a shared folder', () => {
      const folder = createValidFolder(); // owned by user-1, members [user-1, user-2]
      const editorUid = 'user-2';

      const editorTask: Item = {
        id: 'item-editor-1',
        folderId: folder.id,
        parentId: null,
        ownerId: folder.ownerId, // inherits folder ownerId
        memberIds: [...folder.memberIds],
        title: 'Task created by editor',
        done: false,
        completedAt: null,
        sortKey: 'a1',
        reminder: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: editorUid,
      };

      expect(() => validateItemContext(editorTask, null, folder)).not.toThrow();
    });

    it('validates editor creating a subtask inheriting parent task properties', () => {
      const folder = createValidFolder();
      const editorUid = 'user-2';

      const parentTask: Item = {
        id: 'item-parent-1',
        folderId: folder.id,
        parentId: null,
        ownerId: folder.ownerId,
        memberIds: [...folder.memberIds],
        title: 'Parent Task',
        done: false,
        completedAt: null,
        sortKey: 'a0',
        reminder: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: 'user-1',
      };

      const editorSubtask: Item = {
        id: 'subtask-editor-1',
        folderId: parentTask.folderId,
        parentId: parentTask.id,
        ownerId: parentTask.ownerId,
        memberIds: [...parentTask.memberIds],
        title: 'Subtask added by editor',
        done: false,
        completedAt: null,
        sortKey: 's0',
        reminder: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: editorUid,
      };

      expect(() => validateItemContext(editorSubtask, parentTask, folder)).not.toThrow();
    });
  });
});
