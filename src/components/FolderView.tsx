import { useState, useMemo, useEffect } from 'react';
import type { Folder, Item, Reminder } from '../lib/schema';
import { compareSortKeys } from '../lib/sort-keys';
import { calculateReorderKey } from '../lib/reorder';
import {
  getDefaultModeForContext,
  type InputMode,
  type AppContext
} from '../lib/unified-input';
import { useEdgeSwipeBack } from '../lib/useEdgeSwipeBack';
import {
  Button,
  Input,
  IconButton,
  Dialog,
  Menu,
  MenuItem,
  Icon,
  type IconName,
  getFolderColorStyle
} from '../ui';
import { TaskItem } from './TaskItem';
import { UnifiedInput } from './UnifiedInput';
import { SearchResultsView } from './SearchResultsView';
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
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

interface FolderViewProps {
  folder: Folder;
  items: Item[];
  folders: Folder[];
  currentUserId?: string;
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
  onReorderTask?: (taskId: string, newSortKey: string) => void;
  onUpdateFolder?: (folderId: string, updates: { icon?: string; color?: string }) => void;
  onSetReminder?: (itemId: string, reminder: Reminder | null) => void;
}

export function FolderView({
  folder,
  items,
  folders,
  currentUserId = '',
  onBack,
  onCreateTask,
  onCompleteTask,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onPromoteSubtask,
  onMoveToFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderTask,
  onUpdateFolder,
  onSetReminder
}: FolderViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<InputMode>('Create');

  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    })
  );

  const colorStyle = getFolderColorStyle(folder.color);
  const iconName = (folder.icon as IconName) || 'folder';

  const context: AppContext = useMemo(
    () => ({ folderId: folder.id, parentId: selectedTaskId }),
    [folder.id, selectedTaskId]
  );

  // Reset mode to default for context when selectedTaskId changes (§8)
  useEffect(() => {
    setMode(getDefaultModeForContext(context));
  }, [context]);

  // Selected parent task object
  const selectedParentTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return items.find((i) => i.id === selectedTaskId) || null;
  }, [items, selectedTaskId]);

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

  const handleSelectTask = (id: string) => {
    setSelectedTaskId((prev) => (prev === id ? null : id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderTask) return;

    const newKey = calculateReorderKey(
      rootTasks,
      active.id as string,
      over.id as string
    );

    if (newKey) {
      onReorderTask(active.id as string, newKey);
    }
  };

  const handleSubmit = (text: string, currentMode: InputMode) => {
    if (currentMode === 'Create') {
      onCreateTask(text);
    } else if (currentMode === 'Subtask') {
      if (selectedTaskId) {
        onCreateTask(text, selectedTaskId);
      } else {
        onCreateTask(text);
      }
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRenameFolder(folder.id, renameValue.trim());
    }
    setIsRenameOpen(false);
  };

  const edgeSwipe = useEdgeSwipeBack({ onBack });

  return (
    <div
      className="flex flex-col h-full w-full bg-background overflow-hidden relative"
      onTouchStart={edgeSwipe.handleTouchStart}
      onTouchMove={edgeSwipe.handleTouchMove}
      onTouchEnd={edgeSwipe.handleTouchEnd}
      style={edgeSwipe.style}
    >
      {/* Folder Header */}
      <div
        className="p-4 border-b min-h-header flex items-center justify-between shrink-0 transition-colors duration-fast"
        style={colorStyle.style}
      >
        <div className="flex items-center gap-2 min-w-0">
          <IconButton aria-label="Back to Home" onClick={onBack}>
            <Icon name="arrowLeft" />
          </IconButton>
          <Icon name={iconName} className="shrink-0" />
          <h1 className="font-bold text-lg truncate max-w-xs">
            {folder.name}
          </h1>
          {folder.memberIds && folder.memberIds.length > 1 && (
            <span
              className="flex items-center text-xs opacity-80 gap-1 px-2 py-0.5 rounded-full bg-surface"
              title={`Shared with ${folder.memberIds.length} members`}
            >
              <Icon name="user" />
              <span>{folder.memberIds.length}</span>
            </span>
          )}
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <IconButton aria-label="Folder menu" onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name="more" />
          </IconButton>
          <Menu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
            <div className="flex flex-col">
              <MenuItem
                icon={<Icon name="share" />}
                onClick={() => {
                  setMenuOpen(false);
                  setIsShareOpen(true);
                }}
              >
                Share
              </MenuItem>
              <MenuItem
                icon={<Icon name="palette" />}
                onClick={() => {
                  setMenuOpen(false);
                  setIsCustomizeOpen(true);
                }}
              >
                Icon & colour
              </MenuItem>
              <MenuItem
                icon={<Icon name="edit" />}
                onClick={() => {
                  setMenuOpen(false);
                  setRenameValue(folder.name);
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

      {/* Main Content Area */}
      {mode === 'Search' ? (
        <SearchResultsView
          query={query}
          items={items}
          folders={folders}
          context={context}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleSelectTask}
          onSelectFolder={() => {}}
          onCompleteTask={onCompleteTask}
          onRenameTask={onRenameTask}
          onDeleteTask={onDeleteTask}
          onDuplicateTask={onDuplicateTask}
          onPromoteSubtask={onPromoteSubtask}
          onMoveToFolder={onMoveToFolder}
          onCreateTask={onCreateTask}
          onSetReminder={onSetReminder}
        />
      ) : (
        /* Task List */
        <div className="flex-1 overflow-y-auto p-4">
          {rootTasks.length === 0 ? (
            <div className="text-text-muted text-center py-16 text-sm">
              No tasks in this folder. Add one below.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rootTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {rootTasks.map((task, index) => (
                    <TaskItem
                      key={task.id}
                      index={index}
                      item={task}
                      subtasks={getSubtasks(task.id)}
                      folders={folders}
                      isSelected={selectedTaskId === task.id}
                      onSelect={handleSelectTask}
                      onComplete={onCompleteTask}
                      onRename={onRenameTask}
                      onDelete={onDeleteTask}
                      onDuplicate={onDuplicateTask}
                      onAddSubtask={(parentId, title) => onCreateTask(title, parentId)}
                      onPromoteSubtask={onPromoteSubtask}
                      onMoveToFolder={onMoveToFolder}
                      onSetReminder={onSetReminder}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Unified Input Bar */}
      <UnifiedInput
        context={context}
        query={query}
        onQueryChange={setQuery}
        mode={mode}
        onModeChange={setMode}
        onSubmit={handleSubmit}
        parentTaskTitle={selectedParentTask?.title}
        onDeselectParent={() => setSelectedTaskId(null)}
      />

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
          <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRename}>
            Save
          </Button>
        </div>
      </Dialog>

      {/* Customize Folder Dialog */}
      <FolderCustomizeDialog
        isOpen={isCustomizeOpen}
        folder={folder}
        onClose={() => setIsCustomizeOpen(false)}
        onSave={(folderId, updates) => {
          if (onUpdateFolder) {
            onUpdateFolder(folderId, updates);
          }
        }}
      />

      {/* Share Folder Dialog */}
      <ShareFolderDialog
        isOpen={isShareOpen}
        folder={folder}
        currentUserId={currentUserId}
        onClose={() => setIsShareOpen(false)}
        onFolderLeft={onBack}
      />
    </div>
  );
}
