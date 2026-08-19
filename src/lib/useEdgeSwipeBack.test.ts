import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEdgeSwipeBack } from './useEdgeSwipeBack';

describe('useEdgeSwipeBack', () => {
  it('triggers onBack when swiping from left edge past trigger threshold', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() =>
      useEdgeSwipeBack({ onBack, edgeThreshold: 32, triggerThreshold: 80 })
    );

    // Touch start near left edge (clientX = 15)
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 15, clientY: 100 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    // Touch move horizontally to clientX = 120 (deltaX = 105 > 80)
    act(() => {
      result.current.handleTouchMove({
        touches: [{ clientX: 120, clientY: 102 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    expect(result.current.isSwiping).toBe(true);
    expect(result.current.dragOffset).toBe(105);
    expect(result.current.style.transform).toBe('translateX(105px)');

    // Touch end
    act(() => {
      result.current.handleTouchEnd();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.dragOffset).toBe(0);
  });

  it('does not trigger onBack if touch started away from left edge', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() =>
      useEdgeSwipeBack({ onBack, edgeThreshold: 32, triggerThreshold: 80 })
    );

    // Touch start away from edge (clientX = 150)
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 150, clientY: 100 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    // Touch move horizontally
    act(() => {
      result.current.handleTouchMove({
        touches: [{ clientX: 260, clientY: 100 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    expect(result.current.isSwiping).toBe(false);
    expect(result.current.dragOffset).toBe(0);

    act(() => {
      result.current.handleTouchEnd();
    });

    expect(onBack).not.toHaveBeenCalled();
  });

  it('does not trigger onBack if drag distance is below trigger threshold', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() =>
      useEdgeSwipeBack({ onBack, edgeThreshold: 32, triggerThreshold: 80 })
    );

    // Touch start near edge
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 10, clientY: 100 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    // Touch move only 30px (below 80px)
    act(() => {
      result.current.handleTouchMove({
        touches: [{ clientX: 40, clientY: 100 }] as unknown as React.TouchList,
      } as unknown as React.TouchEvent);
    });

    expect(result.current.dragOffset).toBe(30);

    act(() => {
      result.current.handleTouchEnd();
    });

    expect(onBack).not.toHaveBeenCalled();
    expect(result.current.dragOffset).toBe(0);
  });
});
