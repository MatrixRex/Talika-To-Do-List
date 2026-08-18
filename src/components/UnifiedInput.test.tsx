import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedInput } from './UnifiedInput';
import type { InputMode, AppContext } from '../lib/unified-input';

describe('UnifiedInput', () => {
  afterEach(cleanup);

  const defaultContext: AppContext = { folderId: null, parentId: null };

  it('renders input and button correctly', () => {
    const onQueryChange = vi.fn();
    const onModeChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <UnifiedInput
        context={defaultContext}
        query=""
        onQueryChange={onQueryChange}
        mode="Create"
        onModeChange={onModeChange}
        onSubmit={onSubmit}
        matchCount={0}
      />
    );

    expect(screen.getByPlaceholderText(/New task/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create action/i })).toBeTruthy();
  });

  it('calls onSubmit when clicking the plus button with text', async () => {
    const onQueryChange = vi.fn();
    const onModeChange = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <UnifiedInput
        context={defaultContext}
        query="Buy groceries"
        onQueryChange={onQueryChange}
        mode="Create"
        onModeChange={onModeChange}
        onSubmit={onSubmit}
        matchCount={0}
      />
    );

    const button = screen.getByRole('button', { name: /Create action/i });
    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledWith('Buy groceries', 'Create');
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('does not call onSubmit when clicking the plus button without text', async () => {
    const onQueryChange = vi.fn();
    const onModeChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <UnifiedInput
        context={defaultContext}
        query="   "
        onQueryChange={onQueryChange}
        mode="Create"
        onModeChange={onModeChange}
        onSubmit={onSubmit}
        matchCount={0}
      />
    );

    const button = screen.getByRole('button', { name: /Create action/i });
    fireEvent.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onQueryChange).not.toHaveBeenCalled();
  });
});
