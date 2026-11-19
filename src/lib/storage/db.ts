import type { AppSettings, DeletionTombstone, Holding, LocalCloudSyncState, ManualQuote } from '../../types';

const DB_NAME = 'thong-port';
const DB_VERSION = 2;
const HOLDINGS_STORE = 'holdings';
const SETTINGS_STORE = 'settings';
const DELETIONS_STORE = 'deletions';
const EMPTY_SYNC_STATE: LocalCloudSyncState = { enabled: false, ownerKey: null, lastSyncedAt: null, manualQuoteUpdatedAt: null, error: null };
type StoredSetting = AppSettings | { key: 'cloudSync'; value: LocalCloudSyncState } | { key: 'manualQuote'; value: ManualQuote };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HOLDINGS_STORE)) db.createObjectStore(HOLDINGS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(DELETIONS_STORE)) db.createObjectStore(DELETIONS_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('เปิดฐานข้อมูลในอุปกรณ์ไม่สำเร็จ'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('อ่านข้อมูลไม่สำเร็จ'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('บันทึกข้อมูลไม่สำเร็จ'));
    tx.onabort = () => reject(tx.error ?? new Error('ยกเลิกการบันทึกข้อมูล'));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const done = transactionDone(tx);
    const result = await requestResult(action(tx.objectStore(storeName)));
    await done;
    return result;
  } finally {
    db.close();
  }
}

export async function getHoldings(): Promise<Holding[]> {
  return withStore(HOLDINGS_STORE, 'readonly', (store) => store.getAll());
}

export async function saveHolding(holding: Holding): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([HOLDINGS_STORE, DELETIONS_STORE], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(HOLDINGS_STORE).put(holding);
    tx.objectStore(DELETIONS_STORE).delete(holding.id);
    await done;
  } finally {
    db.close();
  }
}

export async function removeHolding(id: string, createTombstone = true): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([HOLDINGS_STORE, DELETIONS_STORE], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(HOLDINGS_STORE).delete(id);
    if (createTombstone) tx.objectStore(DELETIONS_STORE).put({ id, deletedAt: new Date().toISOString() } satisfies DeletionTombstone);
    else tx.objectStore(DELETIONS_STORE).delete(id);
    await done;
  } finally {
    db.close();
  }
}

export async function getDeletionTombstones(): Promise<DeletionTombstone[]> {
  return withStore(DELETIONS_STORE, 'readonly', (store) => store.getAll());
}

export async function clearDeletionTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(DELETIONS_STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(DELETIONS_STORE);
    for (const id of ids) store.delete(id);
    await done;
  } finally {
    db.close();
  }
}

export async function getQuote(): Promise<ManualQuote> {
  const setting = await withStore<StoredSetting | undefined>(SETTINGS_STORE, 'readonly', (store) => store.get('quote'));
  return setting?.key === 'quote' ? setting.value : { barBuy: null, barSell: null, ornamentBuy: null, ornamentSell: null, quotedAt: '', sourceUrl: 'https://www.goldtraders.or.th/' };
}

export async function saveQuote(value: ManualQuote): Promise<void> {
  await withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ key: 'quote', value } satisfies AppSettings));
}

export async function getManualQuote(): Promise<ManualQuote | null> {
  const setting = await withStore<StoredSetting | undefined>(SETTINGS_STORE, 'readonly', (store) => store.get('manualQuote'));
  return setting?.key === 'manualQuote' ? setting.value : null;
}

export async function saveManualQuote(value: ManualQuote | null): Promise<void> {
  if (value) await withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ key: 'manualQuote', value }));
  else await withStore(SETTINGS_STORE, 'readwrite', (store) => store.delete('manualQuote'));
}

export async function getCloudSyncState(): Promise<LocalCloudSyncState> {
  const setting = await withStore<StoredSetting | undefined>(SETTINGS_STORE, 'readonly', (store) => store.get('cloudSync'));
  return setting?.key === 'cloudSync' ? setting.value : EMPTY_SYNC_STATE;
}

export async function saveCloudSyncState(value: LocalCloudSyncState): Promise<void> {
  await withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ key: 'cloudSync', value }));
}

export async function replaceAllHoldings(holdings: Holding[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([HOLDINGS_STORE, DELETIONS_STORE], 'readwrite');
      const currentStore = tx.objectStore(HOLDINGS_STORE);
      const deletionStore = tx.objectStore(DELETIONS_STORE);
      const incomingIds = new Set(holdings.map((holding) => holding.id));
      const deletedAt = new Date().toISOString();
      currentStore.getAll().onsuccess = (event) => {
        const current = (event.target as IDBRequest<Holding[]>).result;
        currentStore.clear();
        for (const holding of holdings) {
          currentStore.put(holding);
          deletionStore.delete(holding.id);
        }
        for (const holding of current) {
          if (!incomingIds.has(holding.id)) deletionStore.put({ id: holding.id, deletedAt } satisfies DeletionTombstone);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('นำเข้ารายการทองไม่สำเร็จ'));
      tx.onabort = () => reject(tx.error ?? new Error('ยกเลิกการนำเข้า'));
    });
  } finally {
    db.close();
  }
}
