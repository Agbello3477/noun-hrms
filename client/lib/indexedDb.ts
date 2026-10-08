/**
 * Lightweight IndexedDB Client Caching Layer
 * Handles offline form drafts and caching for weak/dropped network connections.
 */

const DB_NAME = 'noun_hrms_offline_cache';
const DB_VERSION = 1;
const STORE_NAME = 'form_drafts';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB is only available in the browser'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'formId' });
      }
    };
  });
}

/**
 * Save form data locally in IndexedDB as a draft.
 */
export async function saveDraft(formId: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ formId, data, updatedAt: new Date().toISOString() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to save draft:', error);
  }
}

/**
 * Retrieve form data draft from IndexedDB.
 */
export async function getDraft<T>(formId: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(formId);

      request.onsuccess = () => {
        resolve(request.result ? (request.result.data as T) : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to retrieve draft:', error);
    return null;
  }
}

/**
 * Delete draft from IndexedDB (e.g. after successful submission).
 */
export async function clearDraft(formId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(formId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to clear draft:', error);
  }
}
