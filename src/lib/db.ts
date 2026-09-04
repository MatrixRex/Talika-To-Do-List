import {
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromCache,
  getDocsFromCache,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { generateKeyBetween } from './sort-keys';
import { generateUUID } from './uuid';
import { validateItemContext } from './schema';
import type { Item, Folder, Reminder, User } from './schema';
import { getEffectiveUserId } from './auth';

const BATCH_LIMIT = 500;

export async function getCachedDoc(
  ref: DocumentReference,
  customCacheGetter?: (ref: DocumentReference) => Promise<DocumentSnapshot>,
  customServerGetter?: (ref: DocumentReference) => Promise<DocumentSnapshot>
): Promise<DocumentSnapshot> {
  const cacheGetter = customCacheGetter || getDocFromCache;
  const serverGetter = customServerGetter || getDoc;
  try {
    const snap = await cacheGetter(ref);
    if (snap.exists()) return snap;
    return await serverGetter(ref);
  } catch {
    return await serverGetter(ref);
  }
}

export async function getCachedDocs(
  q: Query,
  customCacheGetter?: (q: Query) => Promise<QuerySnapshot>,
  customServerGetter?: (q: Query) => Promise<QuerySnapshot>
): Promise<QuerySnapshot> {
  const cacheGetter = customCacheGetter || getDocsFromCache;
  const serverGetter = customServerGetter || getDocs;
  try {
    const snap = await cacheGetter(q);
    if (!snap.empty) return snap;
    return await serverGetter(q);
  } catch {
    return await serverGetter(q);
  }
}

export async function firstKeyIn(folderId: string | null, parentId: string | null): Promise<string | null> {
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(
    itemsRef,
    where('memberIds', 'array-contains', uid),
    where('folderId', '==', folderId),
    where('parentId', '==', parentId),
    orderBy('sortKey', 'asc'),
    limit(1)
  );
  const snap = await getCachedDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().sortKey;
}

export async function lastKeyIn(folderId: string | null, parentId: string | null): Promise<string | null> {
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(
    itemsRef,
    where('memberIds', 'array-contains', uid),
    where('folderId', '==', folderId),
    where('parentId', '==', parentId),
    orderBy('sortKey', 'desc'),
    limit(1)
  );
  const snap = await getCachedDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().sortKey;
}

export async function createItem(
  item: Omit<Item, 'createdAt' | 'updatedAt' | 'sortKey'> & {
    sortKey?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
  },
  cachedParentItem?: Item | null,
  cachedFolder?: Folder | null
): Promise<Item> {
  let parentItem: Item | null = cachedParentItem ?? null;
  if (item.parentId && parentItem === null) {
    const parentSnap = await getCachedDoc(doc(db, 'items', item.parentId));
    if (parentSnap.exists()) {
      parentItem = parentSnap.data() as Item;
    }
  }

  let folder: Folder | null = cachedFolder ?? null;
  if (item.folderId) {
    if (folder === null) {
      const folderSnap = await getCachedDoc(doc(db, 'folders', item.folderId));
      if (folderSnap.exists()) {
        folder = folderSnap.data() as Folder;
      }
    }

    // If folder was not in cache or memberIds don't match, fetch fresh server document
    if (
      !folder ||
      folder.memberIds.length !== item.memberIds.length ||
      !item.memberIds.every((id, idx) => id === folder!.memberIds[idx])
    ) {
      try {
        const freshSnap = await getDoc(doc(db, 'folders', item.folderId));
        if (freshSnap.exists()) {
          folder = freshSnap.data() as Folder;
        }
      } catch {
        // If offline or network error, fallback to existing folder snapshot
      }
    }
  }

  const now = item.createdAt || Timestamp.now();
  let sortKey = item.sortKey;
  if (!sortKey) {
    const lastKey = await lastKeyIn(item.folderId, item.parentId);
    sortKey = generateKeyBetween(lastKey, null);
  }
  
  const fullItem: Item = {
    ...item,
    sortKey,
    createdAt: now,
    updatedAt: item.updatedAt || now
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
  const itemSnap = await getCachedDoc(itemRef);
  if (!itemSnap.exists()) throw new Error('Item not found');
  
  const existingItem = itemSnap.data() as Item;
  const now = Timestamp.now();
  
  const mergedItem: Item = { ...existingItem, ...updates, updatedAt: now };

  let parentItem: Item | null = null;
  if (mergedItem.parentId) {
    const parentSnap = await getCachedDoc(doc(db, 'items', mergedItem.parentId));
    if (parentSnap.exists()) {
      parentItem = parentSnap.data() as Item;
    }
  }

  let folder: Folder | null = null;
  if (mergedItem.folderId) {
    const folderSnap = await getCachedDoc(doc(db, 'folders', mergedItem.folderId));
    if (folderSnap.exists()) {
      folder = folderSnap.data() as Folder;
    }
  }

  validateItemContext(mergedItem, parentItem, folder);

  await updateDoc(itemRef, { ...updates, updatedAt: now });
}

export async function reorderItem(itemId: string, newSortKey: string): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  const now = Timestamp.now();
  await updateDoc(itemRef, {
    sortKey: newSortKey,
    updatedAt: now
  });
}

export async function getSubtasks(itemId: string): Promise<Item[]> {
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('memberIds', 'array-contains', uid), where('parentId', '==', itemId));
  const snap = await getCachedDocs(q);
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
  const itemSnap = await getCachedDoc(doc(db, 'items', itemId));
  if (!itemSnap.exists()) throw new Error('Item not found');
  
  const original = itemSnap.data() as Item;
  const now = Timestamp.now();
  const newId = generateUUID();
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
    const newSubId = generateUUID();
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
  const subSnap = await getCachedDoc(doc(db, 'items', subtaskId));
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
  const itemSnap = await getCachedDoc(doc(db, 'items', itemId));
  if (!itemSnap.exists()) throw new Error('Item not found');
  const item = itemSnap.data() as Item;

  let target: Folder | null = null;
  if (targetFolderId) {
    const targetSnap = await getCachedDoc(doc(db, 'folders', targetFolderId));
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

export async function reorderFolder(folderId: string, newSortKey: string): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  const now = Timestamp.now();
  await updateDoc(folderRef, {
    sortKey: newSortKey,
    updatedAt: now
  });
}

async function getItemsInFolder(folderId: string): Promise<string[]> {
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('memberIds', 'array-contains', uid), where('folderId', '==', folderId));
  const snap = await getCachedDocs(q);
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
    const uid = getEffectiveUserId();
    if (!uid) return;

    const foldersSnap = await getCachedDocs(query(collection(db, 'folders'), where('memberIds', 'array-contains', uid)));
    const validFolderIds = new Set(foldersSnap.docs.map(d => d.id));
    validFolderIds.add('null');
    
    const itemsSnap = await getCachedDocs(query(collection(db, 'items'), where('memberIds', 'array-contains', uid)));
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

export async function setReminder(
  itemId: string,
  reminder: Reminder | null,
  actorId: string
): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  const itemSnap = await getCachedDoc(itemRef);
  if (!itemSnap.exists()) throw new Error('Item not found');

  const item = itemSnap.data() as Item;
  const now = Timestamp.now();

  if (reminder !== null) {
    if (item.parentId !== null) {
      throw new Error('Reminders are only allowed on top-level tasks');
    }
    if (item.memberIds.length > 1) {
      throw new Error('Reminders are private-only');
    }
  }

  let parentItem: Item | null = null;
  if (item.parentId) {
    const parentSnap = await getCachedDoc(doc(db, 'items', item.parentId));
    if (parentSnap.exists()) parentItem = parentSnap.data() as Item;
  }

  let folder: Folder | null = null;
  if (item.folderId) {
    const folderSnap = await getCachedDoc(doc(db, 'folders', item.folderId));
    if (folderSnap.exists()) folder = folderSnap.data() as Folder;
  }

  const updatedItem: Item = {
    ...item,
    reminder,
    updatedAt: now,
    updatedBy: actorId
  };

  validateItemContext(updatedItem, parentItem, folder);

  await updateDoc(itemRef, {
    reminder,
    updatedAt: now,
    updatedBy: actorId
  });
}

export async function shareFolder(
  folderId: string,
  newMemberIds: string[],
  actorId: string,
  newRoles?: { [uid: string]: 'owner' | 'editor' }
): Promise<{ strippedCount: number }> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getCachedDoc(folderRef);
  if (!folderSnap.exists()) throw new Error('Folder not found');

  const folder = folderSnap.data() as Folder;
  const now = Timestamp.now();

  const isShared = newMemberIds.length > 1;

  // Build roles mapping
  const roles = newRoles || { ...folder.roles };
  for (const memberId of newMemberIds) {
    if (!roles[memberId]) {
      roles[memberId] = memberId === folder.ownerId ? 'owner' : 'editor';
    }
  }

  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('memberIds', 'array-contains', uid), where('folderId', '==', folderId));
  const snap = await getCachedDocs(q);

  let strippedCount = 0;
  let currentBatch = writeBatch(db);
  let opCount = 0;

  // Update folder document
  currentBatch.update(folderRef, {
    memberIds: newMemberIds,
    roles,
    updatedAt: now
  });
  opCount++;

  for (const itemDoc of snap.docs) {
    const itemData = itemDoc.data() as Item;
    const updates: Partial<Item> = {
      memberIds: newMemberIds,
      updatedAt: now,
      updatedBy: actorId
    };

    if (isShared && itemData.reminder !== null) {
      updates.reminder = null;
      strippedCount++;
    }

    currentBatch.update(itemDoc.ref, updates);
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
  }

  return { strippedCount };
}

export async function getFolderPreview(
  folderId: string
): Promise<{ folder: Folder; owner: User | null } | null> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) return null;

  const folder = folderSnap.data() as Folder;
  let owner: User | null = null;
  try {
    const ownerSnap = await getDoc(doc(db, 'users', folder.ownerId));
    if (ownerSnap.exists()) {
      owner = ownerSnap.data() as User;
    }
  } catch (err) {
    console.warn('Failed to fetch folder owner profile:', err);
  }

  return { folder, owner };
}

export async function joinFolder(
  folderId: string,
  actorId: string
): Promise<{ strippedCount: number }> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) throw new Error('Folder not found');

  const folder = folderSnap.data() as Folder;
  if (folder.memberIds.includes(actorId)) {
    return { strippedCount: 0 };
  }

  const newMemberIds = [...folder.memberIds, actorId];
  const newRoles = {
    ...folder.roles,
    [actorId]: 'editor' as const,
  };

  const isBecomingShared = folder.memberIds.length === 1;
  const now = Timestamp.now();

  // Step 1: Update folder document so rules recognize actor as folder member
  await updateDoc(folderRef, {
    memberIds: newMemberIds,
    roles: newRoles,
    updatedAt: now,
  });

  // Step 2: Fetch and update items belonging to this folder
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('folderId', '==', folderId));
  const snap = await getDocs(q);

  let strippedCount = 0;
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (const itemDoc of snap.docs) {
    const itemData = itemDoc.data() as Item;
    const updates: Partial<Item> = {
      memberIds: newMemberIds,
      updatedAt: now,
      updatedBy: actorId,
    };

    if (isBecomingShared && itemData.reminder !== null) {
      updates.reminder = null;
      strippedCount++;
    }

    currentBatch.update(itemDoc.ref, updates);
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
  }

  return { strippedCount };
}

export async function lookupUserByEmail(email: string): Promise<User | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', trimmed));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].data() as User;
  }
  const qRaw = query(usersRef, where('email', '==', email.trim()));
  const snapRaw = await getDocs(qRaw);
  if (!snapRaw.empty) {
    return snapRaw.docs[0].data() as User;
  }
  return null;
}

export async function fetchUsersByIds(uids: string[]): Promise<User[]> {
  if (!uids || uids.length === 0) return [];
  const promises = uids.map(async (uid) => {
    try {
      const snap = await getCachedDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        return snap.data() as User;
      }
      return null;
    } catch {
      return null;
    }
  });
  const results = await Promise.all(promises);
  return results.filter((u): u is User => u !== null);
}

export async function revokeFolderMember(
  folderId: string,
  memberIdToRemove: string,
  actorId: string
): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  const folderSnap = await getCachedDoc(folderRef);
  if (!folderSnap.exists()) throw new Error('Folder not found');

  const folder = folderSnap.data() as Folder;
  const newMemberIds = folder.memberIds.filter((id) => id !== memberIdToRemove);
  const newRoles = { ...folder.roles };
  delete newRoles[memberIdToRemove];

  const now = Timestamp.now();
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('memberIds', 'array-contains', uid), where('folderId', '==', folderId));
  const snap = await getCachedDocs(q);

  let currentBatch = writeBatch(db);
  let opCount = 0;

  currentBatch.update(folderRef, {
    memberIds: newMemberIds,
    roles: newRoles,
    updatedAt: now,
  });
  opCount++;

  for (const itemDoc of snap.docs) {
    currentBatch.update(itemDoc.ref, {
      memberIds: newMemberIds,
      updatedAt: now,
      updatedBy: actorId,
    });
    opCount++;

    if (opCount >= BATCH_LIMIT) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
  }
}

export async function leaveFolder(folderId: string, actorId: string): Promise<void> {
  await revokeFolderMember(folderId, actorId, actorId);
}

export async function countFolderReminders(folderId: string): Promise<number> {
  const uid = getEffectiveUserId();
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, where('memberIds', 'array-contains', uid), where('folderId', '==', folderId));
  const snap = await getCachedDocs(q);
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Item;
    if (data.reminder !== null) {
      count++;
    }
  }
  return count;
}
