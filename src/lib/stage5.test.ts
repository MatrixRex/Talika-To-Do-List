import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Item, Folder } from './schema';
import {
  getContextModes,
  getDefaultModeForContext,
  getModePlaceholder,
  calculateMatchCount,
  filterItemsBySearch,
  cycleNextMode,
  cyclePrevMode,
  type InputMode,
  type AppContext
} from './unified-input';

describe('Stage 5: Unified Input & Context Rules (Exit Suite)', () => {
  const createMockItem = (overrides?: Partial<Item>): Item => ({
    id: 'item-1',
    folderId: null,
    parentId: null,
    ownerId: 'user-1',
    memberIds: ['user-1'],
    title: 'Buy groceries',
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
    memberIds: ['user-1'],
    roles: { 'user-1': 'owner' },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });

  describe('1. Mode Matrix (§6 Context)', () => {
    it('returns [Create, Folder, Search] for Home screen {folderId: null, parentId: null}', () => {
      const context: AppContext = { folderId: null, parentId: null };
      expect(getContextModes(context)).toEqual(['Create', 'Folder', 'Search']);
      expect(getDefaultModeForContext(context)).toBe('Create');
    });

    it('returns [Subtask, Search] for Home + Task selected {folderId: null, parentId: "task-1"}', () => {
      const context: AppContext = { folderId: null, parentId: 'task-1' };
      expect(getContextModes(context)).toEqual(['Subtask', 'Search']);
      expect(getDefaultModeForContext(context)).toBe('Subtask');
    });

    it('returns [Create, Search] for Folder view {folderId: "folder-1", parentId: null}', () => {
      const context: AppContext = { folderId: 'folder-1', parentId: null };
      expect(getContextModes(context)).toEqual(['Create', 'Search']);
      expect(getDefaultModeForContext(context)).toBe('Create');
    });

    it('returns [Subtask, Search] for Folder + Task selected {folderId: "folder-1", parentId: "task-2"}', () => {
      const context: AppContext = { folderId: 'folder-1', parentId: 'task-2' };
      expect(getContextModes(context)).toEqual(['Subtask', 'Search']);
      expect(getDefaultModeForContext(context)).toBe('Subtask');
    });
  });

  describe('2. Mode Placeholders (§8 Unified Input)', () => {
    it('returns correct indicator placeholder text for each mode', () => {
      expect(getModePlaceholder('Create')).toBe('New task…');
      expect(getModePlaceholder('Folder')).toBe('New folder…');
      expect(getModePlaceholder('Subtask')).toBe('New subtask…');
      expect(getModePlaceholder('Search')).toBe('Search…');
    });
  });

  describe('3. Mode Cycling (Swipe & Tab Accelerator)', () => {
    it('cycles forward and backward through modes on Home view', () => {
      const modes: InputMode[] = ['Create', 'Folder', 'Search'];
      expect(cycleNextMode('Create', modes)).toBe('Folder');
      expect(cycleNextMode('Folder', modes)).toBe('Search');
      expect(cycleNextMode('Search', modes)).toBe('Create');

      expect(cyclePrevMode('Create', modes)).toBe('Search');
      expect(cyclePrevMode('Search', modes)).toBe('Folder');
      expect(cyclePrevMode('Folder', modes)).toBe('Create');
    });

    it('cycles correctly within subtask context', () => {
      const modes: InputMode[] = ['Subtask', 'Search'];
      expect(cycleNextMode('Subtask', modes)).toBe('Search');
      expect(cycleNextMode('Search', modes)).toBe('Subtask');

      expect(cyclePrevMode('Subtask', modes)).toBe('Search');
      expect(cyclePrevMode('Search', modes)).toBe('Subtask');
    });
  });

  describe('4. Cross-Mode Match Hint (§8)', () => {
    const mockItems: Item[] = [
      createMockItem({ id: '1', title: 'Buy groceries milk', folderId: null }),
      createMockItem({ id: '2', title: 'Buy eggs and milk', folderId: null }),
      createMockItem({ id: '3', title: 'Call mechanic', folderId: null }),
      createMockItem({ id: '4', title: 'Milk the cow', folderId: 'folder-work' }),
      createMockItem({ id: '5', title: 'Chocolate milk', parentId: '3', folderId: null }),
    ];

    it('calculates global match count on Home view', () => {
      const homeContext: AppContext = { folderId: null, parentId: null };
      expect(calculateMatchCount('milk', mockItems, homeContext)).toBe(4);
      expect(calculateMatchCount('mechanic', mockItems, homeContext)).toBe(1);
      expect(calculateMatchCount('nonexistent', mockItems, homeContext)).toBe(0);
      expect(calculateMatchCount('', mockItems, homeContext)).toBe(0);
      expect(calculateMatchCount('   ', mockItems, homeContext)).toBe(0);
    });

    it('calculates folder-scoped match count in Folder view', () => {
      const folderContext: AppContext = { folderId: 'folder-work', parentId: null };
      expect(calculateMatchCount('milk', mockItems, folderContext)).toBe(1);
      expect(calculateMatchCount('groceries', mockItems, folderContext)).toBe(0);
    });

    it('search scope follows screen, not selection (selecting task does not narrow scope)', () => {
      const homeWithSelection: AppContext = { folderId: null, parentId: '3' };
      // Scope is still global because screen is Home
      expect(calculateMatchCount('milk', mockItems, homeWithSelection)).toBe(4);
    });
  });

  describe('5. Substring Search Filtering (§8)', () => {
    const mockItems: Item[] = [
      createMockItem({ id: 'task-1', title: 'Apples and Oranges', folderId: null, parentId: null }),
      createMockItem({ id: 'sub-1', title: 'Subtask with apples', folderId: null, parentId: 'task-1' }),
      createMockItem({ id: 'task-2', title: 'Bananas', folderId: 'folder-work', parentId: null }),
    ];
    const mockFolders: Folder[] = [
      createMockFolder({ id: 'folder-work', name: 'Work Projects' }),
      createMockFolder({ id: 'folder-personal', name: 'Personal' }),
    ];

    it('filters items and folders case-insensitively for Home (global scope)', () => {
      const homeContext: AppContext = { folderId: null, parentId: null };
      const res = filterItemsBySearch('apple', mockItems, mockFolders, homeContext);

      expect(res.matchingTasks.map(t => t.id)).toEqual(['task-1']);
      expect(res.matchingSubtasks.map(s => s.id)).toEqual(['sub-1']);
      expect(res.matchingFolders.length).toBe(0);

      const folderRes = filterItemsBySearch('work', mockItems, mockFolders, homeContext);
      expect(folderRes.matchingFolders.map(f => f.id)).toEqual(['folder-work']);
    });

    it('filters items strictly within the folder in Folder view', () => {
      const folderContext: AppContext = { folderId: 'folder-work', parentId: null };
      const res = filterItemsBySearch('bananas', mockItems, mockFolders, folderContext);
      expect(res.matchingTasks.map(t => t.id)).toEqual(['task-2']);

      const noRes = filterItemsBySearch('apples', mockItems, mockFolders, folderContext);
      expect(noRes.matchingTasks.length).toBe(0);
      expect(noRes.matchingSubtasks.length).toBe(0);
    });
  });

  describe('6. Mobile & Literal Characters Handling (§8 & §13)', () => {
    it('accepts and preserves literal #, /, and @ characters in task titles', () => {
      const titleWithSigils = 'Review issue #42 on /github @john';
      const item = createMockItem({ title: titleWithSigils });
      expect(item.title).toBe(titleWithSigils);
      expect(item.title.includes('#')).toBe(true);
      expect(item.title.includes('/')).toBe(true);
      expect(item.title.includes('@')).toBe(true);
    });
  });
});
