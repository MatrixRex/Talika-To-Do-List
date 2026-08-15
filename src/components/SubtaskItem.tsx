import { useState } from 'react';
import type { Item } from '../lib/schema';
import { ListRow, Button, Input, Dialog, Menu, MenuItem, IconButton } from '../ui';
import { Icon } from '../ui/icons';

interface SubtaskItemProps {
  subtask: Item;
  onComplete: (id: string, done: boolean) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
}

export function SubtaskItem({ subtask, onComplete, onRename, onDelete, onPromote }: SubtaskItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(subtask.title);

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== subtask.title) {
      onRename(subtask.id, renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  return (
    <div className="flex flex-col">
      <ListRow className={`pl-6 ${subtask.done ? 'opacity-60' : ''}`}>
        <Icon name="cornerDownRight" className="text-text-muted shrink-0" />
        
        <IconButton
          aria-label={subtask.done ? "Mark incomplete" : "Mark complete"}
          onClick={() => onComplete(subtask.id, !subtask.done)}
        >
          <Icon name={subtask.done ? 'check' : 'circle'} className={subtask.done ? 'text-accent' : 'text-text-muted'} />
        </IconButton>

        <span className={`flex-1 truncate ${subtask.done ? 'line-through text-text-muted' : 'text-text'}`}>
          {subtask.title}
        </span>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <IconButton aria-label="Subtask options" onClick={() => setMenuOpen(!menuOpen)}>
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
                icon={<Icon name="arrowUpRight" />}
                onClick={() => {
                  setMenuOpen(false);
                  onPromote(subtask.id);
                }}
              >
                Promote to task
              </MenuItem>

              <MenuItem
                variant="danger"
                icon={<Icon name="trash" />}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(subtask.id);
                }}
              >
                Delete
              </MenuItem>
            </div>
          </Menu>
        </div>
      </ListRow>

      <Dialog isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Rename Subtask</h3>
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
    </div>
  );
}
