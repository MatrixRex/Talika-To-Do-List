import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../lib/schema';
import { ListRow, Button, Input, Dialog, Menu, MenuItem, IconButton } from '../ui';
import { Icon } from '../ui/icons';
import { AnimateEnter } from '../ui/Animation';

interface SubtaskItemProps {
  subtask: Item;
  index?: number;
  onComplete: (id: string, done: boolean) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
}

export function SubtaskItem({ subtask, index = 0, onComplete, onRename, onDelete, onPromote }: SubtaskItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(subtask.title);

  const { userProfile } = useAuth();
  const hideCompletedTasks = userProfile?.prefs?.hideCompletedTasks ?? true;
  const [exitState, setExitState] = useState<'idle' | 'completing' | 'deleting'>('idle');

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== subtask.title) {
      onRename(subtask.id, renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  const isCompleted = exitState === 'completing' || subtask.done;

  const handleCompleteIntercept = (done: boolean) => {
    if (done && hideCompletedTasks) {
      setExitState('completing');
      setTimeout(() => onComplete(subtask.id, done), 800);
    } else {
      onComplete(subtask.id, done);
    }
  };

  const handleDeleteIntercept = () => {
    setMenuOpen(false);
    setExitState('deleting');
    setTimeout(() => onDelete(subtask.id), 800);
  };

  return (
    <AnimateEnter staggerIndex={index}>
      <div className={`flex flex-col ${exitState === 'completing' ? 'anim-complete-out' : exitState === 'deleting' ? 'anim-delete-out' : ''}`}>
        <ListRow
          className={`pl-6 transition-colors duration-fast ${isCompleted ? 'opacity-80' : ''} ${
            exitState === 'completing' ? '!bg-green-500/15 !border-green-500/30' : exitState === 'deleting' ? '!bg-red-500/15 !border-red-500/30' : ''
          }`}
        >
          <div className="flex items-center gap-0 -space-x-1 shrink-0">
            <div className="p-1 shrink-0">
              <Icon name="cornerDownRight" className="text-text-muted" />
            </div>
            
            <IconButton
              className="!p-1 min-w-0 min-h-0"
              aria-label={subtask.done ? "Mark incomplete" : "Mark complete"}
              onClick={() => handleCompleteIntercept(!subtask.done)}
            >
              <Icon
                name={isCompleted ? 'check' : 'circle'}
                className={`${isCompleted ? 'text-accent anim-pop' : 'text-text-muted'} transition-transform`}
              />
            </IconButton>
          </div>

          <div className="flex-1 min-w-0 relative inline-flex items-center">
            <span className={`truncate transition-colors duration-300 ${isCompleted ? 'text-text-muted opacity-60' : 'text-text'}`}>
              {subtask.title}
            </span>
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-text-muted pointer-events-none transition-all duration-300 ease-out origin-left ${
                isCompleted ? 'w-full scale-x-100 opacity-90' : 'w-full scale-x-0 opacity-0'
              }`}
            />
          </div>

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
                  onClick={handleDeleteIntercept}
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
    </AnimateEnter>
  );
}
