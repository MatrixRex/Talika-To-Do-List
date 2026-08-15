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
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { generateKeyBetween } from './sort-keys';
import { validateItemContext } from './schema';
import type { Item, Folder } from './schema';

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

export async function lastKeyIn(folderId: string | null, parentId: string | null): Promise<string | null> {
  const itemsRef = collection(db, 'items');
  const q = query(
    itemsRef,
    where('folderId', '==', folderId),
    where('parentId', '==', parentId),
    orderBy('sortKey', 'desc'),
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
  const lastKey = await lastKeyIn(item.folderId, item.parentId);
  const sortKey = generateKeyBetween(lastKey, null);
  
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

export async function getSubtasks(itemId: string): Promise<Item[]> {
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('parentId', '==', itemId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Item);
}

export async function deleteItem(itemId: string): Promise<void> {
  const subtasks = await getSubtasks(itemId);
  
  let currentBatch = writeBatch(db);
  let opCount = 0;
  
  currentBatch.delete(doc(db, 'items', itemId));
  opCount++;
  
  for (const subtask of subtasks) {
    currentBatch.delete(doc(db, 'items', subtask.id));
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

export async function duplicateItem(itemId: string): Promise<string> {
  const itemSnap = await getDoc(doc(db, 'items', itemId));
  if (!itemSnap.exists()) throw new Error('Item not found');
  
  const original = itemSnap.data() as Item;
  const now = Timestamp.now();
  const newId = crypto.randomUUID();
  const lastKey = await lastKeyIn(original.folderId, original.parentId);
  const newSortKey = generateKeyBetween(lastKey, null);

  const newItem: Item = {
    ...original,
    id: newId,
    title: original.title,
    sortKey: newSortKey,
    done: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const subtasks = await getSubtasks(itemId);
  const batch = writeBatch(db);
  batch.set(doc(db, 'items', newId), newItem);

  let prevSubKey: string | null = null;
  for (const sub of subtasks) {
    const newSubId = crypto.randomUUID();
    const newSubSortKey = generateKeyBetween(prevSubKey, null);
    prevSubKey = newSubSortKey;

    const newSubItem: Item = {
      ...sub,
      id: newSubId,
      parentId: newId,
      sortKey: newSubSortKey,
      done: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(doc(db, 'items', newSubId), newSubItem);
  }

  await batch.commit();
  return newId;
}

export async function promoteSubtask(subtaskId: string): Promise<void> {
  const subSnap = await getDoc(doc(db, 'items', subtaskId));
  if (!subSnap.exists()) throw new Error('Subtask not found');
  
  const subtask = subSnap.data() as Item;
  if (!subtask.parentId) return; // Already top level

  const now = Timestamp.now();
  const lastKey = await lastKeyIn(subtask.folderId, null);
  const newSortKey = generateKeyBetween(lastKey, null);

  await updateDoc(doc(db, 'items', subtaskId), {
    parentId: null,
    sortKey: newSortKey,
    updatedAt: now
  });
}

export async function moveItem(itemId: string, targetFolderId: string | null, actorId: string): Promise<void> {
  const itemSnap = await getDoc(doc(db, 'items', itemId));
  if (!itemSnap.exists()) throw new Error('Item not found');
  const item = itemSnap.data() as Item;

  let target: Folder | null = null;
  if (targetFolderId) {
    const targetSnap = await getDoc(doc(db, 'folders', targetFolderId));
    if (targetSnap.exists()) {
      target = targetSnap.data() as Folder;
    }
  }

  const newOwnerId = target ? item.ownerId : actorId;
  const newMemberIds = target ? target.memberIds : [actorId];
  const firstKey = await firstKeyIn(targetFolderId, null);
  const newSortKey = generateKeyBetween(null, firstKey);
  const now = Timestamp.now();

  const batch = writeBatch(db);
  batch.update(doc(db, 'items', itemId), {
    folderId: targetFolderId,
    parentId: null, // Always land at root when moved between folders
    ownerId: newOwnerId,
    memberIds: newMemberIds,
    sortKey: newSortKey,
    reminder: newMemberIds.length > 1 ? null : item.reminder,
    updatedAt: now,
    updatedBy: actorId
  });

  const subtasks = await getSubtasks(itemId);
  for (const sub of subtasks) {
    batch.update(doc(db, 'items', sub.id), {
      folderId: targetFolderId,
      ownerId: newOwnerId,
      memberIds: newMemberIds,
      updatedAt: now,
      updatedBy: actorId
    });
  }

  await batch.commit();
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

export async function orphanSweep(): Promise<void> {
  try {
    const foldersSnap = await getDocs(collection(db, 'folders'));
    const validFolderIds = new Set(foldersSnap.docs.map(d => d.id));
    validFolderIds.add('null');
    
    const itemsSnap = await getDocs(collection(db, 'items'));
    const orphanedIds: string[] = [];
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
    }
  } catch (e) {
    console.warn('Orphan sweep failed', e);
  }
}
