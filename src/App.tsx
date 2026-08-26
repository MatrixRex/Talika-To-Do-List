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
  updateFolder,
  getFolderPreview,
  joinFolder
} from './lib/db';
import { generateKeyBetween, compareSortKeys } from './lib/sort-keys';
import { generateUUID } from './lib/uuid';
import { parseJoinFolderId } from './lib/share-links';
import type { Item, Folder, Reminder, User } from './lib/schema';
import { useFilteredItems } from './lib/useFilteredItems';
import { rescheduleAllReminders } from './lib/notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthBar } from './components/AuthBar';
import { LoginView } from './components/LoginView';
import { HomeView } from './components/HomeView';
import { FolderView } from './components/FolderView';
import { JoinFolderDialog } from './components/JoinFolderDialog';
import './App.css';

function MainApp() {
  const { firebaseUser, userProfile, loading } = useAuth();
  const [rawItems, setItems] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [pendingJoinFolderId, setPendingJoinFolderId] = useState<string | null>(null);
  const [joinPreview, setJoinPreview] = useState<{ folder: Folder; owner: User | null } | null>(null);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  const hideCompleted = userProfile?.prefs?.hideCompletedTasks ?? true;
  const items = useFilteredItems(rawItems, hideCompleted);

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

  // Synchronize folder navigation & share join links with browser history
  useEffect(() => {
    const handleHashAndPopState = (e?: Event) => {
      const hash = window.location.hash;
      const joinId = parseJoinFolderId(hash);
      if (joinId) {
        setPendingJoinFolderId(joinId);
      } else if (hash.startsWith('#folder-')) {
        const fid = hash.replace('#folder-', '');
        setActiveFolderId(fid || null);
      } else {
        const state = (e && 'state' in e ? (e as PopStateEvent).state : window.history.state) as { folderId?: string | null } | null;
        setActiveFolderId(state?.folderId || null);
      }
    };

    handleHashAndPopState();
    window.addEventListener('popstate', handleHashAndPopState);
    window.addEventListener('hashchange', handleHashAndPopState);
    return () => {
      window.removeEventListener('popstate', handleHashAndPopState);
      window.removeEventListener('hashchange', handleHashAndPopState);
    };
  }, []);

  // Handle folder share link join preview & verification
  useEffect(() => {
    if (!firebaseUser || !pendingJoinFolderId) return;

    // Check if user is already a member of this folder
    const existingFolder = folders.find((f) => f.id === pendingJoinFolderId);
    if (existingFolder) {
      handleSelectFolder(pendingJoinFolderId);
      setPendingJoinFolderId(null);
      return;
    }

    getFolderPreview(pendingJoinFolderId)
      .then((preview) => {
        if (preview) {
          if (preview.folder.memberIds.includes(firebaseUser.uid)) {
            handleSelectFolder(pendingJoinFolderId);
            setPendingJoinFolderId(null);
          } else {
            setJoinPreview(preview);
            setIsJoinDialogOpen(true);
          }
        } else {
          console.warn('Folder not found for join link:', pendingJoinFolderId);
          setPendingJoinFolderId(null);
          window.history.replaceState(null, '', window.location.pathname);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch join preview:', err);
        setPendingJoinFolderId(null);
      });
  }, [firebaseUser, pendingJoinFolderId, folders]);

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
    } else {
      window.history.pushState(null, '', window.location.pathname);
    }
    setActiveFolderId(id);
  };

  const handleBackToHome = () => {
    if (window.history.state?.folderId) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.pathname);
      setActiveFolderId(null);
    }
  };

  const handleJoinConfirm = async () => {
    if (!joinPreview || !firebaseUser) return;
    const targetFolderId = joinPreview.folder.id;
    await joinFolder(targetFolderId, firebaseUser.uid);
    setIsJoinDialogOpen(false);
    setJoinPreview(null);
    setPendingJoinFolderId(null);
    handleSelectFolder(targetFolderId);
  };

  const handleJoinDecline = () => {
    setIsJoinDialogOpen(false);
    setJoinPreview(null);
    setPendingJoinFolderId(null);
    window.history.replaceState(null, '', window.location.pathname);
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
    const parentItem = parentId ? rawItems.find((i) => i.id === parentId) || null : null;
    const targetFolderId = parentItem
      ? parentItem.folderId
      : activeFolderId;
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) || null : null;

    const folderId = parentItem ? parentItem.folderId : targetFolderId;
    const memberIds = parentItem
      ? parentItem.memberIds
      : (targetFolder ? targetFolder.memberIds : [firebaseUser.uid]);
    const ownerId = parentItem
      ? parentItem.ownerId
      : (targetFolder ? targetFolder.ownerId : firebaseUser.uid);

    const siblingItems = rawItems
      .filter((i) => i.folderId === folderId && i.parentId === (parentId || null))
      .sort(compareSortKeys);
    const lastKey = siblingItems.length > 0 ? siblingItems[siblingItems.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    const now = Timestamp.now();

    const newItem: Item = {
      id: generateUUID(),
      folderId,
      parentId: parentId || null,
      ownerId,
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
    const subtask = rawItems.find((i) => i.id === id);
    if (!subtask || !subtask.parentId) return;

    const rootItems = rawItems
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
    const newOwnerId = targetFolder ? (rawItems.find((i) => i.id === itemId)?.ownerId || firebaseUser.uid) : firebaseUser.uid;
    const newMemberIds = targetFolder ? targetFolder.memberIds : [firebaseUser.uid];
    const isTargetShared = newMemberIds.length > 1;

    const targetItems = rawItems
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
    <main
      className="h-dvh w-screen flex flex-col overflow-hidden bg-background text-text"
      data-fast-mode={userProfile?.prefs?.fastMode ? 'true' : 'false'}
      data-reduce-animations={userProfile?.prefs?.reduceAnimations ? 'true' : 'false'}
    >
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
      <JoinFolderDialog
        isOpen={isJoinDialogOpen}
        folder={joinPreview?.folder || null}
        owner={joinPreview?.owner || null}
        onJoin={handleJoinConfirm}
        onClose={handleJoinDecline}
      />
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
