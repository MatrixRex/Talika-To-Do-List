import { useState, useEffect } from 'react';
import type { Item } from './schema';

export function useFilteredItems(items: Item[], hideCompleted: boolean): Item[] {
  const [visibleItems, setVisibleItems] = useState(items);

  useEffect(() => {
    if (!hideCompleted) {
      setVisibleItems(items);
      return;
    }

    const now = Date.now();
    const nextVisible = items.filter(item => {
      if (!item.done) return true;
      if (!item.completedAt) return false; // Fallback
      return (now - item.completedAt.toMillis()) < 3000;
    });
    
    setVisibleItems(nextVisible);

    const itemsToHideSoon = items.filter(
      item => item.done && item.completedAt && (now - item.completedAt.toMillis()) < 3000
    );
    
    if (itemsToHideSoon.length > 0) {
      const earliestHide = Math.min(...itemsToHideSoon.map(i => i.completedAt!.toMillis() + 3000));
      const timeout = setTimeout(() => {
        // Force a re-trigger of this effect by updating state
        setVisibleItems(prev => prev.filter(item => {
           if (!item.done) return true;
           if (!item.completedAt) return false;
           return (Date.now() - item.completedAt.toMillis()) < 3000;
        }));
      }, Math.max(0, earliestHide - Date.now()));
      
      return () => clearTimeout(timeout);
    }
  }, [items, hideCompleted]);

  return visibleItems;
}
