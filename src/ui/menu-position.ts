export interface MenuPosition {
  top: number;
  right: number;
}

export function calculateMenuPosition(
  triggerRect: { top: number; bottom: number; left: number; right: number },
  menuDimensions: { width: number; height: number },
  viewportDimensions: { width: number; height: number },
  padding: number = 8,
  gap: number = 4
): MenuPosition {
  const { top: tTop, bottom: tBottom, right: tRight } = triggerRect;
  const { width: menuWidth, height: menuHeight } = menuDimensions;
  const { width: vWidth, height: vHeight } = viewportDimensions;

  // Default vertical: open below trigger
  let top = tBottom + gap;

  // If opening below would overflow the bottom of the viewport (with padding)
  if (top + menuHeight + padding > vHeight) {
    // Check if opening above the trigger fits within the top padding
    if (tTop - gap - menuHeight >= padding) {
      top = tTop - gap - menuHeight;
    } else {
      // If neither fits cleanly, clamp within [padding, vHeight - menuHeight - padding]
      top = Math.max(padding, vHeight - menuHeight - padding);
    }
  }

  // Default horizontal: align right edge of menu with right edge of trigger
  let right = vWidth - tRight;

  // If menu would overflow the left edge of viewport (with padding)
  if (vWidth - right - menuWidth < padding) {
    right = vWidth - padding - menuWidth;
  }

  // If menu would overflow the right edge of viewport (with padding)
  if (right < padding) {
    right = padding;
  }

  return {
    top: Math.round(top),
    right: Math.round(right),
  };
}
