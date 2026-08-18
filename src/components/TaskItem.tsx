import { useState } from 'react';
import type { Item, Folder } from '../lib/schema';
import { ListRow, Button, Input, Dialog, Menu, MenuItem, IconButton } from '../ui';
import { Icon } from '../ui/icons';
import { SubtaskItem } from './SubtaskItem';

interface TaskItemProps {
  item: Item;
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
}

export function TaskItem({
  item,
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
  onMoveToFolder
}: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [isMoveOpen, setIsMoveOpen] = useState(false);

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

  return (
    <div className="flex flex-col">
      <ListRow
        className={`cursor-pointer transition-colors duration-fast ${item.done ? 'opacity-60' : ''} ${isSelected ? 'bg-surface-active ring-1 ring-accent' : ''}`}
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
        {/* Chevron for subtask expand/collapse */}
        {subtasks.length > 0 ? (
          <IconButton
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
          aria-label={item.done ? "Mark incomplete" : "Mark complete"}
          onClick={(e) => {
            e.stopPropagation();
            onComplete(item.id, !item.done);
          }}
        >
          <Icon name={item.done ? 'check' : 'circle'} className={item.done ? 'text-accent' : 'text-text-muted'} />
        </IconButton>

        {/* Task Title */}
        <div
          className="flex-1 min-w-0 flex items-center gap-2"
          onClick={(e) => {
            if (onSelect) {
              e.stopPropagation();
              onSelect(item.id);
            }
          }}
        >
          <span className={`truncate ${item.done ? 'line-through text-text-muted' : 'text-text'}`}>
            {item.title}
          </span>
          {subtasks.length > 0 && !isExpanded && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted shrink-0">
              {subtasks.filter(s => s.done).length}/{subtasks.length}
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
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(item.id);
                }}
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
            onClick={() => {
              onMoveToFolder(item.id, null);
              setIsMoveOpen(false);
            }}
          >
            <Icon name="inbox" className="text-text-muted" />
            <span className="flex-1 truncate">Default Inbox</span>
          </ListRow>
          {folders.map((folder) => (
            <ListRow
              key={folder.id}
              className={item.folderId === folder.id ? 'bg-surface' : ''}
              onClick={() => {
                onMoveToFolder(item.id, folder.id);
                setIsMoveOpen(false);
              }}
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
    </div>
  );
}
