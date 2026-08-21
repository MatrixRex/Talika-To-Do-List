import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Item, Folder, Reminder } from '../lib/schema';
import { ListRow, Button, Input, Dialog, Menu, MenuItem, IconButton, AnimateEnter } from '../ui';
import { Icon } from '../ui/icons';
import { SubtaskItem } from './SubtaskItem';
import { ReminderDialog } from './ReminderDialog';
import { formatReminder } from '../lib/recurrence';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskItemProps {
  item: Item;
  index?: number;
  subtasks: Item[];
  folders: Folder[];
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onComplete: (id: string, done: boolean) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  onPromoteSubtask: (id: string) => void;
  onMoveToFolder: (itemId: string, targetFolderId: string | null) => void;
  onSetReminder?: (itemId: string, reminder: Reminder | null) => void;
  isSortable?: boolean;
}

export function TaskItem({
  item,
  index = 0,
  subtasks,
  folders,
  isSelected = false,
  onSelect,
  onComplete,
  onRename,
  onDelete,
  onDuplicate,
  onAddSubtask,
  onPromoteSubtask,
  onMoveToFolder,
  onSetReminder,
  isSortable = true,
}: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [pendingMoveTarget, setPendingMoveTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [isMoveOutConfirmOpen, setIsMoveOutConfirmOpen] = useState(false);

  const { userProfile } = useAuth();
  const hideCompletedTasks = userProfile?.prefs?.hideCompletedTasks ?? true;
  const [exitState, setExitState] = useState<'idle' | 'completing' | 'deleting'>('idle');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isSortable,
  });

  const sortableStyle = isSortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 20 : undefined,
      }
    : undefined;

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== item.title) {
      onRename(item.id, renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      onAddSubtask(item.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      setIsAddSubtaskOpen(false);
      setIsExpanded(true);
    }
  };

  const handleSelectMoveFolder = (targetFolderId: string | null) => {
    setIsMoveOpen(false);
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
    const isTargetShared = targetFolder && targetFolder.memberIds.length > 1;

    if (item.memberIds.length > 1 && targetFolderId === null) {
      // Moving out of shared folder to private inbox (§5 claim semantics)
      setIsMoveOutConfirmOpen(true);
    } else if (item.reminder && isTargetShared) {
      // Prompt reminder warning confirmation (§4)
      setPendingMoveTarget({
        id: targetFolderId,
        name: targetFolder?.name || 'Shared Folder',
      });
    } else {
      onMoveToFolder(item.id, targetFolderId);
    }
  };

  const isCompleted = exitState === 'completing' || item.done;

  const handleCompleteIntercept = (done: boolean) => {
    if (done && hideCompletedTasks) {
      setExitState('completing');
      setTimeout(() => onComplete(item.id, done), 800);
    } else {
      onComplete(item.id, done);
    }
  };

  const handleDeleteIntercept = () => {
    setMenuOpen(false);
    setExitState('deleting');
    setTimeout(() => onDelete(item.id), 800);
  };

  const confirmMoveOut = () => {
    setIsMoveOutConfirmOpen(false);
    onMoveToFolder(item.id, null);
  };

  const confirmMoveIntoShared = () => {
    if (pendingMoveTarget) {
      onMoveToFolder(item.id, pendingMoveTarget.id);
      setPendingMoveTarget(null);
    }
  };

  return (
    <AnimateEnter staggerIndex={index}>
      <div ref={setNodeRef} style={sortableStyle} className={`flex flex-col ${exitState === 'completing' ? 'anim-complete-out' : exitState === 'deleting' ? 'anim-delete-out' : ''}`}>
        <ListRow
          className={`cursor-pointer transition-colors duration-fast ${isCompleted ? 'opacity-80' : ''} ${isSelected ? 'bg-surface-active ring-1 ring-accent' : ''} ${
            exitState === 'completing' ? '!bg-green-500/15 !border-green-500/30' : exitState === 'deleting' ? '!bg-red-500/15 !border-red-500/30' : ''
          }`}
          onClick={() => {
            if (onSelect) {
              onSelect(item.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
        >
          <div className="flex items-center gap-0 -space-x-1 shrink-0 -ml-2">
            {/* Drag Handle */}
            {isSortable && (
              <div
                {...attributes}
                {...listeners}
                className="p-1 text-text-muted hover:text-text cursor-grab active:cursor-grabbing touch-none shrink-0"
                onClick={(e) => e.stopPropagation()}
                aria-label="Drag to reorder"
              >
                <Icon name="gripVertical" />
              </div>
            )}

            {/* Chevron for subtask expand/collapse */}
            {subtasks.length > 0 ? (
              <IconButton
                className="!p-1 min-w-0 min-h-0"
                aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} />
              </IconButton>
            ) : (
              <div className="w-6 shrink-0" />
            )}

            {/* Completion Checkbox */}
            <IconButton
              className="!p-1 min-w-0 min-h-0"
              aria-label={item.done ? "Mark incomplete" : "Mark complete"}
              onClick={(e) => {
                e.stopPropagation();
                handleCompleteIntercept(!item.done);
              }}
            >
              <Icon
                name={isCompleted ? 'check' : 'circle'}
                className={`${isCompleted ? 'text-accent anim-pop' : 'text-text-muted'} transition-transform`}
              />
            </IconButton>
          </div>

          {/* Task Title & Badges */}
          <div
            className="flex-1 min-w-0 flex items-center gap-2 flex-wrap"
            onClick={(e) => {
              if (onSelect) {
                e.stopPropagation();
                onSelect(item.id);
              }
            }}
          >
            <div className="relative inline-flex items-center min-w-0 max-w-full">
              <span className={`truncate transition-colors duration-300 ${isCompleted ? 'text-text-muted opacity-60' : 'text-text'}`}>
                {item.title}
              </span>
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-text-muted pointer-events-none transition-all duration-300 ease-out origin-left ${
                  isCompleted ? 'w-full scale-x-100 opacity-90' : 'w-full scale-x-0 opacity-0'
                }`}
              />
            </div>

          {/* Subtask count */}
          {subtasks.length > 0 && !isExpanded && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted shrink-0">
              {subtasks.filter(s => s.done).length}/{subtasks.length}
            </span>
          )}

          {/* Reminder Badge */}
          {item.reminder && (
            <span className="flex items-center gap-1 text-xs text-accent px-2 py-0.5 rounded-full bg-surface shrink-0 font-medium">
              <Icon name="bell" className="text-accent" />
              <span>{formatReminder(item.reminder)}</span>
            </span>
          )}
        </div>

        {/* Task Context Menu */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <IconButton aria-label="Task options" onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name="more" />
          </IconButton>
          <Menu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
            <div className="flex flex-col">
              {/* Invariant 5: Reminders are private-only (memberIds.length === 1) */}
              {item.memberIds.length === 1 && onSetReminder && (
                <MenuItem
                  icon={<Icon name="bell" />}
                  onClick={() => {
                    setMenuOpen(false);
                    setIsReminderOpen(true);
                  }}
                >
                  {item.reminder ? 'Edit reminder' : 'Set reminder'}
                </MenuItem>
              )}

              <MenuItem
                icon={<Icon name="edit" />}
                onClick={() => {
                  setMenuOpen(false);
                  setIsRenameOpen(true);
                }}
              >
                Rename
              </MenuItem>

              <MenuItem
                icon={<Icon name="plus" />}
                onClick={() => {
                  setMenuOpen(false);
                  setIsAddSubtaskOpen(true);
                }}
              >
                Add subtask
              </MenuItem>

              <MenuItem
                icon={<Icon name="copy" />}
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(item.id);
                }}
              >
                Duplicate
              </MenuItem>

              <MenuItem
                icon={<Icon name="folder" />}
                onClick={() => {
                  setMenuOpen(false);
                  setIsMoveOpen(true);
                }}
              >
                Move to folder
              </MenuItem>

              <MenuItem
                variant="danger"
                icon={<Icon name="trash" />}
                onClick={handleDeleteIntercept}
              >
                Delete
              </MenuItem>
            </div>
          </Menu>
        </div>
      </ListRow>

      {/* Subtasks rendering */}
      {isExpanded && subtasks.length > 0 && (
        <div className="flex flex-col">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              onComplete={onComplete}
              onRename={onRename}
              onDelete={onDelete}
              onPromote={onPromoteSubtask}
            />
          ))}
        </div>
      )}

      {/* Reminder Dialog */}
      {onSetReminder && (
        <ReminderDialog
          isOpen={isReminderOpen}
          onClose={() => setIsReminderOpen(false)}
          currentReminder={item.reminder}
          onSave={(newReminder) => onSetReminder(item.id, newReminder)}
        />
      )}

      {/* Rename Dialog */}
      <Dialog isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Rename Task</h3>
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleRename}>Save</Button>
        </div>
      </Dialog>

      {/* Add Subtask Dialog */}
      <Dialog isOpen={isAddSubtaskOpen} onClose={() => setIsAddSubtaskOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Add Subtask</h3>
        <Input
          autoFocus
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          placeholder="Subtask title"
          onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsAddSubtaskOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAddSubtask}>Create</Button>
        </div>
      </Dialog>

      {/* Move To Folder Dialog */}
      <Dialog isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Move to Folder</h3>
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          <ListRow
            className={item.folderId === null ? 'bg-surface' : ''}
            onClick={() => handleSelectMoveFolder(null)}
          >
            <Icon name="inbox" className="text-text-muted" />
            <span className="flex-1 truncate">Default Inbox</span>
          </ListRow>
          {folders.map((folder) => (
            <ListRow
              key={folder.id}
              className={item.folderId === folder.id ? 'bg-surface' : ''}
              onClick={() => handleSelectMoveFolder(folder.id)}
            >
              <Icon name="folder" className="text-accent" />
              <span className="flex-1 truncate">{folder.name}</span>
            </ListRow>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={() => setIsMoveOpen(false)}>Cancel</Button>
        </div>
      </Dialog>

      {/* Invariant 5: Move to shared folder warning dialog */}
      <Dialog isOpen={pendingMoveTarget !== null} onClose={() => setPendingMoveTarget(null)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-danger">
            <Icon name="bellOff" />
            <h3 className="text-lg font-bold">Reminder will be removed</h3>
          </div>
          <p className="text-sm text-text-muted">
            This task has a reminder. Moving it into a shared folder will remove it.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setPendingMoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmMoveIntoShared}>
              Move & Remove Reminder
            </Button>
          </div>
        </div>
      </Dialog>

      {/* §5: Move out of shared folder claim confirmation dialog */}
      <Dialog isOpen={isMoveOutConfirmOpen} onClose={() => setIsMoveOutConfirmOpen(false)}>
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text">Move to your private list?</h3>
          <p className="text-sm text-text-muted">
            This moves the task to your private list and removes it for {item.memberIds.length - 1} other {item.memberIds.length - 1 === 1 ? 'person' : 'people'}.
          </p>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setIsMoveOutConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmMoveOut}>
              Claim & Move
            </Button>
          </div>
        </div>
      </Dialog>
      </div>
    </AnimateEnter>
  );
}
