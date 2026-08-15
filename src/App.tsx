import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import {
  createItem,
  createFolder,
  orphanSweep,
  deleteItem,
  deleteFolder,
  duplicateItem,
  promoteSubtask,
  moveItem
} from './lib/db';
import { generateKeyBetween } from './lib/sort-keys';
import type { Item, Folder } from './lib/schema';
import { HomeView } from './components/HomeView';
import { FolderView } from './components/FolderView';
import './App.css';

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    orphanSweep().catch(console.error);
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Item)));
    });
    const unsubFolders = onSnapshot(collection(db, 'folders'), (snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Folder)));
    });
    return () => {
      unsubItems();
      unsubFolders();
    };
  }, []);

  // Folder actions
  const handleCreateFolder = async (name: string) => {
    const lastKey = folders.length > 0 ? folders[folders.length - 1].sortKey : null;
    const sortKey = generateKeyBetween(lastKey, null);
    await createFolder({
      id: crypto.randomUUID(),
      ownerId: 'user-1',
      name,
      icon: 'folder',
      color: 'blue',
      sortKey,
      memberIds: ['user-1'],
      roles: { 'user-1': 'owner' },
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
  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  const handleCreateTask = async (title: string, parentId?: string) => {
    const targetFolderId = parentId
      ? items.find((i) => i.id === parentId)?.folderId ?? activeFolderId
      : activeFolderId;
    const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
    const memberIds = targetFolder ? targetFolder.memberIds : ['user-1'];

    await createItem({
      id: crypto.randomUUID(),
      folderId: targetFolderId,
      parentId: parentId || null,
      ownerId: 'user-1',
      memberIds,
      title,
      done: false,
      completedAt: null,
      reminder: null,
      updatedBy: 'user-1',
    });
  };

  const handleCompleteTask = async (id: string, done: boolean) => {
    const now = Timestamp.now();
    await updateDoc(doc(db, 'items', id), {
      done,
      completedAt: done ? now : null,
      updatedAt: now,
    });
  };

  const handleRenameTask = async (id: string, title: string) => {
    await updateDoc(doc(db, 'items', id), {
      title,
      updatedAt: Timestamp.now(),
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
    await moveItem(itemId, targetFolderId, 'user-1');
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-text">
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
        />
      )}
    </main>
  );
}

export default App;
