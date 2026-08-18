import { useState, useMemo } from 'react';
import type { Folder, Item } from '../lib/schema';
import { compareSortKeys } from '../lib/sort-keys';
import { Card, Button, Input, Dialog, Menu, MenuItem, IconButton } from '../ui';
import { Icon } from '../ui/icons';

interface FolderGridProps {
  folders: Folder[];
  items: Item[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
}

export function FolderGrid({
  folders,
  items,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder
}: FolderGridProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const sortedFolders = useMemo(() => {
    return [...folders].sort(compareSortKeys);
  }, [folders]);

  const handleCreate = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreateOpen(false);
    }
  };

  const getFolderItemCount = (folderId: string) => {
    return items.filter((i) => i.folderId === folderId && i.parentId === null).length;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between p-4 border-b border-surface min-h-header">
        <div className="flex items-center gap-2">
          <Icon name="folder" className="text-accent" />
          <h2 className="font-bold text-base text-text">Folders</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted">
            {sortedFolders.length}
          </span>
        </div>
        <IconButton aria-label="Create new folder" onClick={() => setIsCreateOpen(true)}>
          <Icon name="plus" />
        </IconButton>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-64">
        {sortedFolders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            itemCount={getFolderItemCount(folder.id)}
            isActive={activeFolderId === folder.id}
            onSelect={() => onSelectFolder(folder.id)}
            onRename={(newName) => onRenameFolder(folder.id, newName)}
            onDelete={() => onDeleteFolder(folder.id)}
          />
        ))}

        {folders.length === 0 && (
          <div className="col-span-full text-center py-6 text-text-muted text-sm">
            No folders created yet. Tap + to organize tasks.
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <h3 className="text-lg font-bold mb-4 text-text">Create Folder</h3>
        <Input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Folder name"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate}>Create</Button>
        </div>
      </Dialog>
    </div>
  );
}

function FolderCard({
  folder,
  itemCount,
  isActive,
  onSelect,
  onRename,
  onDelete
}: {
  folder: Folder;
  itemCount: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRename(renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  return (
    <>
      <Card
        className={`cursor-pointer flex flex-col justify-between min-h-card transition-all hover:bg-surface-active relative ${
          isActive ? 'ring-2 ring-accent' : ''
        }`}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <Icon name="folder" className="text-accent" />
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <IconButton aria-label="Folder actions" onClick={() => setMenuOpen(!menuOpen)}>
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
                    onDelete();
                  }}
                >
                  Delete
                </MenuItem>
              </div>
            </Menu>
          </div>
        </div>

        <div className="mt-2">
          <div className="font-semibold text-sm truncate text-text">{folder.name}</div>
          <div className="text-xs text-text-muted">
            {itemCount} {itemCount === 1 ? 'task' : 'tasks'}
          </div>
        </div>
      </Card>

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
    </>
  );
}
