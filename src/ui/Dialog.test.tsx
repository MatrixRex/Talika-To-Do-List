import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { Dialog } from './Dialog';

describe('Dialog Component (src/ui/Dialog)', () => {
  afterEach(cleanup);

  it('renders dialog inside document.body via a portal', () => {
    const onClose = vi.fn();

    const { container } = render(
      <div data-testid="task-container" style={{ transform: 'translateY(0px)' }}>
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog Content</p>
        </Dialog>
      </div>
    );

    const taskContainer = container.querySelector('[data-testid="task-container"]');
    expect(taskContainer?.children.length).toBe(0);

    const dialogContent = screen.getByText('Dialog Content');
    expect(dialogContent).toBeTruthy();
    // Verify it is mounted in document.body
    expect(document.body.contains(dialogContent)).toBe(true);
  });

  it('calls onClose and stops click propagation when backdrop is clicked', () => {
    const onClose = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <Dialog isOpen={true} onClose={onClose}>
          <p>Rename Task Modal</p>
        </Dialog>
      </div>
    );

    const backdrop = document.body.querySelector('.bg-text.opacity-20');
    expect(backdrop).toBeTruthy();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
      // React synthetic event bubbling must be stopped so parent doesn't receive it
      expect(parentClick).not.toHaveBeenCalled();
    }
  });

  it('does not call onClose or trigger parent onClick when dialog content is clicked', () => {
    const onClose = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <Dialog isOpen={true} onClose={onClose}>
          <button type="button">Save</button>
        </Dialog>
      </div>
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(onClose).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('closes when Escape key is pressed', () => {
    const onClose = vi.fn();

    render(
      <Dialog isOpen={true} onClose={onClose}>
        <p>Press escape to dismiss</p>
      </Dialog>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents background tasks from receiving clicks when a task rename dialog is open', () => {
    const onTaskAClick = vi.fn();
    const onTaskBClick = vi.fn();

    function TaskListWithRename() {
      const [isRenameOpen, setIsRenameOpen] = useState(true);

      return (
        <div data-testid="task-list">
          <div data-testid="task-a" onClick={onTaskAClick} style={{ transform: 'translateY(0px)' }}>
            <span>Task A</span>
            <Dialog isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)}>
              <h3>Rename Task</h3>
              <input defaultValue="Task A" />
            </Dialog>
          </div>
          <div data-testid="task-b" onClick={onTaskBClick} style={{ transform: 'translateY(0px)' }}>
            <span>Task B</span>
          </div>
        </div>
      );
    }

    render(<TaskListWithRename />);

    // In a real browser, the backdrop covers the whole viewport.
    // In jsdom, clicking the backdrop triggers onClose, but never triggers task A or task B.
    const backdrop = document.body.querySelector('.bg-text.opacity-20');
    expect(backdrop).toBeTruthy();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onTaskAClick).not.toHaveBeenCalled();
      expect(onTaskBClick).not.toHaveBeenCalled();
    }
  });
});
