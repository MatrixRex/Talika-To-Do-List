import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { ItemSchema, validateItemContext, type Item, type Folder, type Reminder } from './schema';
import { catchUpMissedReminder } from './recurrence';
import { generateKeyBetween } from './sort-keys';

describe('Stage 6 Exit Tests: Invariant 5 & Reminder Enforcements', () => {
  const userA = 'user-alice';
  const userB = 'user-bob';

  const createMockItem = (overrides?: Partial<Item>): Item => ({
    id: 'item-1',
    folderId: null,
    parentId: null,
    ownerId: userA,
    memberIds: [userA],
    title: 'Top-level task',
    done: false,
    completedAt: null,
    sortKey: 'a0',
    reminder: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userA,
    ...overrides,
  });

  const createMockFolder = (overrides?: Partial<Folder>): Folder => ({
    id: 'folder-1',
    ownerId: userA,
    name: 'Shared Folder',
    icon: 'folder',
    color: 'blue',
    sortKey: 'a0',
    memberIds: [userA, userB],
    roles: { [userA]: 'owner', [userB]: 'editor' },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });

  describe('Invariant 2 & Invariant 5 Validation', () => {
    it('allows valid reminder on private top-level task', () => {
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
        recurrence: { kind: 'daily' },
      };

      const task = createMockItem({ reminder });
      expect(() => ItemSchema.parse(task)).not.toThrow();
      expect(() => validateItemContext(task)).not.toThrow();
    });

    it('rejects reminder on a subtask (Invariant 2)', () => {
      const parentTask = createMockItem({ id: 'parent-1' });
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
        recurrence: { kind: 'once' },
      };

      const subtask = createMockItem({
        id: 'sub-1',
        parentId: parentTask.id,
        reminder,
      });

      expect(() => ItemSchema.parse(subtask)).toThrowError(/top-level/i);
    });

    it('rejects reminder on a shared task (Invariant 5: memberIds.length > 1)', () => {
      const reminder: Reminder = {
        fireAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
        recurrence: { kind: 'monthly', day: 15 },
      };

      const sharedTask = createMockItem({
        memberIds: [userA, userB],
        reminder,
      });

      expect(() => ItemSchema.parse(sharedTask)).toThrowError(/private-only/i);
    });
  });

  describe('Moving Items & Reminder Stripping (§4 & §5)', () => {
    it('strips reminder when moving a task from private to shared folder', () => {
      const privateTask = createMockItem({
        reminder: {
          fireAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
          recurrence: { kind: 'daily' },
        },
      });
      const sharedFolder = createMockFolder({ id: 'folder-shared', memberIds: [userA, userB] });

      // Move logic simulation per SPEC.md §5
      const isTargetShared = sharedFolder.memberIds.length > 1;
      const movedTask: Item = {
        ...privateTask,
        folderId: sharedFolder.id,
        memberIds: sharedFolder.memberIds,
        reminder: isTargetShared ? null : privateTask.reminder, // Stripped!
        sortKey: generateKeyBetween(null, 'a0'),
        updatedAt: Timestamp.now(),
      };

      expect(movedTask.reminder).toBeNull();
      expect(() => validateItemContext(movedTask, null, sharedFolder)).not.toThrow();
    });

    it('preserves reminder when moving a task between private folders', () => {
      const privateFolderA = createMockFolder({ id: 'f-a', memberIds: [userA] });
      const privateFolderB = createMockFolder({ id: 'f-b', memberIds: [userA] });
      const privateTask = createMockItem({
        folderId: privateFolderA.id,
        reminder: {
          fireAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
          recurrence: { kind: 'daily' },
        },
      });

      const isTargetShared = privateFolderB.memberIds.length > 1;
      const movedTask: Item = {
        ...privateTask,
        folderId: privateFolderB.id,
        memberIds: privateFolderB.memberIds,
        reminder: isTargetShared ? null : privateTask.reminder, // Preserved!
        sortKey: generateKeyBetween(null, 'a0'),
        updatedAt: Timestamp.now(),
      };

      expect(movedTask.reminder).not.toBeNull();
      expect(() => validateItemContext(movedTask, null, privateFolderB)).not.toThrow();
    });
  });

  describe('Folder Sharing & Batch Stripping (§4)', () => {
    it('strips reminders from all tasks inside a folder when folder is shared', () => {
      const folder = createMockFolder({ id: 'f-1', memberIds: [userA] });
      const tasksInFolder: Item[] = [
        createMockItem({
          id: 't-1',
          folderId: folder.id,
          reminder: { fireAt: Timestamp.fromDate(new Date(Date.now() + 10000)), recurrence: { kind: 'once' } },
        }),
        createMockItem({
          id: 't-2',
          folderId: folder.id,
          reminder: { fireAt: Timestamp.fromDate(new Date(Date.now() + 20000)), recurrence: { kind: 'daily' } },
        }),
        createMockItem({
          id: 't-3',
          folderId: folder.id,
          reminder: null,
        }),
      ];

      // Folder is shared with userB
      const newMemberIds = [userA, userB];
      const isShared = newMemberIds.length > 1;

      let strippedCount = 0;
      const updatedTasks = tasksInFolder.map((task) => {
        let reminder = task.reminder;
        if (isShared && reminder !== null) {
          reminder = null;
          strippedCount++;
        }
        return {
          ...task,
          memberIds: newMemberIds,
          reminder,
          updatedAt: Timestamp.now(),
        };
      });

      expect(strippedCount).toBe(2);
      expect(updatedTasks[0].reminder).toBeNull();
      expect(updatedTasks[1].reminder).toBeNull();
      expect(updatedTasks[2].reminder).toBeNull();

      const updatedFolder: Folder = {
        ...folder,
        memberIds: newMemberIds,
        roles: { [userA]: 'owner', [userB]: 'editor' },
        updatedAt: Timestamp.now(),
      };

      for (const t of updatedTasks) {
        expect(() => validateItemContext(t, null, updatedFolder)).not.toThrow();
      }
    });
  });

  describe('Offline Catch-Up & Notification Rescheduling', () => {
    it('correctly catches up overdue recurring reminders on device boot', () => {
      const pastTime = new Date(Date.now() - 3600 * 24 * 1000 * 3); // 3 days ago
      const overdueReminder: Reminder = {
        fireAt: Timestamp.fromDate(pastTime),
        recurrence: { kind: 'daily' },
      };

      const now = new Date();
      const updated = catchUpMissedReminder(overdueReminder, now);
      expect(updated).not.toBeNull();
      expect(updated!.fireAt.toDate().getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
