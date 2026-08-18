import { useMemo } from 'react';
import type { Item, Folder, Reminder } from '../lib/schema';
import { filterItemsBySearch, type AppContext } from '../lib/unified-input';
import { ListRow, IconButton } from '../ui';
import { Icon } from '../ui/icons';
import { TaskItem } from './TaskItem';
import { SubtaskItem } from './SubtaskItem';

interface SearchResultsViewProps {
  query: string;
  items: Item[];
  folders: Folder[];
  context: AppContext;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  onCompleteTask: (id: string, done: boolean) => void;
  onRenameTask: (id: string, newTitle: string) => void;
  onDeleteTask: (id: string) => void;
  onDuplicateTask: (id: string) => void;
  onPromoteSubtask: (id: string) => void;
  onMoveToFolder: (itemId: string, targetFolderId: string | null) => void;
  onCreateTask: (title: string, parentId?: string) => void;
  onSetReminder?: (itemId: string, reminder: Reminder | null) => void;
}

export function SearchResultsView({
  query,
  items,
  folders,
  context,
  selectedTaskId,
  onSelectTask,
  onSelectFolder,
  onCompleteTask,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  onPromoteSubtask,
  onMoveToFolder,
  onCreateTask,
  onSetReminder,
}: SearchResultsViewProps) {
  const searchResults = useMemo(() => {
    return filterItemsBySearch(query, items, folders, context);
  }, [query, items, folders, context]);

  const { matchingTasks, matchingSubtasks, matchingFolders } = searchResults;
  const totalResults = matchingTasks.length + matchingSubtasks.length + matchingFolders.length;

  const getSubtasksOf = (parentId: string) => {
    return items.filter((i) => i.parentId === parentId);
  };

  const getParentTask = (parentId: string | null) => {
    if (!parentId) return null;
    return items.find((i) => i.id === parentId) || null;
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return 'Inbox';
    const folder = folders.find((f) => f.id === folderId);
    return folder ? folder.name : 'Folder';
  };

  if (!query.trim()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-text-muted text-sm text-center">
        <Icon name="search" className="mb-2 opacity-50" />
        <p>Type to search across tasks{context.folderId === null ? ' and folders' : ''}…</p>
      </div>
    );
  }

  if (totalResults === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-text-muted text-sm text-center">
        <p>No results found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {/* Matching Folders */}
      {matchingFolders.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted px-2 py-1">
            Folders ({matchingFolders.length})
          </span>
          {matchingFolders.map((folder) => (
            <ListRow
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className="cursor-pointer hover:bg-surface-active"
            >
              <Icon name="folder" className="text-accent" />
              <span className="flex-1 truncate font-medium">{folder.name}</span>
              <IconButton
                aria-label={`Open folder ${folder.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFolder(folder.id);
                }}
              >
                <Icon name="chevronRight" />
              </IconButton>
            </ListRow>
          ))}
        </div>
      )}

      {/* Matching Tasks */}
      {matchingTasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted px-2 py-1">
            Tasks ({matchingTasks.length})
          </span>
          {matchingTasks.map((task) => (
            <div key={task.id} className="flex flex-col">
              {context.folderId === null && (
                <div className="px-2 pt-1">
                  <span className="text-xs text-text-muted">
                    in <span className="font-medium text-text">{getFolderName(task.folderId)}</span>
                  </span>
                </div>
              )}
              <TaskItem
                item={task}
                subtasks={getSubtasksOf(task.id)}
                folders={folders}
                isSelected={selectedTaskId === task.id}
                onSelect={onSelectTask}
                onComplete={onCompleteTask}
                onRename={onRenameTask}
                onDelete={onDeleteTask}
                onDuplicate={onDuplicateTask}
                onAddSubtask={(parentId, title) => onCreateTask(title, parentId)}
                onPromoteSubtask={onPromoteSubtask}
                onMoveToFolder={onMoveToFolder}
                onSetReminder={onSetReminder}
              />
            </div>
          ))}
        </div>
      )}

      {/* Matching Subtasks */}
      {matchingSubtasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted px-2 py-1">
            Subtasks ({matchingSubtasks.length})
          </span>
          {matchingSubtasks.map((subtask) => {
            const parent = getParentTask(subtask.parentId);
            return (
              <div key={subtask.id} className="flex flex-col">
                <div className="px-2 pt-1">
                  <span className="text-xs text-text-muted">
                    subtask of <span className="font-medium text-text">{parent ? parent.title : 'Task'}</span>
                    {context.folderId === null && (
                      <> in <span className="font-medium text-text">{getFolderName(subtask.folderId)}</span></>
                    )}
                  </span>
                </div>
                <SubtaskItem
                  subtask={subtask}
                  onComplete={onCompleteTask}
                  onRename={onRenameTask}
                  onDelete={onDeleteTask}
                  onPromote={onPromoteSubtask}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
