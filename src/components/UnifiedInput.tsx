import { useState, useRef, useEffect } from 'react';
import {
  getContextModes,
  getModePlaceholder,
  cycleNextMode,
  cyclePrevMode,
  type InputMode,
  type AppContext
} from '../lib/unified-input';
import { Input, IconButton } from '../ui';
import { Icon } from '../ui/icons';

interface UnifiedInputProps {
  context: AppContext;
  query: string;
  onQueryChange: (query: string) => void;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onSubmit: (text: string, mode: InputMode) => void;
  parentTaskTitle?: string | null;
  onDeselectParent?: () => void;
}

export function UnifiedInput({
  context,
  query,
  onQueryChange,
  mode,
  onModeChange,
  onSubmit,
  parentTaskTitle,
  onDeselectParent,
}: UnifiedInputProps) {
  const availableModes = getContextModes(context);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global desktop accelerators (§8 & §9)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onModeChange('Search');
        inputRef.current?.focus();
        return;
      }

      // If active element is an input, do not capture single-character shortcuts
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (!isInput) {
        if (e.key === '/') {
          e.preventDefault();
          onModeChange('Search');
          inputRef.current?.focus();
        } else if (e.key === 'Escape') {
          if (context.parentId && onDeselectParent) {
            onDeselectParent();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [context.parentId, onDeselectParent, onModeChange]);

  // Handle touch swipe for cycling modes (§8)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    setTouchStartX(null);

    const SWIPE_THRESHOLD = 40;
    if (deltaX < -SWIPE_THRESHOLD) {
      // Swiped left -> Next mode
      onModeChange(cycleNextMode(mode, availableModes));
    } else if (deltaX > SWIPE_THRESHOLD) {
      // Swiped right -> Prev mode
      onModeChange(cyclePrevMode(mode, availableModes));
    }
  };

  // Keyboard navigation on input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onModeChange(cyclePrevMode(mode, availableModes));
      } else {
        onModeChange(cycleNextMode(mode, availableModes));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      if (query) {
        onQueryChange('');
      } else if (context.parentId && onDeselectParent) {
        onDeselectParent();
      }
    }
  };

  const handleSubmit = () => {
    if (mode === 'Search') {
      // Search is live, enter can blur input or leave as-is
      inputRef.current?.blur();
      return;
    }

    if (query.trim()) {
      onSubmit(query.trim(), mode);
      onQueryChange('');
    }
  };

  const getSubmitIconName = () => {
    switch (mode) {
      case 'Folder':
        return 'folderPlus';
      case 'Search':
        return 'search';
      case 'Subtask':
      case 'Create':
      default:
        return 'plus';
    }
  };

  return (
    <div
      className="shrink-0 bg-background border-t border-surface-border flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Active Parent Task Banner (when creating subtask) */}
      {context.parentId && parentTaskTitle && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-surface text-text text-xs border-b border-surface-border">
          <div className="flex items-center gap-1.5 truncate">
            <Icon name="cornerDownRight" className="text-accent shrink-0" />
            <span className="text-text-muted">Subtask for:</span>
            <span className="font-semibold truncate">&ldquo;{parentTaskTitle}&rdquo;</span>
          </div>
          {onDeselectParent && (
            <IconButton
              aria-label="Cancel subtask selection"
              onClick={onDeselectParent}
              className="p-1 min-h-0 min-w-0 text-text-muted hover:text-text"
            >
              <Icon name="x" />
            </IconButton>
          )}
        </div>
      )}

      {/* Segmented Control Bar */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-1 overflow-x-auto">
        {availableModes.map((m) => {
          const isActive = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors duration-fast ${
                isActive
                  ? 'bg-accent text-background font-semibold'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Main Input Row */}
      <div className="p-3 pt-1 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={getModePlaceholder(mode, parentTaskTitle)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <IconButton
          aria-label={`${mode} action`}
          onClick={handleSubmit}
          className="bg-accent text-background hover:opacity-90 shrink-0"
        >
          <Icon name={getSubmitIconName()} />
        </IconButton>
      </div>
    </div>
  );
}
