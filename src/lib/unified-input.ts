import type { Item, Folder } from './schema';

export type InputMode = 'Create' | 'Folder' | 'Subtask' | 'Search';

export interface AppContext {
  folderId: string | null;
  parentId: string | null;
}

/**
 * Derives available modes from context (§6 Mode matrix).
 * modes = parentId != null
 *   ? ['Subtask', 'Search']
 *   : ['Create', 'Search', ...(folderId == null ? ['Folder'] : [])]
 */
export function getContextModes(context: AppContext): InputMode[] {
  if (context.parentId !== null) {
    return ['Subtask', 'Search'];
  }
  if (context.folderId === null) {
    return ['Create', 'Folder', 'Search'];
  }
  return ['Create', 'Search'];
}

/**
 * Gets default mode for context (§8: mode resets to Create or Subtask on context change).
 */
export function getDefaultModeForContext(context: AppContext): InputMode {
  return context.parentId !== null ? 'Subtask' : 'Create';
}

/**
 * Returns placeholder text for the active mode (§8).
 */
export function getModePlaceholder(mode: InputMode, parentTaskTitle?: string | null): string {
  switch (mode) {
    case 'Create':
      return 'New task…';
    case 'Folder':
      return 'New folder…';
    case 'Subtask':
      return parentTaskTitle ? `New subtask for "${parentTaskTitle}"…` : 'New subtask…';
    case 'Search':
      return 'Search…';
  }
}

/**
 * Cycles to the next mode in the list (swipe left / Tab).
 */
export function cycleNextMode(currentMode: InputMode, availableModes: InputMode[]): InputMode {
  const currentIndex = availableModes.indexOf(currentMode);
  if (currentIndex === -1) return availableModes[0] || 'Create';
  const nextIndex = (currentIndex + 1) % availableModes.length;
  return availableModes[nextIndex];
}

/**
 * Cycles to the previous mode in the list (swipe right / Shift+Tab).
 */
export function cyclePrevMode(currentMode: InputMode, availableModes: InputMode[]): InputMode {
  const currentIndex = availableModes.indexOf(currentMode);
  if (currentIndex === -1) return availableModes[0] || 'Create';
  const prevIndex = (currentIndex - 1 + availableModes.length) % availableModes.length;
  return availableModes[prevIndex];
}

/**
 * Calculates match count for cross-mode hint (§8).
 * Search scope follows the screen (global if folderId == null, folder-scoped if folderId != null).
 */
export function calculateMatchCount(query: string, items: Item[], context: AppContext): number {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 0;

  const scopedItems = context.folderId === null
    ? items
    : items.filter(i => i.folderId === context.folderId);

  return scopedItems.filter(i => i.title.toLowerCase().includes(trimmed)).length;
}

export interface SearchResults {
  matchingTasks: Item[];
  matchingSubtasks: Item[];
  matchingFolders: Folder[];
}

/**
 * Filters items and folders by substring query.
 */
export function filterItemsBySearch(
  query: string,
  items: Item[],
  folders: Folder[],
  context: AppContext
): SearchResults {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return {
      matchingTasks: [],
      matchingSubtasks: [],
      matchingFolders: []
    };
  }

  const scopedItems = context.folderId === null
    ? items
    : items.filter(i => i.folderId === context.folderId);

  const matchingTasks = scopedItems.filter(
    i => i.parentId === null && i.title.toLowerCase().includes(trimmed)
  );

  const matchingSubtasks = scopedItems.filter(
    i => i.parentId !== null && i.title.toLowerCase().includes(trimmed)
  );

  const matchingFolders = context.folderId === null
    ? folders.filter(f => f.name.toLowerCase().includes(trimmed))
    : [];

  return {
    matchingTasks,
    matchingSubtasks,
    matchingFolders
  };
}
