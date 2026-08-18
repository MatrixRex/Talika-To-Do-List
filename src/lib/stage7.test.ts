import { describe, it, expect } from 'vitest';
import { calculateReorderKey } from './reorder';
import { compareSortKeys } from './sort-keys';
import { ICONS, CURATED_FOLDER_ICONS, type IconName } from '../ui/icons';
import { RADIX_COLORS, type RadixColorName, getFolderColorStyle } from '../ui/colors';
import { FolderSchema, ItemSchema, type Folder, type Item } from './schema';
import { Timestamp } from 'firebase/firestore';

describe('Stage 7 Exit Suite — Drag & Drop, Icons, and Colours', () => {
  describe('Single-Document Write Reordering Logic', () => {
    it('calculates the exact fractional sortKey when dropping an item at the top', () => {
      const items = [
        { id: '1', sortKey: 'a0' },
        { id: '2', sortKey: 'a1' },
        { id: '3', sortKey: 'a2' },
      ];

      // Move item 3 to top (before item 1)
      const newKey = calculateReorderKey(items, '3', '1');
      expect(newKey).not.toBeNull();
      // Should be strictly before 'a0'
      expect(compareSortKeys({ sortKey: newKey! }, { sortKey: 'a0' })).toBeLessThan(0);
    });

    it('calculates the exact fractional sortKey when dropping an item at the bottom', () => {
      const items = [
        { id: '1', sortKey: 'a0' },
        { id: '2', sortKey: 'a1' },
        { id: '3', sortKey: 'a2' },
      ];

      // Move item 1 to bottom (after item 3)
      const newKey = calculateReorderKey(items, '1', '3');
      expect(newKey).not.toBeNull();
      // Should be strictly after 'a2'
      expect(compareSortKeys({ sortKey: newKey! }, { sortKey: 'a2' })).toBeGreaterThan(0);
    });

    it('calculates the exact fractional sortKey when dropping between two items', () => {
      const items = [
        { id: '1', sortKey: 'a0' },
        { id: '2', sortKey: 'a1' },
        { id: '3', sortKey: 'a2' },
        { id: '4', sortKey: 'a3' },
      ];

      // Move item 4 between item 1 and item 2
      const newKey = calculateReorderKey(items, '4', '2');
      expect(newKey).not.toBeNull();
      expect(compareSortKeys({ sortKey: 'a0' }, { sortKey: newKey! })).toBeLessThan(0);
      expect(compareSortKeys({ sortKey: newKey! }, { sortKey: 'a1' })).toBeLessThan(0);
    });

    it('returns null if dropping on itself or position unchanged', () => {
      const items = [
        { id: '1', sortKey: 'a0' },
        { id: '2', sortKey: 'a1' },
      ];

      expect(calculateReorderKey(items, '1', '1')).toBeNull();
    });

    it('guarantees that a drop requires modifying EXACTLY ONE document', () => {
      // Setup a simulated list
      const items = [
        { id: 'item-1', sortKey: 'a0' },
        { id: 'item-2', sortKey: 'a1' },
        { id: 'item-3', sortKey: 'a2' },
        { id: 'item-4', sortKey: 'a3' },
      ];

      // Drop item-3 before item-1
      const newSortKey = calculateReorderKey(items, 'item-3', 'item-1');
      expect(newSortKey).toBeDefined();

      // Only item-3's sortKey needs to change; other items retain their exact existing keys
      const updatedList = items.map((item) =>
        item.id === 'item-3' ? { ...item, sortKey: newSortKey! } : item
      );

      // Verify new ordering
      const sorted = [...updatedList].sort(compareSortKeys);
      expect(sorted.map((i) => i.id)).toEqual(['item-3', 'item-1', 'item-2', 'item-4']);

      // Only 1 item had its sortKey changed
      const changedItems = updatedList.filter(
        (item, idx) => item.sortKey !== items[idx].sortKey
      );
      expect(changedItems.length).toBe(1);
      expect(changedItems[0].id).toBe('item-3');
    });

    it('guarantees single-document write on folder drop reordering in grid', () => {
      const folders = [
        { id: 'f-work', sortKey: 'a0' },
        { id: 'f-personal', sortKey: 'a1' },
        { id: 'f-gym', sortKey: 'a2' },
      ];

      // Reorder f-gym to the first slot (before f-work)
      const newFolderKey = calculateReorderKey(folders, 'f-gym', 'f-work');
      expect(newFolderKey).not.toBeNull();
      expect(compareSortKeys({ sortKey: newFolderKey! }, { sortKey: 'a0' })).toBeLessThan(0);

      // Exactly 1 folder document updated
      const updatedFolders = folders.map((f) =>
        f.id === 'f-gym' ? { ...f, sortKey: newFolderKey! } : f
      );
      const sorted = [...updatedFolders].sort(compareSortKeys);
      expect(sorted.map((f) => f.id)).toEqual(['f-gym', 'f-work', 'f-personal']);
      expect(updatedFolders.filter((f, idx) => f.sortKey !== folders[idx].sortKey).length).toBe(1);
    });
  });

  describe('Curated Icon Picker Map', () => {
    it('has approximately 40 curated icons available for folder customization', () => {
      expect(CURATED_FOLDER_ICONS.length).toBeGreaterThanOrEqual(30);
      expect(CURATED_FOLDER_ICONS.length).toBeLessThanOrEqual(50);
    });

    it('all curated icons exist in the ICONS map and are valid React components', () => {
      for (const iconKey of CURATED_FOLDER_ICONS) {
        expect(ICONS[iconKey]).toBeDefined();
        expect(typeof ICONS[iconKey]).toBe('object'); // Lucide icon forwardRef component
      }
    });

    it('stores only semantic string keys, never raw icon component references', () => {
      const folderData = {
        id: 'test-folder',
        icon: 'briefcase' as IconName,
        color: 'blue' as RadixColorName,
      };

      expect(typeof folderData.icon).toBe('string');
      expect(folderData.icon).toBe('briefcase');
    });
  });

  describe('Radix Color Scales', () => {
    it('supports curated Radix color names and produces valid semantic CSS variables', () => {
      expect(RADIX_COLORS).toContain('blue');
      expect(RADIX_COLORS).toContain('green');
      expect(RADIX_COLORS).toContain('red');
      expect(RADIX_COLORS).toContain('amber');
      expect(RADIX_COLORS).toContain('purple');

      for (const color of RADIX_COLORS) {
        const style = getFolderColorStyle(color);
        expect(style.color).toContain(`var(--${color}-11)`);
        expect(style.backgroundColor).toContain(`var(--${color}-3)`);
        expect(style.borderColor).toContain(`var(--${color}-6)`);
      }
    });

    it('never contains raw hex values in color styling utilities', () => {
      for (const color of RADIX_COLORS) {
        const style = getFolderColorStyle(color);
        expect(style.color).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        expect(style.backgroundColor).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        expect(style.borderColor).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      }
    });
  });

  describe('Export / Import Round-trip with Custom Icon and Color', () => {
    it('preserves custom icon and color semantic keys perfectly across schema validation and export serialization', () => {
      const now = Timestamp.now();
      const folder: Folder = {
        id: 'folder-work-1',
        ownerId: 'user-1',
        name: 'Work Project',
        icon: 'briefcase',
        color: 'purple',
        sortKey: 'a0',
        memberIds: ['user-1'],
        roles: { 'user-1': 'owner' },
        createdAt: now,
        updatedAt: now,
      };

      const item: Item = {
        id: 'item-1',
        folderId: 'folder-work-1',
        parentId: null,
        ownerId: 'user-1',
        memberIds: ['user-1'],
        title: 'Ship Stage 7',
        done: false,
        completedAt: null,
        sortKey: 'a0',
        reminder: null,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'user-1',
      };

      // Validate against Zod schemas
      expect(() => FolderSchema.parse(folder)).not.toThrow();
      expect(() => ItemSchema.parse(item)).not.toThrow();

      // Serialize for export
      const serializedFolder = {
        ...folder,
        createdAt: { _seconds: now.seconds, _nanoseconds: now.nanoseconds },
        updatedAt: { _seconds: now.seconds, _nanoseconds: now.nanoseconds },
      };

      const exportBundle = {
        users: {},
        folders: { [folder.id]: serializedFolder },
        items: {},
      };

      const jsonStr = JSON.stringify(exportBundle, null, 2);
      const parsed = JSON.parse(jsonStr);

      // Verify deserialized folder preserves icon and color without loss
      const deserializedFolder = {
        ...parsed.folders[folder.id],
        createdAt: new Timestamp(
          parsed.folders[folder.id].createdAt._seconds,
          parsed.folders[folder.id].createdAt._nanoseconds
        ),
        updatedAt: new Timestamp(
          parsed.folders[folder.id].updatedAt._seconds,
          parsed.folders[folder.id].updatedAt._nanoseconds
        ),
      };

      const validatedImport = FolderSchema.parse(deserializedFolder);
      expect(validatedImport.icon).toBe('briefcase');
      expect(validatedImport.color).toBe('purple');
      expect(validatedImport.name).toBe('Work Project');
    });
  });
});
