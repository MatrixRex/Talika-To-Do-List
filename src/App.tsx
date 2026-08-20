import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import {
  createItem,
  createFolder,
  orphanSweep,
  deleteItem,
  deleteFolder,
  duplicateItem,
  promoteSubtask,
  moveItem,
  setReminder,
  reorderItem,
  reorderFolder,
  updateFolder
} from './lib/db';
import { generateKeyBetween, compareSortKeys } from './lib/sort-keys';
import { generateUUID } from './lib/uuid';
import type { Item, Folder, Reminder } from './lib/schema';
import { rescheduleAllReminders } from './lib/notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthBar } from './components/AuthBar';
import { LoginView } from './components/LoginView';
import { HomeView } from './components/HomeView';
import { FolderView } from './components/FolderView';
import './App.css';

function MainApp() {
  const { firebaseUser, loading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setItems([]);
      setFolders([]);
      return;
    }

    orphanSweep().catch(console.error);

    const qItems = query(
      collection(db, 'items'),
      where('memberIds', 'array-contains', firebaseUser.uid)
    );
    const unsubItems = onSnapshot(qItems, (snap) => {
      const serverItems = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
      setItems((prev) => {
        const serverIds = new Set(serverItems.map((i) => i.id));
        const pendingOptimistic = prev.filter((i) => !serverIds.has(i.id));
        return [...serverItems, ...pendingOptimistic];
      });
    });

    const qFolders = query(
      collection(db, 'folders'),
      where('memberIds', 'array-contains', firebaseUser.uid)
    );
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      const serverFolders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Folder));
      setFolders((prev) => {
        const serverIds = new Set(serverFolders.map((f) => f.id));
        const pendingOptimistic = prev.filter((f) => !serverIds.has(f.id));
        return [...serverFolders, ...pendingOptimistic];
      });
    });

    return () => {
      unsubItems();
      unsubFolders();
    };
  }, [firebaseUser]);

  // Reschedule local and web notifications whenever items change
  useEffect(() => {
    rescheduleAllReminders(items).catch(console.error);
  }, [items]);

  // Synchronize folder navigation with browser history for back gesture & button support
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { folderId?: string | null } | null;
      setActiveFolderId(state?.folderId || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Capacitor Android hardware back button
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        return CapApp.addListener('backButton', ({ canGoBack }) => {
          if (activeFolderId) {
            handleBackToHome();
          } else if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });
      })
      .then((handle) => {
        if (handle) {
          removeListener = () => handle.remove();
        }
      })
      .catch(() => {
        // Non-Capacitor environment
      });

    return () => {
      if (removeListener) removeListener();
    };
  }, [activeFolderId]);

  const handleSelectFolder = (id: string | null) => {
    if (id) {
      window.history.pushState({ folderId: id }, '', `#folder-${id}`);
    }
    setActiveFolderId(id);
  };

  const handleBackToHome = () => {
    if (window.history.state?.folderId) {
      window.history.back();
    } else {
      setActiveFolderId(null);
    }
  };

  if (loading) {
    return (
      <main className="h-dvh w-screen flex items-center justify-center bg-background text-text-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Loading Talika…</p>
        </div>
      </main>
    );
  }

  if (!firebaseUser) {
    return <LoginView />;
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  // Folder actions
  const handleCreateFolder = async (name: string) => {
    const sortedFolders = [...folders].sort(compareSortKeys);
    const lastKey = sortedFolders.length > 0 ? sortedFolders[sortedFolders.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    const newFolder: Folder = {
      id: generateUUID(),
      ownerId: firebaseUser.uid,
      name,
      icon: 'folder',
      color: 'blue',
      sortKey,
      memberIds: [firebaseUser.uid],
      roles: { [firebaseUser.uid]: 'owner' },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Optimistic UI update
    setFolders((prev) => [...prev, newFolder]);

    try {
      await createFolder(newFolder);
    } catch (err) {
      console.error('Failed to create folder', err);
      setFolders((prev) => prev.filter((f) => f.id !== newFolder.id));
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const prevFolders = folders;
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name, updatedAt: Timestamp.now() } : f))
    );
    try {
      await updateDoc(doc(db, 'folders', id), { name, updatedAt: Timestamp.now() });
    } catch (err) {
      console.error('Failed to rename folder', err);
      setFolders(prevFolders);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (activeFolderId === id) handleBackToHome();
    const prevFolders = folders;
    const prevItems = items;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) => prev.filter((i) => i.folderId !== id));
    try {
      await deleteFolder(id);
    } catch (err) {
      console.error('Failed to delete folder', err);
      setFolders(prevFolders);
      setItems(prevItems);
    }
  };

  const handleUpdateFolder = async (
    id: string,
    updates: { icon?: string; color?: string }
  ) => {
    const prevFolders = folders;
    setFolders((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, ...updates, updatedAt: Timestamp.now() } : f
      )
    );
    try {
      await updateFolder(id, updates);
    } catch (err) {
      console.error('Failed to update folder', err);
      setFolders(prevFolders);
    }
  };

  const handleReorderFolder = async (folderId: string, newSortKey: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, sortKey: newSortKey, updatedAt: Timestamp.now() } : f
      )
    );
    try {
      await reorderFolder(folderId, newSortKey);
    } catch (err) {
      console.error('Failed to reorder folder', err);
    }
  };

  // Task actions
  const handleCreateTask = async (title: string, parentId?: string) => {
    const targetFolderId = parentId
      ? items.find((i) => i.id === parentId)?.folderId ?? activeFolderId
      : activeFolderId;
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) || null : null;
    const memberIds = targetFolder ? targetFolder.memberIds : [firebaseUser.uid];

    const parentItem = parentId ? items.find((i) => i.id === parentId) || null : null;
    const siblingItems = items
      .filter((i) => i.folderId === targetFolderId && i.parentId === (parentId || null))
      .sort(compareSortKeys);
    const lastKey = siblingItems.length > 0 ? siblingItems[siblingItems.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    const now = Timestamp.now();

    const newItem: Item = {
      id: generateUUID(),
      folderId: targetFolderId,
      parentId: parentId || null,
      ownerId: firebaseUser.uid,
      memberIds,
      title,
      done: false,
      completedAt: null,
      sortKey,
      reminder: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: firebaseUser.uid,
    };

    // Optimistic UI update
    setItems((prev) => [...prev, newItem]);

    try {
      await createItem(newItem, parentItem, targetFolder);
    } catch (err) {
      console.error('Failed to create task', err);
      setItems((prev) => prev.filter((i) => i.id !== newItem.id));
    }
  };

  const handleCompleteTask = async (id: string, done: boolean) => {
    const now = Timestamp.now();
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              done,
              completedAt: done ? now : null,
              updatedAt: now,
              updatedBy: firebaseUser.uid,
            }
          : i
      )
    );
    try {
      await updateDoc(doc(db, 'items', id), {
        done,
        completedAt: done ? now : null,
        updatedAt: now,
        updatedBy: firebaseUser.uid,
      });
    } catch (err) {
      console.error('Failed to complete task', err);
    }
  };

  const handleRenameTask = async (id: string, title: string) => {
    const now = Timestamp.now();
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              title,
              updatedAt: now,
              updatedBy: firebaseUser.uid,
            }
          : i
      )
    );
    try {
      await updateDoc(doc(db, 'items', id), {
        title,
        updatedAt: now,
        updatedBy: firebaseUser.uid,
      });
    } catch (err) {
      console.error('Failed to rename task', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== id && i.parentId !== id));
    try {
      await deleteItem(id);
    } catch (err) {
      console.error('Failed to delete task', err);
      setItems(prevItems);
    }
  };

  const handleDuplicateTask = async (id: string) => {
    try {
      await duplicateItem(id);
    } catch (err) {
      console.error('Failed to duplicate task', err);
    }
  };

  const handlePromoteSubtask = async (id: string) => {
    const subtask = items.find((i) => i.id === id);
    if (!subtask || !subtask.parentId) return;

    const rootItems = items
      .filter((i) => i.folderId === subtask.folderId && i.parentId === null)
      .sort(compareSortKeys);
    const lastKey = rootItems.length > 0 ? rootItems[rootItems.length - 1].sortKey : null;
    const newSortKey = generateKeyBetween(lastKey, null);
    const now = Timestamp.now();

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              parentId: null,
              sortKey: newSortKey,
              updatedAt: now,
              updatedBy: firebaseUser.uid,
            }
          : i
      )
    );

    try {
      await promoteSubtask(id);
    } catch (err) {
      console.error('Failed to promote subtask', err);
    }
  };

  const handleMoveToFolder = async (itemId: string, targetFolderId: string | null) => {
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) || null : null;
    const newOwnerId = targetFolder ? (items.find((i) => i.id === itemId)?.ownerId || firebaseUser.uid) : firebaseUser.uid;
    const newMemberIds = targetFolder ? targetFolder.memberIds : [firebaseUser.uid];
    const isTargetShared = newMemberIds.length > 1;

    const targetItems = items
      .filter((i) => i.folderId === targetFolderId && i.parentId === null)
      .sort(compareSortKeys);
    const firstKey = targetItems.length > 0 ? targetItems[0].sortKey : null;
    const newSortKey = generateKeyBetween(null, firstKey);
    const now = Timestamp.now();

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            folderId: targetFolderId,
            parentId: null,
            ownerId: newOwnerId,
            memberIds: newMemberIds,
            sortKey: newSortKey,
            reminder: isTargetShared ? null : i.reminder,
            updatedAt: now,
            updatedBy: firebaseUser.uid,
          };
        }
        if (i.parentId === itemId) {
          return {
            ...i,
            folderId: targetFolderId,
            ownerId: newOwnerId,
            memberIds: newMemberIds,
            updatedAt: now,
            updatedBy: firebaseUser.uid,
          };
        }
        return i;
      })
    );

    try {
      await moveItem(itemId, targetFolderId, firebaseUser.uid);
    } catch (err) {
      console.error('Failed to move item', err);
    }
  };

  const handleSetReminder = async (itemId: string, reminder: Reminder | null) => {
    const now = Timestamp.now();
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              reminder,
              updatedAt: now,
              updatedBy: firebaseUser.uid,
            }
          : i
      )
    );
    try {
      await setReminder(itemId, reminder, firebaseUser.uid);
    } catch (err) {
      console.error('Failed to set reminder', err);
    }
  };

  const handleReorderTask = async (taskId: string, newSortKey: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === taskId
          ? {
              ...i,
              sortKey: newSortKey,
              updatedAt: Timestamp.now(),
              updatedBy: firebaseUser.uid,
            }
          : i
      )
    );
    try {
      await reorderItem(taskId, newSortKey);
    } catch (err) {
      console.error('Failed to reorder task', err);
    }
  };

  return (
    <main className="h-dvh w-screen flex flex-col overflow-hidden bg-background text-text">
      <AuthBar />
      <div className="flex-1 overflow-hidden">
        {activeFolder ? (
          <FolderView
            folder={activeFolder}
            items={items}
            folders={folders}
            currentUserId={firebaseUser.uid}
            onBack={handleBackToHome}
            onCreateTask={handleCreateTask}
            onCompleteTask={handleCompleteTask}
            onRenameTask={handleRenameTask}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={handleDuplicateTask}
            onPromoteSubtask={handlePromoteSubtask}
            onMoveToFolder={handleMoveToFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onReorderTask={handleReorderTask}
            onUpdateFolder={handleUpdateFolder}
            onSetReminder={handleSetReminder}
          />
        ) : (
          <HomeView
            items={items}
            folders={folders}
            currentUserId={firebaseUser.uid}
            onSelectFolder={handleSelectFolder}
            onCreateTask={handleCreateTask}
            onCompleteTask={handleCompleteTask}
            onRenameTask={handleRenameTask}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={handleDuplicateTask}
            onPromoteSubtask={handlePromoteSubtask}
            onMoveToFolder={handleMoveToFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onReorderTask={handleReorderTask}
            onReorderFolder={handleReorderFolder}
            onUpdateFolder={handleUpdateFolder}
            onSetReminder={handleSetReminder}
          />
        )}
      </div>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
