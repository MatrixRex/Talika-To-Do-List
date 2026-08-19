import { useState, useMemo, useEffect } from 'react';
import type { Folder, Item, Reminder } from '../lib/schema';
import { compareSortKeys } from '../lib/sort-keys';
import { calculateReorderKey } from '../lib/reorder';
import {
  getDefaultModeForContext,
  type InputMode,
  type AppContext
} from '../lib/unified-input';
import { Icon } from '../ui/icons';
import { TaskItem } from './TaskItem';
import { FolderGrid } from './FolderGrid';
import { UnifiedInput } from './UnifiedInput';
import { SearchResultsView } from './SearchResultsView';
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

interface HomeViewProps {
  items: Item[];
  folders: Folder[];
  currentUserId?: string;
  onSelectFolder: (id: string | null) => void;
  onCreateTask: (title: string, parentId?: string) => void;
  onCompleteTask: (id: string, done: boolean) => void;
  onRenameTask: (id: string, newTitle: string) => void;
  onDeleteTask: (id: string) => void;
  onDuplicateTask: (id: string) => void;
  onPromoteSubtask: (id: string) => void;
  onMoveToFolder: (itemId: string, targetFolderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorderTask?: (taskId: string, newSortKey: string) => void;
  onReorderFolder?: (folderId: string, newSortKey: string) => void;
  onUpdateFolder?: (folderId: string, updates: { icon?: string; color?: string }) => void;
  onSetReminder?: (itemId: string, reminder: Reminder | null) => void;
}

export function HomeView({
  items,
  folders,
  currentUserId = '',
  onSelectFolder,
  onCreateTask,
  onCompleteTask,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onPromoteSubtask,
  onMoveToFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderTask,
  onReorderFolder,
  onUpdateFolder,
  onSetReminder
}: HomeViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<InputMode>('Create');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    })
  );

  const context: AppContext = useMemo(
    () => ({ folderId: null, parentId: selectedTaskId }),
    [selectedTaskId]
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

  // Default folder items (folderId === null)
  const defaultItems = useMemo(() => {
    return items.filter((i) => i.folderId === null);
  }, [items]);

  const defaultRootTasks = useMemo(() => {
    return defaultItems
      .filter((i) => i.parentId === null)
      .sort(compareSortKeys);
  }, [defaultItems]);

  const getSubtasks = (parentId: string) => {
    return defaultItems
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
      defaultRootTasks,
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

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {mode === 'Search' ? (
        <SearchResultsView
          query={query}
          items={items}
          folders={folders}
          context={context}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleSelectTask}
          onSelectFolder={onSelectFolder}
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
        <>
          {/* Top Pane: Default Tasks (Inbox) */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-surface-border">
            <div className="p-4 border-b border-surface-border min-h-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="inbox" className="text-text-muted" />
                <h1 className="font-bold text-base text-text">Inbox</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted">
                  {defaultRootTasks.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {defaultRootTasks.length === 0 ? (
                <div className="text-text-muted text-center py-12 text-sm">
                  Inbox zero. Add a task below.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={defaultRootTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-1">
                      {defaultRootTasks.map((task) => (
                        <TaskItem
                          key={task.id}
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
          </div>

          {/* Bottom Pane: Folders Grid */}
          <div className="shrink-0 bg-background border-b border-surface-border">
            <FolderGrid
              folders={folders}
              items={items}
              activeFolderId={null}
              currentUserId={currentUserId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onReorderFolder={onReorderFolder}
              onUpdateFolder={onUpdateFolder}
            />
          </div>
        </>
      )}

      {/* Very Bottom: Unified Input Bar */}
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
    </div>
  );
}
