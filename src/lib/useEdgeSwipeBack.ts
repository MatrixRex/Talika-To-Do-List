import { useState, useRef, useCallback } from 'react';

export interface EdgeSwipeBackOptions {
  onBack: () => void;
  edgeThreshold?: number; // max start clientX (default 32px)
  triggerThreshold?: number; // min drag clientX to trigger back (default 80px)
}

export function useEdgeSwipeBack({
  onBack,
  edgeThreshold = 32,
  triggerThreshold = 80,
}: EdgeSwipeBackOptions) {
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isEdgeRef = useRef<boolean>(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX <= edgeThreshold) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        isEdgeRef.current = true;
      } else {
        isEdgeRef.current = false;
      }
    },
    [edgeThreshold]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isEdgeRef.current || !touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Only swipe right from left edge when horizontal movement dominates
    if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      setIsSwiping(true);
      setDragOffset(deltaX);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isEdgeRef.current) return;
    isEdgeRef.current = false;
    touchStartRef.current = null;

    if (dragOffset > triggerThreshold) {
      onBack();
    }
    setDragOffset(0);
    setIsSwiping(false);
  }, [dragOffset, triggerThreshold, onBack]);

  const style: React.CSSProperties = {
    transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
    opacity: dragOffset > 0 ? Math.max(0.5, 1 - (dragOffset / 400) * 0.5) : undefined,
    transition: isSwiping
      ? 'none'
      : 'transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms cubic-bezier(0.2, 0, 0, 1)',
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isSwiping,
    dragOffset,
    style,
  };
}
