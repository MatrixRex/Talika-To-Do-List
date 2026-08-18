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
  setReminder
} from './lib/db';
import { generateKeyBetween } from './lib/sort-keys';
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
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
    });

    const qFolders = query(
      collection(db, 'folders'),
      where('memberIds', 'array-contains', firebaseUser.uid)
    );
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Folder)));
    });

    return () => {
      unsubItems();
      unsubFolders();
    };
  }, [firebaseUser]);

  // Reschedule local notifications whenever items change
  useEffect(() => {
    if (items.length > 0) {
      rescheduleAllReminders(items).catch(console.error);
    }
  }, [items]);

  if (loading) {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-text-muted">
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
    const lastKey = folders.length > 0 ? folders[folders.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    await createFolder({
      id: crypto.randomUUID(),
      ownerId: firebaseUser.uid,
      name,
      icon: 'folder',
      color: 'blue',
      sortKey,
      memberIds: [firebaseUser.uid],
      roles: { [firebaseUser.uid]: 'owner' },
    });
  };

  const handleRenameFolder = async (id: string, name: string) => {
    await updateDoc(doc(db, 'folders', id), { name, updatedAt: Timestamp.now() });
  };

  const handleDeleteFolder = async (id: string) => {
    if (activeFolderId === id) setActiveFolderId(null);
    await deleteFolder(id);
  };

  // Task actions
  const handleCreateTask = async (title: string, parentId?: string) => {
    const targetFolderId = parentId
      ? items.find((i) => i.id === parentId)?.folderId ?? activeFolderId
      : activeFolderId;
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
    const memberIds = targetFolder ? targetFolder.memberIds : [firebaseUser.uid];

    await createItem({
      id: crypto.randomUUID(),
      folderId: targetFolderId,
      parentId: parentId || null,
      ownerId: firebaseUser.uid,
      memberIds,
      title,
      done: false,
      completedAt: null,
      reminder: null,
      updatedBy: firebaseUser.uid,
    });
  };

  const handleCompleteTask = async (id: string, done: boolean) => {
    const now = Timestamp.now();
    await updateDoc(doc(db, 'items', id), {
      done,
      completedAt: done ? now : null,
      updatedAt: now,
      updatedBy: firebaseUser.uid,
    });
  };

  const handleRenameTask = async (id: string, title: string) => {
    await updateDoc(doc(db, 'items', id), {
      title,
      updatedAt: Timestamp.now(),
      updatedBy: firebaseUser.uid,
    });
  };

  const handleDeleteTask = async (id: string) => {
    await deleteItem(id);
  };

  const handleDuplicateTask = async (id: string) => {
    await duplicateItem(id);
  };

  const handlePromoteSubtask = async (id: string) => {
    await promoteSubtask(id);
  };

  const handleMoveToFolder = async (itemId: string, targetFolderId: string | null) => {
    await moveItem(itemId, targetFolderId, firebaseUser.uid);
  };

  const handleSetReminder = async (itemId: string, reminder: Reminder | null) => {
    await setReminder(itemId, reminder, firebaseUser.uid);
  };

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background text-text">
      <AuthBar />
      <div className="flex-1 overflow-hidden">
        {activeFolder ? (
          <FolderView
            folder={activeFolder}
            items={items}
            folders={folders}
            onBack={() => setActiveFolderId(null)}
            onCreateTask={handleCreateTask}
            onCompleteTask={handleCompleteTask}
            onRenameTask={handleRenameTask}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={handleDuplicateTask}
            onPromoteSubtask={handlePromoteSubtask}
            onMoveToFolder={handleMoveToFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onSetReminder={handleSetReminder}
          />
        ) : (
          <HomeView
            items={items}
            folders={folders}
            onSelectFolder={setActiveFolderId}
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
