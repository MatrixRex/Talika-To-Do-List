import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Menu, MenuItem } from './Menu';
import { calculateMenuPosition } from './menu-position';

describe('Menu Viewport Bounds & Clamping Logic', () => {
  afterEach(cleanup);

  describe('calculateMenuPosition', () => {
    const defaultViewport = { width: 400, height: 800 };
    const defaultMenu = { width: 160, height: 180 };
    const padding = 8;
    const gap = 4;

    it('opens below the trigger when there is ample space at the bottom', () => {
      const triggerRect = { top: 100, bottom: 140, left: 300, right: 380 };
      const pos = calculateMenuPosition(triggerRect, defaultMenu, defaultViewport, padding, gap);

      // top = trigger bottom (140) + gap (4) = 144
      expect(pos.top).toBe(144);
      // right = viewport width (400) - trigger right (380) = 20
      expect(pos.right).toBe(20);
    });

    it('flips above the trigger when low on the screen to prevent extending below viewport', () => {
      // Trigger is placed at bottom of screen (bottom = 760 in 800px viewport)
      const triggerRect = { top: 720, bottom: 760, left: 300, right: 380 };
      const pos = calculateMenuPosition(triggerRect, defaultMenu, defaultViewport, padding, gap);

      // Opening below would be 760 + 4 = 764. 764 + 180 + 8 = 952 > 800 (overflows).
      // So it flips above: top = trigger top (720) - gap (4) - menu height (180) = 536.
      expect(pos.top).toBe(536);
      expect(pos.right).toBe(20);

      // Verify the bottom of the menu (536 + 180 = 716) is safely above trigger top and within viewport
      expect(pos.top + defaultMenu.height).toBeLessThanOrEqual(triggerRect.top);
      expect(pos.top).toBeGreaterThanOrEqual(padding);
      expect(pos.top + defaultMenu.height + padding).toBeLessThanOrEqual(defaultViewport.height);
    });

    it('clamps to viewport top padding when space above and below are both tight', () => {
      const tightViewport = { width: 400, height: 250 };
      const triggerRect = { top: 140, bottom: 180, left: 300, right: 380 };
      const pos = calculateMenuPosition(triggerRect, defaultMenu, tightViewport, padding, gap);

      expect(pos.top).toBeGreaterThanOrEqual(padding);
      expect(pos.top).toBeLessThanOrEqual(tightViewport.height - defaultMenu.height - padding);
    });

    it('clamps horizontal position when trigger is near the left edge to prevent left overflow', () => {
      // Trigger on the far left: right = 60
      const triggerRect = { top: 100, bottom: 140, left: 20, right: 60 };
      const pos = calculateMenuPosition(triggerRect, defaultMenu, defaultViewport, padding, gap);

      // Calculated left edge would be 400 - (400 - 60) - 160 = -100 < 8.
      // Clamped right should ensure left edge is at least padding (8px).
      // right = 400 - 8 - 160 = 232
      expect(pos.right).toBe(232);
      const leftEdge = defaultViewport.width - pos.right - defaultMenu.width;
      expect(leftEdge).toBeGreaterThanOrEqual(padding);
    });

    it('clamps horizontal position when trigger is right against viewport right edge', () => {
      const triggerRect = { top: 100, bottom: 140, left: 360, right: 398 };
      const pos = calculateMenuPosition(triggerRect, defaultMenu, defaultViewport, padding, gap);

      expect(pos.right).toBeGreaterThanOrEqual(padding);
    });
  });

  describe('Menu Component Render & Actions', () => {
    it('renders menu items in a portal and executes item onClick callback', () => {
      const onClose = vi.fn();
      const onItemClick = vi.fn();

      render(
        <div>
          <button type="button">Options</button>
          <Menu isOpen={true} onClose={onClose}>
            <MenuItem onClick={onItemClick}>Rename</MenuItem>
          </Menu>
        </div>
      );

      const renameItem = screen.getByText('Rename');
      expect(renameItem).toBeTruthy();

      fireEvent.click(renameItem);
      expect(onItemClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();

      render(
        <div>
          <Menu isOpen={true} onClose={onClose}>
            <MenuItem onClick={() => {}}>Delete</MenuItem>
          </Menu>
        </div>
      );

      // The backdrop is the first fixed element with inset-0
      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toBeTruthy();
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });
});
