import { collection, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserSchema, FolderSchema, ItemSchema } from './schema';
import type { User, Folder, Item } from './schema';

const BATCH_LIMIT = 500;

export interface ExportData {
  users: Record<string, any>;
  folders: Record<string, any>;
  items: Record<string, any>;
}

function serializeTimestamp(ts: any) {
  if (ts instanceof Timestamp) {
    return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds };
  }
  return ts;
}

function deserializeTimestamp(obj: any) {
  if (obj && typeof obj === 'object' && '_seconds' in obj && '_nanoseconds' in obj) {
    return new Timestamp(obj._seconds, obj._nanoseconds);
  }
  return obj;
}

function mapValues<T>(obj: Record<string, any>, mapper: (val: any) => any): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      result[key] = null;
    } else if (Array.isArray(value)) {
      result[key] = value.map(mapper);
    } else if (typeof value === 'object') {
      result[key] = mapper(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function processTimestampsForExport(data: any): any {
  return mapValues(data, (val) => {
    if (val instanceof Timestamp) return serializeTimestamp(val);
    if (typeof val === 'object' && val !== null) return processTimestampsForExport(val);
    return val;
  });
}

function processTimestampsForImport(data: any): any {
  return mapValues(data, (val) => {
    if (val && typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val) {
      return deserializeTimestamp(val);
    }
    if (typeof val === 'object' && val !== null) return processTimestampsForImport(val);
    return val;
  });
}

function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  const sorted: Record<string, any> = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
}

export async function exportData(): Promise<string> {
  const usersSnap = await getDocs(collection(db, 'users'));
  const foldersSnap = await getDocs(collection(db, 'folders'));
  const itemsSnap = await getDocs(collection(db, 'items'));

  const data: ExportData = {
    users: {},
    folders: {},
    items: {}
  };

  usersSnap.docs.forEach(d => {
    data.users[d.id] = processTimestampsForExport(d.data());
  });

  const validFolderIds = new Set<string>();
  foldersSnap.docs.forEach(d => {
    data.folders[d.id] = processTimestampsForExport(d.data());
    validFolderIds.add(d.id);
  });
  
  const validItemIds = new Set<string>(itemsSnap.docs.map(d => d.id));

  // Filter orphans during export
  itemsSnap.docs.forEach(d => {
    const itemData = d.data() as Item;
    const isFolderMissing = itemData.folderId !== null && !validFolderIds.has(itemData.folderId);
    const isParentMissing = itemData.parentId !== null && !validItemIds.has(itemData.parentId);
    
    if (!isFolderMissing && !isParentMissing) {
      data.items[d.id] = processTimestampsForExport(itemData);
    }
  });

  // Sort by ID to ensure deterministic output
  data.users = sortObjectKeys(data.users);
  data.folders = sortObjectKeys(data.folders);
  data.items = sortObjectKeys(data.items);

  return JSON.stringify(data, null, 2);
}

export async function wipeData(): Promise<void> {
  const collections = ['users', 'folders', 'items'];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (const coll of collections) {
    const snap = await getDocs(collection(db, coll));
    for (const d of snap.docs) {
      currentBatch.delete(d.ref);
      opCount++;
      if (opCount === BATCH_LIMIT) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }
  }

  if (opCount > 0) {
    await currentBatch.commit();
  }
}

export async function importData(jsonString: string): Promise<void> {
  const parsed = JSON.parse(jsonString) as ExportData;
  
  // Validate schema before importing
  for (const val of Object.values(parsed.users)) {
    UserSchema.parse(processTimestampsForImport(val));
  }
  for (const val of Object.values(parsed.folders)) {
    FolderSchema.parse(processTimestampsForImport(val));
  }
  for (const val of Object.values(parsed.items)) {
    ItemSchema.parse(processTimestampsForImport(val));
  }

  // Wipe first
  await wipeData();

  let currentBatch = writeBatch(db);
  let opCount = 0;

  const addDocsToBatch = (coll: string, records: Record<string, any>) => {
    for (const [id, val] of Object.entries(records)) {
      const dataWithTs = processTimestampsForImport(val);
      currentBatch.set(doc(db, coll, id), dataWithTs);
      opCount++;
      if (opCount === BATCH_LIMIT) {
        // Need to be async here, we'll collect the commits instead
      }
    }
  };

  // We rewrite the batching logic for sequential awaiting
  const allOps: { coll: string, id: string, data: any }[] = [];
  
  if (parsed.users) {
    Object.entries(parsed.users).forEach(([id, val]) => allOps.push({ coll: 'users', id, data: val }));
  }
  if (parsed.folders) {
    Object.entries(parsed.folders).forEach(([id, val]) => allOps.push({ coll: 'folders', id, data: val }));
  }
  if (parsed.items) {
    Object.entries(parsed.items).forEach(([id, val]) => allOps.push({ coll: 'items', id, data: val }));
  }

  for (const op of allOps) {
    const dataWithTs = processTimestampsForImport(op.data);
    currentBatch.set(doc(db, op.coll, op.id), dataWithTs);
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
