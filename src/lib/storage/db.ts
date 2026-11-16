import type { AppSettings, Holding, ManualQuote } from '../../types';

const DB_NAME = 'thong-port';
const DB_VERSION = 1;
const HOLDINGS_STORE = 'holdings';
const SETTINGS_STORE = 'settings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HOLDINGS_STORE)) {
        db.createObjectStore(HOLDINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
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

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const result = await requestResult(action(tx.objectStore(storeName)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('บันทึกข้อมูลไม่สำเร็จ'));
      tx.onabort = () => reject(tx.error ?? new Error('ยกเลิกการบันทึกข้อมูล'));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function getHoldings(): Promise<Holding[]> {
  return withStore(HOLDINGS_STORE, 'readonly', (store) => store.getAll());
}

export async function saveHolding(holding: Holding): Promise<void> {
  await withStore(HOLDINGS_STORE, 'readwrite', (store) => store.put(holding));
}

export async function removeHolding(id: string): Promise<void> {
  await withStore(HOLDINGS_STORE, 'readwrite', (store) => store.delete(id));
}

export async function getQuote(): Promise<ManualQuote> {
  const setting = await withStore<AppSettings | undefined>(SETTINGS_STORE, 'readonly', (store) => store.get('quote'));
  return setting?.value ?? { barBuy: null, barSell: null, ornamentBuy: null, ornamentSell: null, quotedAt: '', sourceUrl: 'https://www.goldtraders.or.th/' };
}

export async function saveQuote(value: ManualQuote): Promise<void> {
  await withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ key: 'quote', value } satisfies AppSettings));
}

export async function replaceAllHoldings(holdings: Holding[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HOLDINGS_STORE, 'readwrite');
      const store = tx.objectStore(HOLDINGS_STORE);
      store.clear();
      for (const holding of holdings) store.put(holding);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('นำเข้ารายการทองไม่สำเร็จ'));
      tx.onabort = () => reject(tx.error ?? new Error('ยกเลิกการนำเข้า'));
    });
  } finally {
    db.close();
  }
}
