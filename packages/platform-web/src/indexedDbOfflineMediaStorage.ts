import {
  decodeWaveformPeaks,
  emitOfflineMediaReady,
  emitWaveformPeaksReady,
  offlineMediaKeyId,
  OFFLINE_MEDIA_DEFAULT_VARIANT,
  WAVEFORM_BAR_COUNT,
  type LibraryCacheScope,
  type OfflineMediaKey,
  type OfflineMediaStatusDetail,
  type OfflineMediaStore,
  type OfflinePlaybackSource,
  type OfflineReadyEntry,
} from '@asmusic/core';

const DB_NAME = 'asmusic-offline-media';
const DB_VERSION = 3;

/** Matches library-cache artwork pattern; fourth segment is track identity + format variant. */
const TRACK_KEY_PATH = ['serverKey', 'libraryId', 'trackId', 'variant'] as const;

type OfflineTrackRow = {
  serverKey: string;
  libraryId: string;
  trackId: string;
  variant: string;
  mimeType: string;
  byteLength: number;
  updatedAt: number;
  body: Blob;
  waveformPeaks?: number[];
  waveformBarCount?: number;
};

type LegacyOfflineTrackRow = OfflineTrackRow & { id: string };

function idbTrackKey(key: OfflineMediaKey): [string, string, string, string] {
  return [
    key.scope.serverKey,
    key.scope.libraryId,
    key.trackId,
    key.variant ?? OFFLINE_MEDIA_DEFAULT_VARIANT,
  ];
}

function offlineKeyFromRow(row: OfflineTrackRow): OfflineMediaKey {
  return {
    scope: { serverKey: row.serverKey, libraryId: row.libraryId },
    trackId: row.trackId,
    variant: row.variant,
  };
}

function createTracksStore(db: IDBDatabase): void {
  const store = db.createObjectStore('tracks', { keyPath: [...TRACK_KEY_PATH] });
  store.createIndex('byScope', ['serverKey', 'libraryId']);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB offline media open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) {
        reject(new Error('IndexedDB offline media upgrade missing transaction'));
        return;
      }
      if (ev.oldVersion < 2) {
        if (db.objectStoreNames.contains('tracks')) {
          const oldStore = tx.objectStore('tracks');
          const getAllReq = oldStore.getAll();
          getAllReq.onerror = () =>
            reject(getAllReq.error ?? new Error('IndexedDB offline media migration read failed'));
          getAllReq.onsuccess = () => {
            const rows = getAllReq.result as LegacyOfflineTrackRow[];
            db.deleteObjectStore('tracks');
            createTracksStore(db);
            const newStore = tx.objectStore('tracks');
            for (const row of rows) {
              const { id: _legacyId, ...rest } = row;
              newStore.put(rest);
            }
          };
        } else {
          createTracksStore(db);
        }
      }
      // v3: optional waveformPeaks / waveformBarCount on each track row (no store shape change).
    };
  });
}

function inScope(row: OfflineTrackRow, filter: LibraryCacheScope | null): boolean {
  if (!filter) return true;
  return row.serverKey === filter.serverKey && row.libraryId === filter.libraryId;
}

async function readTrackRow(
  db: IDBDatabase,
  k: [string, string, string, string],
): Promise<OfflineTrackRow | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const req = tx.objectStore('tracks').get(k);
    req.onerror = () => reject(req.error ?? new Error('read track failed'));
    req.onsuccess = () => resolve(req.result as OfflineTrackRow | undefined);
  });
}

async function putTrackRow(db: IDBDatabase, row: OfflineTrackRow): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    tx.onerror = () => reject(tx.error ?? new Error('IDB write tx failed'));
    tx.oncomplete = () => resolve();
    tx.objectStore('tracks').put(row);
  });
}

/** Cap concurrent full-file PCM decodes so bulk downloads cannot OOM the tab. */
const MAX_WAVEFORM_PRECOMPUTE_INFLIGHT = 1;
let waveformPrecomputeInflight = 0;
const waveformPrecomputeWaiters: Array<() => void> = [];

async function withWaveformPrecomputeSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (waveformPrecomputeInflight >= MAX_WAVEFORM_PRECOMPUTE_INFLIGHT) {
    await new Promise<void>((resolve) => {
      waveformPrecomputeWaiters.push(resolve);
    });
  }
  waveformPrecomputeInflight += 1;
  try {
    return await fn();
  } finally {
    waveformPrecomputeInflight -= 1;
    const next = waveformPrecomputeWaiters.shift();
    next?.();
  }
}

function scheduleWaveformPrecompute(key: OfflineMediaKey, row: OfflineTrackRow): void {
  const cacheKey = offlineMediaKeyId(key);
  void withWaveformPrecomputeSlot(async () => {
    try {
      if (
        row.waveformPeaks &&
        row.waveformPeaks.length > 0 &&
        row.waveformBarCount === WAVEFORM_BAR_COUNT
      ) {
        emitWaveformPeaksReady(cacheKey);
        return;
      }
      const url = URL.createObjectURL(row.body);
      try {
        const peaks = await decodeWaveformPeaks(url, WAVEFORM_BAR_COUNT);
        const db = await openDb();
        const k = idbTrackKey(key);
        const latest = await readTrackRow(db, k);
        if (!latest?.body) return;
        await putTrackRow(db, {
          ...latest,
          waveformPeaks: peaks,
          waveformBarCount: WAVEFORM_BAR_COUNT,
        });
        emitWaveformPeaksReady(cacheKey);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      /* ignore background waveform errors */
    }
  });
}

export function createIndexedDbOfflineMediaStorage(): OfflineMediaStore {
  const inflight = new Map<string, AbortController>();

  return {
    backend: 'indexeddb',

    async getStatus(key: OfflineMediaKey): Promise<OfflineMediaStatusDetail> {
      const db = await openDb();
      const k = idbTrackKey(key);
      return new Promise((resolve, reject) => {
        const tx = db.transaction('tracks', 'readonly');
        const req = tx.objectStore('tracks').get(k);
        req.onerror = () => reject(req.error ?? new Error('getStatus failed'));
        req.onsuccess = () => {
          const row = req.result as OfflineTrackRow | undefined;
          if (!row) {
            resolve({ status: 'none' });
            return;
          }
          resolve({
            status: 'ready',
            byteLength: row.byteLength,
            mimeType: row.mimeType,
            updatedAt: row.updatedAt,
          });
        };
      });
    },

    async listReadyEntries(scopeFilter: LibraryCacheScope | null): Promise<OfflineReadyEntry[]> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        const out: OfflineReadyEntry[] = [];
        if (scopeFilter) {
          const idx = store.index('byScope');
          const range = IDBKeyRange.only([scopeFilter.serverKey, scopeFilter.libraryId]);
          const cur = idx.openCursor(range);
          cur.onerror = () => reject(cur.error ?? new Error('listReadyEntries cursor failed'));
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) {
              resolve(out);
              return;
            }
            const row = c.value as OfflineTrackRow;
            out.push({ key: offlineKeyFromRow(row), byteLength: row.byteLength });
            c.continue();
          };
        } else {
          const cur = store.openCursor();
          cur.onerror = () => reject(cur.error ?? new Error('listReadyEntries cursor failed'));
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) {
              resolve(out);
              return;
            }
            const row = c.value as OfflineTrackRow;
            out.push({ key: offlineKeyFromRow(row), byteLength: row.byteLength });
            c.continue();
          };
        }
      });
    },

    async listReadyKeys(scopeFilter: LibraryCacheScope | null): Promise<OfflineMediaKey[]> {
      const entries = await this.listReadyEntries(scopeFilter);
      return entries.map((e) => e.key);
    },

    async getReadyPlaybackSource(key: OfflineMediaKey): Promise<OfflinePlaybackSource | null> {
      const db = await openDb();
      const k = idbTrackKey(key);
      const row = await readTrackRow(db, k);
      if (!row?.body) return null;
      const url = URL.createObjectURL(row.body);
      return {
        url,
        revoke: () => URL.revokeObjectURL(url),
      };
    },

    async getWaveformPeaks(key: OfflineMediaKey, barCount: number): Promise<number[] | null> {
      const db = await openDb();
      const k = idbTrackKey(key);
      const row = await readTrackRow(db, k);
      if (!row?.body) return null;
      if (
        row.waveformPeaks &&
        row.waveformPeaks.length > 0 &&
        row.waveformBarCount === barCount
      ) {
        return row.waveformPeaks;
      }
      try {
        const url = URL.createObjectURL(row.body);
        try {
          const peaks = await decodeWaveformPeaks(url, barCount);
          await putTrackRow(db, {
            ...row,
            waveformPeaks: peaks,
            waveformBarCount: barCount,
          });
          emitWaveformPeaksReady(offlineMediaKeyId(key));
          return peaks;
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        return null;
      }
    },

    async importFromAuthenticatedUrl(
      key: OfflineMediaKey,
      url: string,
      options?: { signal?: AbortSignal }
    ): Promise<void> {
      const id = offlineMediaKeyId(key);
      const prev = inflight.get(id);
      prev?.abort();
      const ac = new AbortController();
      inflight.set(id, ac);
      const outer = options?.signal;
      if (outer) {
        if (outer.aborted) {
          ac.abort();
        } else {
          outer.addEventListener('abort', () => ac.abort(), { once: true });
        }
      }

      try {
        const res = await fetch(url, { signal: ac.signal, mode: 'cors', credentials: 'omit' });
        if (!res.ok) {
          throw new Error(`Download failed: HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (blob.size === 0) {
          throw new Error('Downloaded empty body');
        }
        const mimeType = blob.type || res.headers.get('Content-Type') || 'application/octet-stream';
        const now = Date.now();
        const row: OfflineTrackRow = {
          serverKey: key.scope.serverKey,
          libraryId: key.scope.libraryId,
          trackId: key.trackId,
          variant: key.variant ?? OFFLINE_MEDIA_DEFAULT_VARIANT,
          mimeType,
          byteLength: blob.size,
          updatedAt: now,
          body: blob,
        };
        const db = await openDb();
        await putTrackRow(db, row);
        const cacheKey = offlineMediaKeyId(key);
        emitOfflineMediaReady(cacheKey);
        scheduleWaveformPrecompute(key, row);
      } finally {
        inflight.delete(id);
      }
    },

    async delete(key: OfflineMediaKey): Promise<void> {
      const id = offlineMediaKeyId(key);
      inflight.get(id)?.abort();
      inflight.delete(id);
      const db = await openDb();
      const k = idbTrackKey(key);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('tracks', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('IDB delete tx failed'));
        tx.oncomplete = () => resolve();
        tx.objectStore('tracks').delete(k);
      });
    },

    async deleteScope(scope: LibraryCacheScope): Promise<void> {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('tracks', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('IDB deleteScope tx failed'));
        tx.oncomplete = () => resolve();
        const idx = tx.objectStore('tracks').index('byScope');
        const range = IDBKeyRange.only([scope.serverKey, scope.libraryId]);
        const cur = idx.openCursor(range);
        cur.onerror = () => reject(cur.error ?? new Error('deleteScope cursor failed'));
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) return;
          c.delete();
          c.continue();
        };
      });
    },

    async purgeAll(): Promise<void> {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('tracks', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('IDB purgeAll tx failed'));
        tx.oncomplete = () => resolve();
        tx.objectStore('tracks').clear();
      });
    },

    async deleteServerAccount(serverKey: string): Promise<void> {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('tracks', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('IDB purge tx failed'));
        const store = tx.objectStore('tracks');
        const cur = store.openCursor();
        cur.onerror = () => reject(cur.error ?? new Error('purge cursor failed'));
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) {
            resolve();
            return;
          }
          const row = c.value as OfflineTrackRow;
          if (row.serverKey === serverKey) {
            c.delete();
          }
          c.continue();
        };
      });
    },

    async totalReadyBytes(scopeFilter: LibraryCacheScope | null): Promise<number> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        let sum = 0;
        const cur = store.openCursor();
        cur.onerror = () => reject(cur.error ?? new Error('total bytes cursor failed'));
        cur.onsuccess = () => {
          const c = cur.result;
          if (!c) {
            resolve(sum);
            return;
          }
          const row = c.value as OfflineTrackRow;
          if (inScope(row, scopeFilter)) {
            sum += row.byteLength;
          }
          c.continue();
        };
      });
    },
  };
}
