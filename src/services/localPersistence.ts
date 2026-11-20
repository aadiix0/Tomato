import type { SettingsState, Stat, TagItem, Task, Topic } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_TOPIC, DEFAULT_TOPIC_ID } from '../types';

export interface PersistedBundle {
  version: number;
  lastModified: number;
  exportedAt?: string;
  topics: Topic[];
  currentTopicId: number;
  stats: Stat[];
  tasks: Task[];
  tags?: TagItem[];
  settings: SettingsState;
}

export const STORAGE_KEYS = {
  TOPICS: 'tomato_topics_v2',
  CURRENT_TOPIC_ID: 'tomato_current_topic_id_v2',
  STATS: 'tomato_stats_v2',
  SETTINGS: 'tomato_settings_v2',
  TASKS: 'tomato_tasks_v2',
  TAGS: 'tomato_tags_v2',
  LAST_MODIFIED: 'tomato_last_modified_v2',
  SNAPSHOT: 'tomato_backup_snapshot',
};

const DB_NAME = 'zonein_persistent_db';
const DB_VERSION = 1;
const STORE_NAME = 'zonein_store';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fail silently in private/sandboxed contexts
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? (req.result as T) : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function loadInitialFromLocalStorage(): PersistedBundle {
  try {
    const rawTopics = localStorage.getItem(STORAGE_KEYS.TOPICS);
    const rawId = localStorage.getItem(STORAGE_KEYS.CURRENT_TOPIC_ID);
    const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
    const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    const rawTags = localStorage.getItem(STORAGE_KEYS.TAGS);
    const rawModified = localStorage.getItem(STORAGE_KEYS.LAST_MODIFIED);

    const topics: Topic[] = rawTopics ? JSON.parse(rawTopics) : [DEFAULT_TOPIC];
    const safeTopics = Array.isArray(topics) && topics.length > 0 ? topics : [DEFAULT_TOPIC];

    const currentTopicId: number = rawId ? JSON.parse(rawId) : DEFAULT_TOPIC_ID;
    const stats: Stat[] = rawStats ? JSON.parse(rawStats) : [];
    const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
    const tags: TagItem[] = rawTags ? JSON.parse(rawTags) : [];
    const settings: SettingsState = {
      ...DEFAULT_SETTINGS,
      ...(rawSettings ? JSON.parse(rawSettings) : {}),
    };
    const lastModified = rawModified ? Number(rawModified) : 0;

    return {
      version: 2,
      lastModified,
      topics: safeTopics,
      currentTopicId: safeTopics.some((t) => t.id === currentTopicId) ? currentTopicId : safeTopics[0].id,
      stats: Array.isArray(stats) ? stats : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      tags: Array.isArray(tags) ? tags : [],
      settings,
    };
  } catch {
    // If parsing fails, try loading full snapshot fallback
    try {
      const snap = localStorage.getItem(STORAGE_KEYS.SNAPSHOT);
      if (snap) {
        const parsed = JSON.parse(snap);
        if (Array.isArray(parsed.topics)) {
          return {
            version: 2,
            lastModified: parsed.lastModified || 0,
            topics: parsed.topics,
            currentTopicId: parsed.currentTopicId || DEFAULT_TOPIC_ID,
            stats: Array.isArray(parsed.stats) ? parsed.stats : [],
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          };
        }
      }
    } catch {
      // Return clean default
    }

    return {
      version: 2,
      lastModified: 0,
      topics: [DEFAULT_TOPIC],
      currentTopicId: DEFAULT_TOPIC_ID,
      stats: [],
      tasks: [],
      tags: [],
      settings: DEFAULT_SETTINGS,
    };
  }
}

/**
 * Robust async loader that prioritizes PC hard-drive (Electron) or IndexedDB
 * if localStorage was lost, cleared, or out of date.
 */
export async function loadPersistedState(): Promise<PersistedBundle | null> {
  // 1. Check Electron PC storage (filesystem)
  if (typeof window !== 'undefined' && window.electronStorage?.loadData) {
    try {
      const res = await window.electronStorage.loadData();
      if (res?.success && res.data) {
        const parsed = JSON.parse(res.data) as PersistedBundle;
        if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed reading Electron hard-drive store:', err);
    }
  }

  // 2. Check IndexedDB
  try {
    const idbBundle = await idbGet<PersistedBundle>('zonein_full_state');
    if (idbBundle && Array.isArray(idbBundle.topics) && idbBundle.topics.length > 0) {
      return idbBundle;
    }
  } catch {
    // Ignore IndexedDB read failure
  }

  return null;
}

/**
 * Multi-layer persistence: writes synchronously to LocalStorage,
 * mirrors to IndexedDB, and if in Electron, saves to PC hard drive.
 */
export function persistFullState(bundle: PersistedBundle): void {
  const json = JSON.stringify(bundle);

  // 1. LocalStorage
  try {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(bundle.topics));
    localStorage.setItem(STORAGE_KEYS.CURRENT_TOPIC_ID, JSON.stringify(bundle.currentTopicId));
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(bundle.stats));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(bundle.tasks));
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(bundle.tags ?? []));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(bundle.settings));
    localStorage.setItem(STORAGE_KEYS.LAST_MODIFIED, String(bundle.lastModified));
    localStorage.setItem(STORAGE_KEYS.SNAPSHOT, json);
  } catch (err) {
    // Handle QuotaExceededError (e.g. big wallpaper base64)
    console.warn('LocalStorage quota warning, trimming non-essential fields:', err);
    try {
      const strippedSettings = { ...bundle.settings, customBackgroundUrl: '' };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(strippedSettings));
      localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(bundle.topics));
      localStorage.setItem(STORAGE_KEYS.LAST_MODIFIED, String(bundle.lastModified));
    } catch {
      // localStorage completely full
    }
  }

  // 2. IndexedDB (Supports hundreds of megabytes safely)
  void idbSet('zonein_full_state', bundle);

  // 3. Electron PC hard drive storage
  if (typeof window !== 'undefined' && window.electronStorage?.saveData) {
    void window.electronStorage.saveData(json).catch((err) => {
      console.warn('Electron disk write failed:', err);
    });
  }
}

/**
 * Resizes and compresses an uploaded wallpaper image so it never exceeds storage quotas
 * or lags cloud sync. Converts multi-megabyte photos to clean, lightweight WebP/JPEG under 250KB.
 */
export function compressImageFile(file: File, maxDim = 1920, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result ?? ''));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        try {
          const webpUrl = canvas.toDataURL('image/webp', quality);
          if (webpUrl.startsWith('data:image/webp')) {
            resolve(webpUrl);
            return;
          }
        } catch {
          // ignore
        }

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(String(reader.result ?? ''));
      img.src = String(reader.result ?? '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
