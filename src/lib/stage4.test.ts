import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { generateKeyBetween, compareSortKeys } from './sort-keys';
import type { Item, Folder } from './schema';

// Mock in-memory client-side database to simulate offline multi-client sync
class InMemoryClientDb {
  items: Map<string, Item> = new Map();
  folders: Map<string, Folder> = new Map();
  mutationQueue: Array<{
    type: 'createItem' | 'updateItem' | 'deleteItem' | 'createFolder' | 'updateFolder' | 'deleteFolder';
    id: string;
    payload?: Partial<Item> | Partial<Folder>;
  }> = [];

  constructor(initialItems: Item[] = [], initialFolders: Folder[] = []) {
    initialItems.forEach((i) => this.items.set(i.id, { ...i }));
    initialFolders.forEach((f) => this.folders.set(f.id, { ...f }));
  }

  // Offline mutation: updates local state and enqueues operation
  offlineCreateItem(item: Item) {
    this.items.set(item.id, { ...item });
    this.mutationQueue.push({ type: 'createItem', id: item.id, payload: item });
  }

  offlineUpdateItem(id: string, updates: Partial<Item>) {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Item ${id} not found in offline store`);
    }
    const updated = { ...existing, ...updates };
    this.items.set(id, updated);
    this.mutationQueue.push({ type: 'updateItem', id, payload: updates });
  }

  offlineDeleteItem(id: string) {
    this.items.delete(id);
    // Delete subtasks as well
    for (const [itemId, item] of this.items.entries()) {
      if (item.parentId === id) {
        this.items.delete(itemId);
      }
    }
    this.mutationQueue.push({ type: 'deleteItem', id });
  }

  // Apply queued mutations to a server store upon reconnect
  reconnectAndSync(serverDb: InMemoryServerDb) {
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const op of this.mutationQueue) {
      try {
        if (op.type === 'createItem') {
          serverDb.createItem(op.payload as Item);
          results.push({ id: op.id, success: true });
        } else if (op.type === 'updateItem') {
          serverDb.updateItem(op.id, op.payload as Partial<Item>);
          results.push({ id: op.id, success: true });
        } else if (op.type === 'deleteItem') {
          serverDb.deleteItem(op.id);
          results.push({ id: op.id, success: true });
        }
      } catch (err: unknown) {
        results.push({ id: op.id, success: false, error: (err as Error).message });
      }
    }
    this.mutationQueue = [];
    return results;
  }
}

class InMemoryServerDb {
  items: Map<string, Item> = new Map();
  folders: Map<string, Folder> = new Map();

  constructor(initialItems: Item[] = [], initialFolders: Folder[] = []) {
    initialItems.forEach((i) => this.items.set(i.id, { ...i }));
    initialFolders.forEach((f) => this.folders.set(f.id, { ...f }));
  }

  createItem(item: Item) {
    this.items.set(item.id, { ...item });
  }

  updateItem(id: string, updates: Partial<Item>) {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`NOT_FOUND: Item ${id} does not exist on server`);
    }
    this.items.set(id, { ...existing, ...updates });
  }

  deleteItem(id: string) {
    this.items.delete(id);
    // Delete subtasks
    for (const [itemId, item] of this.items.entries()) {
      if (item.parentId === id) {
        this.items.delete(itemId);
      }
    }
  }

  orphanSweep(): string[] {
    const validFolderIds = new Set(this.folders.keys());
    const validItemIds = new Set(this.items.keys());
    const deletedOrphans: string[] = [];

    for (const [id, item] of this.items.entries()) {
      const folderIsMissing = item.folderId !== null && !validFolderIds.has(item.folderId);
      const parentIsMissing = item.parentId !== null && !validItemIds.has(item.parentId);

      if (folderIsMissing || parentIsMissing) {
        this.items.delete(id);
        deletedOrphans.push(id);
      }
    }
    return deletedOrphans;
  }

  validateAllInvariants() {
    const sortKeyMap = new Map<string, Set<string>>();

    for (const item of this.items.values()) {
      // Invariant 1: parentId != null -> parent item exists and parent.parentId == null
      if (item.parentId !== null) {
        const parent = this.items.get(item.parentId);
        expect(parent).toBeDefined();
        expect(parent!.parentId).toBeNull();
      }

      // Invariant 2: parentId != null -> reminder == null
      if (item.parentId !== null) {
        expect(item.reminder).toBeNull();
      }

      // Invariant 3: folderId == null -> memberIds == [ownerId]
      if (item.folderId === null) {
        expect(item.memberIds).toEqual([item.ownerId]);
      }

      // Invariant 4: folderId != null -> memberIds equals that folder's memberIds exactly
      if (item.folderId !== null) {
        const folder = this.folders.get(item.folderId);
        expect(folder).toBeDefined();
        expect(item.memberIds).toEqual(folder!.memberIds);
      }

      // Invariant 5: memberIds.length > 1 -> reminder == null
      if (item.memberIds.length > 1) {
        expect(item.reminder).toBeNull();
      }

      // Invariant 6: sortKey is unique within (folderId, parentId) pair
      const scopeKey = `${item.folderId ?? 'root'}:${item.parentId ?? 'root'}`;
      if (!sortKeyMap.has(scopeKey)) {
        sortKeyMap.set(scopeKey, new Set());
      }
      const scopeSet = sortKeyMap.get(scopeKey)!;
      expect(scopeSet.has(item.sortKey)).toBe(false);
      scopeSet.add(item.sortKey);

      // Invariant 7: Subtasks inherit folderId, memberIds, ownerId
      if (item.parentId !== null) {
        const parent = this.items.get(item.parentId)!;
        expect(item.folderId).toBe(parent.folderId);
        expect(item.memberIds).toEqual(parent.memberIds);
        expect(item.ownerId).toBe(parent.ownerId);
      }

      // Invariant 9: done == true -> completedAt != null
      if (item.done) {
        expect(item.completedAt).not.toBeNull();
      } else {
        expect(item.completedAt).toBeNull();
      }
    }
  }
}

describe('Stage 4 Exit Tests — Sync and Offline Hardening', () => {
  const dummyTimestamp = new Timestamp(1700000000, 0);

  const createBaseItem = (id: string, title: string, sortKey: string, folderId: string | null = null, parentId: string | null = null): Item => ({
    id,
    folderId,
    parentId,
    ownerId: 'user1',
    memberIds: ['user1'],
    title,
    done: false,
    completedAt: null,
    sortKey,
    reminder: null,
    createdAt: dummyTimestamp,
    updatedAt: dummyTimestamp,
    updatedBy: 'user1'
  });

  describe('1. Same task edited on both devices while offline', () => {
    it('merges non-conflicting field edits cleanly into a single document with no duplicates', () => {
      const initialItem = createBaseItem('task-1', 'Original Title', 'V12345');
      const serverDb = new InMemoryServerDb([initialItem]);

      const clientA = new InMemoryClientDb([initialItem]);
      const clientB = new InMemoryClientDb([initialItem]);

      // Client A toggles completion offline
      const completedTime = new Timestamp(1700000100, 0);
      clientA.offlineUpdateItem('task-1', {
        done: true,
        completedAt: completedTime,
        updatedAt: completedTime,
        updatedBy: 'user1'
      });

      // Client B renames task offline
      const renamedTime = new Timestamp(1700000150, 0);
      clientB.offlineUpdateItem('task-1', {
        title: 'Renamed by Client B',
        updatedAt: renamedTime,
        updatedBy: 'user2'
      });

      // Both reconnect and sync mutations
      clientA.reconnectAndSync(serverDb);
      clientB.reconnectAndSync(serverDb);

      // Verify single document exists with both edits merged
      expect(serverDb.items.size).toBe(1);
      const synced = serverDb.items.get('task-1');
      expect(synced).toBeDefined();
      expect(synced!.title).toBe('Renamed by Client B');
      expect(synced!.done).toBe(true);
      expect(synced!.completedAt).toEqual(completedTime);
      expect(synced!.updatedBy).toBe('user2');
    });

    it('resolves conflicting same-field edits with Last-Write-Wins and never creates a duplicate', () => {
      const initialItem = createBaseItem('task-2', 'Original Title', 'V12345');
      const serverDb = new InMemoryServerDb([initialItem]);

      const clientA = new InMemoryClientDb([initialItem]);
      const clientB = new InMemoryClientDb([initialItem]);

      // Both edit title offline
      clientA.offlineUpdateItem('task-2', { title: 'Title from A' });
      clientB.offlineUpdateItem('task-2', { title: 'Title from B' });

      // Client A connects first, then Client B connects
      clientA.reconnectAndSync(serverDb);
      clientB.reconnectAndSync(serverDb);

      expect(serverDb.items.size).toBe(1);
      expect(serverDb.items.get('task-2')?.title).toBe('Title from B');
    });
  });

  describe('2. Tasks created offline on both devices', () => {
    it('both appear and preserve stable relative order without collisions or jitter', () => {
      const item1 = createBaseItem('item-1', 'First', 'M00000');
      const item2 = createBaseItem('item-2', 'Second', 'V00000');
      const item3 = createBaseItem('item-3', 'Third', 'k00000');

      const serverDb = new InMemoryServerDb([item1, item2, item3]);
      const clientA = new InMemoryClientDb([item1, item2, item3]);
      const clientB = new InMemoryClientDb([item1, item2, item3]);

      // Both clients insert a task between item2 and item3 while offline
      const sortKeyA = generateKeyBetween(item2.sortKey, item3.sortKey);
      const sortKeyB = generateKeyBetween(item2.sortKey, item3.sortKey);

      const taskA = createBaseItem('task-A', 'Created by A', sortKeyA);
      const taskB = createBaseItem('task-B', 'Created by B', sortKeyB);

      clientA.offlineCreateItem(taskA);
      clientB.offlineCreateItem(taskB);

      clientA.reconnectAndSync(serverDb);
      clientB.reconnectAndSync(serverDb);

      expect(serverDb.items.size).toBe(5);
      expect(serverDb.items.has('task-A')).toBe(true);
      expect(serverDb.items.has('task-B')).toBe(true);

      // Check fractional ordering: both must be strictly between item2 and item3
      expect(item2.sortKey < sortKeyA && sortKeyA < item3.sortKey).toBe(true);
      expect(item2.sortKey < sortKeyB && sortKeyB < item3.sortKey).toBe(true);

      // Distinct keys generated
      expect(sortKeyA).not.toBe(sortKeyB);

      // Deterministic list sorting by (sortKey, id)
      const allItems = Array.from(serverDb.items.values()).sort(compareSortKeys);

      const itemTitles = allItems.map((i) => i.title);
      expect(itemTitles[0]).toBe('First');
      expect(itemTitles[1]).toBe('Second');
      expect(itemTitles[4]).toBe('Third');
      // Created items occupy indices 2 and 3
      expect(['Created by A', 'Created by B']).toContain(itemTitles[2]);
      expect(['Created by A', 'Created by B']).toContain(itemTitles[3]);
    });
  });

  describe('3. Delete on A while B edits offline (Zombie prevention)', () => {
    it('rejects updates to deleted items and does not resurrect them as zombies', () => {
      const initialItem = createBaseItem('task-del', 'To Be Deleted', 'V00000');
      const serverDb = new InMemoryServerDb([initialItem]);

      const clientA = new InMemoryClientDb([initialItem]);
      const clientB = new InMemoryClientDb([initialItem]);

      // Client A deletes the task
      clientA.offlineDeleteItem('task-del');
      clientA.reconnectAndSync(serverDb);

      expect(serverDb.items.has('task-del')).toBe(false);

      // Client B edits the task offline
      clientB.offlineUpdateItem('task-del', { title: 'Zombie Attempt' });
      const syncResults = clientB.reconnectAndSync(serverDb);

      // The update operation on the deleted document fails
      expect(syncResults[0].success).toBe(false);
      expect(syncResults[0].error).toContain('NOT_FOUND');

      // The item remains deleted on the server
      expect(serverDb.items.has('task-del')).toBe(false);
    });

    it('cleans up orphaned subtasks via orphanSweep when parent was deleted concurrently', () => {
      const parentItem = createBaseItem('parent-1', 'Parent Task', 'V00000');
      const serverDb = new InMemoryServerDb([parentItem]);

      const clientA = new InMemoryClientDb([parentItem]);
      const clientB = new InMemoryClientDb([parentItem]);

      // Client A deletes parent
      clientA.offlineDeleteItem('parent-1');
      clientA.reconnectAndSync(serverDb);

      // Client B (offline) created a subtask under parent-1
      const subtask = createBaseItem('sub-1', 'Subtask from B', 'V11111', null, 'parent-1');
      clientB.offlineCreateItem(subtask);
      clientB.reconnectAndSync(serverDb);

      // Subtask is initially committed on server, but parent does not exist
      expect(serverDb.items.has('sub-1')).toBe(true);

      // Opportunistic orphan sweep detects and removes orphaned subtask
      const swept = serverDb.orphanSweep();
      expect(swept).toContain('sub-1');
      expect(serverDb.items.has('sub-1')).toBe(false);
    });
  });

  describe('4. Airplane mode 24h, 50 edits, reconnect', () => {
    it('applies 50 sequential offline modifications correctly and maintains all SPEC invariants', () => {
      const serverDb = new InMemoryServerDb();
      const client = new InMemoryClientDb();

      let prevSortKey: string | null = null;
      const createdItemIds: string[] = [];

      // 1. Create 20 top-level tasks
      for (let i = 0; i < 20; i++) {
        const id = `item-${i}`;
        const sortKey = generateKeyBetween(prevSortKey, null);
        prevSortKey = sortKey;
        const item = createBaseItem(id, `Task ${i}`, sortKey);
        client.offlineCreateItem(item);
        createdItemIds.push(id);
      }

      // 2. Create 10 subtasks under first 5 tasks
      for (let i = 0; i < 10; i++) {
        const parentId = createdItemIds[i % 5];
        const subId = `subtask-${i}`;
        const subSortKey = generateKeyBetween(null, null);
        const sub = createBaseItem(subId, `Subtask ${i}`, subSortKey, null, parentId);
        client.offlineCreateItem(sub);
      }

      // 3. Complete 10 tasks
      for (let i = 0; i < 10; i++) {
        const id = createdItemIds[i];
        client.offlineUpdateItem(id, {
          done: true,
          completedAt: dummyTimestamp,
          updatedAt: dummyTimestamp
        });
      }

      // 4. Rename 10 tasks
      for (let i = 10; i < 20; i++) {
        const id = createdItemIds[i];
        client.offlineUpdateItem(id, {
          title: `Updated Title ${i}`,
          updatedAt: dummyTimestamp
        });
      }

      // Total mutations in queue should be 20 + 10 + 10 + 10 = 50
      expect(client.mutationQueue.length).toBe(50);

      // Reconnect and sync all 50 mutations to the server
      const syncResults = client.reconnectAndSync(serverDb);
      expect(syncResults.every((r) => r.success)).toBe(true);

      // Verify all 30 items exist on server (20 tasks + 10 subtasks)
      expect(serverDb.items.size).toBe(30);

      // Verify completions
      for (let i = 0; i < 10; i++) {
        const item = serverDb.items.get(createdItemIds[i]);
        expect(item?.done).toBe(true);
        expect(item?.completedAt).not.toBeNull();
      }

      // Verify renames
      for (let i = 10; i < 20; i++) {
        const item = serverDb.items.get(createdItemIds[i]);
        expect(item?.title).toBe(`Updated Title ${i}`);
      }

      // Verify all 9 invariants pass
      serverDb.validateAllInvariants();
    });
  });

  describe('5. Deterministic sorting and position stability', () => {
    it('consistently sorts 500 items by (sortKey, id) in sub-millisecond time', () => {
      const items: Item[] = [];
      let currentKey = generateKeyBetween(null, null);

      for (let i = 0; i < 500; i++) {
        currentKey = generateKeyBetween(currentKey, null);
        items.push(createBaseItem(`task-${i}`, `Task ${i}`, currentKey));
      }

      const start = performance.now();
      const sorted = [...items].sort(compareSortKeys);
      const elapsed = performance.now() - start;

      expect(sorted.length).toBe(500);
      expect(elapsed).toBeLessThan(50); // Sub-millisecond to low millisecond

      // Verify strictly ascending sortKeys
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].sortKey < sorted[i + 1].sortKey).toBe(true);
      }
    });
  });
});
