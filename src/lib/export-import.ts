import { collection, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserSchema, FolderSchema, ItemSchema } from './schema';
import type { Item } from './schema';

const BATCH_LIMIT = 500;

export interface ExportData {
  users: Record<string, Record<string, unknown>>;
  folders: Record<string, Record<string, unknown>>;
  items: Record<string, Record<string, unknown>>;
}

function serializeTimestamp(ts: unknown) {
  if (ts instanceof Timestamp) {
    return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds };
  }
  return ts;
}

function deserializeTimestamp(obj: unknown) {
  if (obj && typeof obj === 'object' && '_seconds' in obj && '_nanoseconds' in obj) {
    const record = obj as { _seconds: number; _nanoseconds: number };
    return new Timestamp(record._seconds, record._nanoseconds);
  }
  return obj;
}

function mapValues<T>(obj: Record<string, unknown>, mapper: (val: unknown) => unknown): T {
  const result: Record<string, unknown> = {};
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

function processTimestampsForExport(data: unknown): unknown {
  return mapValues(data as Record<string, unknown>, (val) => {
    if (val instanceof Timestamp) return serializeTimestamp(val);
    if (typeof val === 'object' && val !== null) return processTimestampsForExport(val);
    return val;
  });
}

function processTimestampsForImport(data: unknown): unknown {
  return mapValues(data as Record<string, unknown>, (val) => {
    if (val && typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val) {
      return deserializeTimestamp(val);
    }
    if (typeof val === 'object' && val !== null) return processTimestampsForImport(val);
    return val;
  });
}

function sortObjectKeys(obj: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const sorted: Record<string, Record<string, unknown>> = {};
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
    data.users[d.id] = processTimestampsForExport(d.data()) as Record<string, unknown>;
  });

  const validFolderIds = new Set<string>();
  foldersSnap.docs.forEach(d => {
    data.folders[d.id] = processTimestampsForExport(d.data()) as Record<string, unknown>;
    validFolderIds.add(d.id);
  });
  
  const validItemIds = new Set<string>(itemsSnap.docs.map(d => d.id));

  // Filter orphans during export
  itemsSnap.docs.forEach(d => {
    const itemData = d.data() as Item;
    const isFolderMissing = itemData.folderId !== null && !validFolderIds.has(itemData.folderId);
    const isParentMissing = itemData.parentId !== null && !validItemIds.has(itemData.parentId);
    
    if (!isFolderMissing && !isParentMissing) {
      data.items[d.id] = processTimestampsForExport(itemData) as Record<string, unknown>;
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

  const allOps: { coll: string; id: string; data: unknown }[] = [];
  
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
    const dataWithTs = processTimestampsForImport(op.data) as Record<string, unknown>;
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
