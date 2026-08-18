import { generateKeyBetween } from './sort-keys';

export interface SortableEntity {
  id: string;
  sortKey: string;
}

/**
 * Calculates the single new fractional sortKey when an item is moved from its current
 * position to a target position relative to overId.
 *
 * Guaranteed to require modifying only ONE document.
 */
export function calculateReorderKey<T extends SortableEntity>(
  sortedItems: T[],
  activeId: string,
  overId: string
): string | null {
  if (activeId === overId) return null;

  const oldIndex = sortedItems.findIndex((item) => item.id === activeId);
  const overIndex = sortedItems.findIndex((item) => item.id === overId);

  if (oldIndex === -1 || overIndex === -1) return null;

  // Filter out the active item to find its adjacent neighbors at the target position
  const remaining = sortedItems.filter((item) => item.id !== activeId);

  // In the remaining array, the target index is overIndex
  const targetIndex = overIndex;

  const beforeItem = targetIndex > 0 ? remaining[targetIndex - 1] : null;
  const afterItem = targetIndex < remaining.length ? remaining[targetIndex] : null;

  const beforeKey = beforeItem ? beforeItem.sortKey : null;
  const afterKey = afterItem ? afterItem.sortKey : null;

  return generateKeyBetween(beforeKey, afterKey);
}
