import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Basic primitives
const TimestampSchema = z.custom<Timestamp>((val) => val instanceof Timestamp, {
  message: "Expected a Firestore Timestamp",
});

export const UserPrefsSchema = z.object({
  hideCompletedTasks: z.boolean(),
  hideCompletedSubtasks: z.boolean(),
  rememberLastFolder: z.boolean(),
});

export const UserSchema = z.object({
  uid: z.string(),
  email: z.string(),
  displayName: z.string(),
  photoURL: z.string().nullable(),
  createdAt: TimestampSchema,
  schemaVersion: z.number(),
  prefs: UserPrefsSchema,
});

export const FolderSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sortKey: z.string(),
  memberIds: z.array(z.string()).min(1),
  roles: z.record(z.string(), z.enum(['owner', 'editor'])),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const ReminderSchema = z.object({
  fireAt: TimestampSchema,
  recurrence: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('once') }),
    z.object({ kind: z.literal('daily') }),
    z.object({ kind: z.literal('weekly'), days: z.array(z.number().min(0).max(6)) }),
    z.object({ kind: z.literal('monthly'), day: z.number().min(1).max(31) }),
    z.object({ kind: z.literal('interval'), n: z.number().min(1), unit: z.enum(['day', 'week', 'month']) }),
  ]),
});

export const ItemSchema = z.object({
  id: z.string(),
  folderId: z.string().nullable(),
  parentId: z.string().nullable(),
  ownerId: z.string(),
  memberIds: z.array(z.string()).min(1),
  title: z.string(),
  done: z.boolean(),
  completedAt: TimestampSchema.nullable(),
  sortKey: z.string(),
  reminder: ReminderSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  updatedBy: z.string(),
}).superRefine((data, ctx) => {
  // Invariant 2: parentId != null -> reminder == null
  if (data.parentId !== null && data.reminder !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reminders are only allowed on top-level tasks',
      path: ['reminder'],
    });
  }

  // Invariant 3: folderId == null -> memberIds == [ownerId]
  if (data.folderId === null) {
    if (data.memberIds.length !== 1 || data.memberIds[0] !== data.ownerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Default folder tasks cannot be shared',
        path: ['memberIds'],
      });
    }
  }

  // Invariant 5: memberIds.length > 1 -> reminder == null
  if (data.memberIds.length > 1 && data.reminder !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reminders are private-only',
      path: ['reminder'],
    });
  }

  // Invariant 9: done == true -> completedAt != null
  if (data.done && data.completedAt === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Completed tasks must have a completedAt timestamp',
      path: ['completedAt'],
    });
  }
  
  if (!data.done && data.completedAt !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Incomplete tasks cannot have a completedAt timestamp',
      path: ['completedAt'],
    });
  }
});

export type UserPrefs = z.infer<typeof UserPrefsSchema>;
export type User = z.infer<typeof UserSchema>;
export type Folder = z.infer<typeof FolderSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Reminder = z.infer<typeof ReminderSchema>;

// Validation with context
export function validateItemContext(item: unknown, parentItem: Item | null = null, folder: Folder | null = null): Item {
  const parsedItem = ItemSchema.parse(item);

  // Invariant 1: parentId != null -> parent item exists and parent.parentId == null
  if (parsedItem.parentId !== null) {
    if (!parentItem) {
      throw new Error('Parent item must be provided if parentId is not null');
    }
    if (parsedItem.parentId !== parentItem.id) {
      throw new Error('Provided parent item does not match parentId');
    }
    if (parentItem.parentId !== null) {
      throw new Error('Subtasks cannot have subtasks');
    }
    // Invariant 7: Subtask always has the same folderId, memberIds, and ownerId as its parent
    if (parsedItem.folderId !== parentItem.folderId || 
        parsedItem.ownerId !== parentItem.ownerId ||
        parsedItem.memberIds.length !== parentItem.memberIds.length ||
        !parsedItem.memberIds.every((id, index) => id === parentItem.memberIds[index])) {
      throw new Error('Subtasks must inherit folderId, ownerId, and memberIds from parent');
    }
  }

  // Invariant 4: folderId != null -> memberIds equals that folder's memberIds exactly
  if (parsedItem.folderId !== null) {
    if (!folder) {
      throw new Error('Folder must be provided if folderId is not null');
    }
    if (parsedItem.folderId !== folder.id) {
      throw new Error('Provided folder does not match folderId');
    }
    if (parsedItem.memberIds.length !== folder.memberIds.length ||
        !parsedItem.memberIds.every((id, index) => id === folder.memberIds[index])) {
      throw new Error('Task memberIds must match its folder memberIds exactly');
    }
  }

  return parsedItem;
}
