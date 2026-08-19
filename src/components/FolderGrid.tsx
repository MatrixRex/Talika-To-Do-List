import { useState, useMemo } from 'react';
import type { Folder, Item } from '../lib/schema';
import { compareSortKeys } from '../lib/sort-keys';
import { calculateReorderKey } from '../lib/reorder';
import {
  Card,
  Button,
  Input,
  Dialog,
  Menu,
  MenuItem,
  IconButton,
  Icon,
  type IconName,
  getFolderColorStyle
} from '../ui';
import { FolderCustomizeDialog } from './FolderCustomizeDialog';
import { ShareFolderDialog } from './ShareFolderDialog';
import {
  DndContext,
  closestCenter,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderGridProps {
  folders: Folder[];
  items: Item[];
  activeFolderId: string | null;
  currentUserId?: string;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorderFolder?: (folderId: string, newSortKey: string) => void;
  onUpdateFolder?: (folderId: string, updates: { icon?: string; color?: string }) => void;
}

export function FolderGrid({
  folders,
  items,
  activeFolderId,
  currentUserId = '',
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderFolder,
  onUpdateFolder
}: FolderGridProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customizingFolder, setCustomizingFolder] = useState<Folder | null>(null);
  const [sharingFolder, setSharingFolder] = useState<Folder | null>(null);

  const sortedFolders = useMemo(() => {
    return [...folders].sort(compareSortKeys);
  }, [folders]);

  // Touch and pointer sensors configured so standard taps / context menus are smooth
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderFolder) return;

    const newKey = calculateReorderKey(
      sortedFolders,
      active.id as string,
      over.id as string
    );

    if (newKey) {
      onReorderFolder(active.id as string, newKey);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between p-4 border-b border-surface-border min-h-header">
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedFolders.map((f) => f.id)}
          strategy={rectSortingStrategy}
        >
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-64">
            {sortedFolders.map((folder) => (
              <SortableFolderCard
                key={folder.id}
                folder={folder}
                itemCount={getFolderItemCount(folder.id)}
                isActive={activeFolderId === folder.id}
                onSelect={() => onSelectFolder(folder.id)}
                onRename={(newName) => onRenameFolder(folder.id, newName)}
                onDelete={() => onDeleteFolder(folder.id)}
                onCustomize={() => setCustomizingFolder(folder)}
                onShare={() => setSharingFolder(folder)}
              />
            ))}

            {folders.length === 0 && (
              <div className="col-span-full text-center py-6 text-text-muted text-sm">
                No folders created yet. Tap + to organize tasks.
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

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
          <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create
          </Button>
        </div>
      </Dialog>

      {/* Customize Folder Dialog */}
      <FolderCustomizeDialog
        isOpen={customizingFolder !== null}
        folder={customizingFolder}
        onClose={() => setCustomizingFolder(null)}
        onSave={(folderId, updates) => {
          if (onUpdateFolder) {
            onUpdateFolder(folderId, updates);
          }
        }}
      />

      {/* Share Folder Dialog */}
      <ShareFolderDialog
        isOpen={sharingFolder !== null}
        folder={sharingFolder}
        currentUserId={currentUserId}
        onClose={() => setSharingFolder(null)}
      />
    </div>
  );
}

function SortableFolderCard({
  folder,
  itemCount,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onCustomize,
  onShare
}: {
  folder: Folder;
  itemCount: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onCustomize: () => void;
  onShare: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: folder.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);

  const colorStyle = getFolderColorStyle(folder.color);
  const iconName = (folder.icon as IconName) || 'folder';
  const isShared = folder.memberIds && folder.memberIds.length > 1;

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRename(renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  return (
    <div ref={setNodeRef} style={sortableStyle} {...attributes} {...listeners}>
      <Card
        className={`cursor-pointer flex flex-col justify-between min-h-card transition-colors duration-fast hover:opacity-90 relative border ${
          isActive ? 'ring-2 ring-accent' : ''
        }`}
        style={colorStyle.style}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name={iconName} className="shrink-0" />
            {isShared && (
              <span className="flex items-center text-[11px] opacity-80 gap-0.5 px-1.5 py-0.5 rounded-full bg-surface" title={`Shared with ${folder.memberIds.length} members`}>
                <Icon name="user" />
                <span className="text-[10px]">{folder.memberIds.length}</span>
              </span>
            )}
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <IconButton
              aria-label="Folder actions"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="more" />
            </IconButton>
            <Menu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
              <div className="flex flex-col">
                <MenuItem
                  icon={<Icon name="share" />}
                  onClick={() => {
                    setMenuOpen(false);
                    onShare();
                  }}
                >
                  Share
                </MenuItem>
                <MenuItem
                  icon={<Icon name="palette" />}
                  onClick={() => {
                    setMenuOpen(false);
                    onCustomize();
                  }}
                >
                  Icon & colour
                </MenuItem>
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
          <div className="font-semibold text-sm truncate">{folder.name}</div>
          <div className="text-xs opacity-75">
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
          <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRename}>
            Save
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
