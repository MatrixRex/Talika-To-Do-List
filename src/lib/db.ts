import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  Firestore
} from 'firebase/firestore';
import { db } from './firebase';
import { generateKeyBetween } from './sort-keys';
import { validateItemContext } from './schema';
import type { Item, Folder, User } from './schema';

const BATCH_LIMIT = 500;

export async function firstKeyIn(folderId: string | null, parentId: string | null): Promise<string | null> {
  const itemsRef = collection(db, 'items');
  const q = query(
    itemsRef,
    where('folderId', '==', folderId),
    where('parentId', '==', parentId),
    orderBy('sortKey', 'asc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().sortKey;
}

export async function createItem(
  item: Omit<Item, 'createdAt' | 'updatedAt' | 'sortKey'>
): Promise<Item> {
  let parentItem: Item | null = null;
  if (item.parentId) {
    const parentSnap = await getDoc(doc(db, 'items', item.parentId));
    if (parentSnap.exists()) {
      parentItem = parentSnap.data() as Item;
    }
  }

  let folder: Folder | null = null;
  if (item.folderId) {
    const folderSnap = await getDoc(doc(db, 'folders', item.folderId));
    if (folderSnap.exists()) {
      folder = folderSnap.data() as Folder;
    }
  }

  const now = Timestamp.now();
  const firstKey = await firstKeyIn(item.folderId, item.parentId);
  const sortKey = generateKeyBetween(null, firstKey);
  
  const fullItem: Item = {
    ...item,
    sortKey,
    createdAt: now,
    updatedAt: now
  };

  validateItemContext(fullItem, parentItem, folder);

  await setDoc(doc(db, 'items', fullItem.id), fullItem);
  return fullItem;
}

export async function updateItem(
  itemId: string,
  updates: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error('Item not found');
  
  const existingItem = itemSnap.data() as Item;
  const now = Timestamp.now();
  
  const mergedItem: Item = { ...existingItem, ...updates, updatedAt: now };

  let parentItem: Item | null = null;
  if (mergedItem.parentId) {
    const parentSnap = await getDoc(doc(db, 'items', mergedItem.parentId));
    if (parentSnap.exists()) {
      parentItem = parentSnap.data() as Item;
    }
  }

  let folder: Folder | null = null;
  if (mergedItem.folderId) {
    const folderSnap = await getDoc(doc(db, 'folders', mergedItem.folderId));
    if (folderSnap.exists()) {
      folder = folderSnap.data() as Folder;
    }
  }

  validateItemContext(mergedItem, parentItem, folder);

  await updateDoc(itemRef, { ...updates, updatedAt: now });
}

async function getSubtasks(itemId: string): Promise<string[]> {
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('parentId', '==', itemId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.id);
}

export async function deleteItem(itemId: string): Promise<void> {
  const subtasks = await getSubtasks(itemId);
  
  let currentBatch = writeBatch(db);
  let opCount = 0;
  
  currentBatch.delete(doc(db, 'items', itemId));
  opCount++;
  
  for (const subtaskId of subtasks) {
    currentBatch.delete(doc(db, 'items', subtaskId));
    opCount++;
    if (opCount === BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }
  
  if (opCount > 0) {
    await currentBatch.commit();
  }
}

export async function createFolder(
  folder: Omit<Folder, 'createdAt' | 'updatedAt'>
): Promise<Folder> {
  const now = Timestamp.now();
  const fullFolder: Folder = {
    ...folder,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, 'folders', fullFolder.id), fullFolder);
  return fullFolder;
}

export async function updateFolder(
  folderId: string,
  updates: Partial<Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  const now = Timestamp.now();
  await updateDoc(folderRef, { ...updates, updatedAt: now });
}

async function getItemsInFolder(folderId: string): Promise<string[]> {
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('folderId', '==', folderId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.id);
}

export async function deleteFolder(folderId: string): Promise<void> {
  const itemsInFolder = await getItemsInFolder(folderId);
  
  let currentBatch = writeBatch(db);
  let opCount = 0;
  
  currentBatch.delete(doc(db, 'folders', folderId));
  opCount++;
  
  for (const itemId of itemsInFolder) {
    currentBatch.delete(doc(db, 'items', itemId));
    opCount++;
    if (opCount === BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }
  
  if (opCount > 0) {
    await currentBatch.commit();
  }
}

/**
 * Opportunistic sweep to delete orphaned items whose folderId does not exist.
 * This runs on startup when online.
 */
export async function orphanSweep(): Promise<void> {
  try {
    const foldersSnap = await getDocs(collection(db, 'folders'));
    const validFolderIds = new Set(foldersSnap.docs.map(d => d.id));
    // Null is the default folder, always valid
    validFolderIds.add('null');
    
    // We get all items to find orphans.
    const itemsSnap = await getDocs(collection(db, 'items'));
    const orphanedIds: string[] = [];
    
    // Also track valid item IDs to check subtask orphans
    const validItemIds = new Set(itemsSnap.docs.map(d => d.id));
    
    itemsSnap.docs.forEach(docSnap => {
      const data = docSnap.data() as Item;
      const folderKey = data.folderId === null ? 'null' : data.folderId;
      
      const folderIsMissing = data.folderId !== null && !validFolderIds.has(folderKey);
      const parentIsMissing = data.parentId !== null && !validItemIds.has(data.parentId);
      
      if (folderIsMissing || parentIsMissing) {
        orphanedIds.push(docSnap.id);
      }
    });
    
    if (orphanedIds.length > 0) {
      let currentBatch = writeBatch(db);
      let opCount = 0;
      
      for (const id of orphanedIds) {
        currentBatch.delete(doc(db, 'items', id));
        opCount++;
        if (opCount === BATCH_LIMIT) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }
      
      if (opCount > 0) {
        await currentBatch.commit();
      }
      
      console.log(`Swept ${orphanedIds.length} orphaned items.`);
    }
  } catch (e) {
    console.warn('Orphan sweep failed', e);
  }
}
