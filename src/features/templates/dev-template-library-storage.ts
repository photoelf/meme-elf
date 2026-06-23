import type { MelfTemplateDocument } from './melf-template';
import { parseMelfTemplateDocument } from './melf-template';

const DEV_TEMPLATE_LIBRARY_DB_NAME = 'meme-elf-dev-template-library';
const DEV_TEMPLATE_LIBRARY_STORE_NAME = 'libraries';
const DEV_TEMPLATE_LIBRARY_RECORD_KEY = 'current';

export async function readPersistedTemplateLibrary(
  storageKey: string,
): Promise<MelfTemplateDocument[] | null> {
  const indexedDbLibrary = await readTemplateLibraryFromIndexedDb();

  if (indexedDbLibrary) {
    return indexedDbLibrary;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return readTemplateLibraryFromLocalStorage(window.localStorage, storageKey);
}

export async function writePersistedTemplateLibrary(
  storageKey: string,
  library: readonly MelfTemplateDocument[],
): Promise<void> {
  await writeTemplateLibraryToIndexedDb(library);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(library));
  } catch {
    // Keep IndexedDB as the durable source when localStorage runs out of quota.
  }
}

function readTemplateLibraryFromLocalStorage(storage: Storage, storageKey: string) {
  const rawLibrary = storage.getItem(storageKey);

  if (!rawLibrary) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawLibrary) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    if (parsed.length === 0) {
      return [];
    }

    const library = parsed
      .map((entry) => parseMelfTemplateDocument(JSON.stringify(entry)))
      .filter((entry): entry is MelfTemplateDocument => entry !== null);

    return library.length > 0 ? library : null;
  } catch {
    return null;
  }
}

async function readTemplateLibraryFromIndexedDb() {
  const database = await openTemplateLibraryDatabase();

  if (!database) {
    return null;
  }

  return new Promise<MelfTemplateDocument[] | null>((resolve) => {
    const transaction = database.transaction(DEV_TEMPLATE_LIBRARY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DEV_TEMPLATE_LIBRARY_STORE_NAME);
    const request = store.get(DEV_TEMPLATE_LIBRARY_RECORD_KEY);

    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const value = request.result as unknown;

      if (!Array.isArray(value)) {
        resolve(null);
        return;
      }

      if (value.length === 0) {
        resolve([]);
        return;
      }

      const library = value
        .map((entry) => parseMelfTemplateDocument(JSON.stringify(entry)))
        .filter((entry): entry is MelfTemplateDocument => entry !== null);

      resolve(library.length > 0 ? library : null);
    };
  });
}

async function writeTemplateLibraryToIndexedDb(library: readonly MelfTemplateDocument[]) {
  const database = await openTemplateLibraryDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DEV_TEMPLATE_LIBRARY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DEV_TEMPLATE_LIBRARY_STORE_NAME);
    const request = store.put(
      JSON.parse(JSON.stringify(library)) as unknown[],
      DEV_TEMPLATE_LIBRARY_RECORD_KEY,
    );

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function openTemplateLibraryDatabase() {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DEV_TEMPLATE_LIBRARY_DB_NAME, 1);

    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DEV_TEMPLATE_LIBRARY_STORE_NAME)) {
        database.createObjectStore(DEV_TEMPLATE_LIBRARY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}
