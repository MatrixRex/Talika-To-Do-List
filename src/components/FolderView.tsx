import { useState, useMemo } from 'react';
import type { Folder, Item } from '../lib/schema';
import { compareSortKeys } from '../lib/sort-keys';
import { Button, Input, IconButton, Dialog, Menu, MenuItem } from '../ui';
import { Icon } from '../ui/icons';
import { TaskItem } from './TaskItem';

interface FolderViewProps {
  folder: Folder;
  items: Item[];
  folders: Folder[];
  onBack: () => void;
  onCreateTask: (title: string, parentId?: string) => void;
  onCompleteTask: (id: string, done: boolean) => void;
  onRenameTask: (id: string, newTitle: string) => void;
  onDeleteTask: (id: string) => void;
  onDuplicateTask: (id: string) => void;
  onPromoteSubtask: (id: string) => void;
  onMoveToFolder: (itemId: string, targetFolderId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
}

export function FolderView({
  folder,
  items,
  folders,
  onBack,
  onCreateTask,
  onCompleteTask,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onPromoteSubtask,
  onMoveToFolder,
  onRenameFolder,
  onDeleteFolder
}: FolderViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);

  const folderTasks = useMemo(() => {
    return items.filter((i) => i.folderId === folder.id);
  }, [items, folder.id]);

  const rootTasks = useMemo(() => {
    return folderTasks
      .filter((i) => i.parentId === null)
      .sort(compareSortKeys);
  }, [folderTasks]);

  const getSubtasks = (parentId: string) => {
    return folderTasks
      .filter((i) => i.parentId === parentId)
      .sort(compareSortKeys);
  };

  const handleCreate = () => {
    if (newTaskTitle.trim()) {
      onCreateTask(newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRenameFolder(folder.id, renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Folder Header */}
      <div className="p-4 border-b border-surface min-h-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconButton aria-label="Back to Home" onClick={onBack}>
            <Icon name="arrowLeft" />
          </IconButton>
          <Icon name="folder" className="text-accent" />
          <h1 className="font-bold text-lg text-text truncate max-w-xs">
            {folder.name}
          </h1>
        </div>

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <IconButton aria-label="Folder menu" onClick={() => setMenuOpen(!menuOpen)}>
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
                variant="danger"
                icon={<Icon name="trash" />}
                onClick={() => {
                  setMenuOpen(false);
                  onDeleteFolder(folder.id);
                  onBack();
                }}
              >
                Delete folder
              </MenuItem>
            </div>
          </Menu>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4">
        {rootTasks.length === 0 ? (
          <div className="text-text-muted text-center py-16 text-sm">
            No tasks in this folder. Add one below.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {rootTasks.map((task) => (
              <TaskItem
                key={task.id}
                item={task}
                subtasks={getSubtasks(task.id)}
                folders={folders}
                onComplete={onCompleteTask}
                onRename={onRenameTask}
                onDelete={onDeleteTask}
                onDuplicate={onDuplicateTask}
                onAddSubtask={(parentId, title) => onCreateTask(title, parentId)}
                onPromoteSubtask={onPromoteSubtask}
                onMoveToFolder={onMoveToFolder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Input Bar */}
      <div className="p-4 border-t border-surface flex items-center gap-2">
        <Input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder={`Add a task to ${folder.name}...`}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <IconButton
          aria-label="Add task"
          onClick={handleCreate}
          className="bg-accent text-background hover:opacity-90 shrink-0"
        >
          <Icon name="plus" />
        </IconButton>
      </div>

      {/* Rename Folder Dialog */}
      <Dialog isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Rename Folder</h3>
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
