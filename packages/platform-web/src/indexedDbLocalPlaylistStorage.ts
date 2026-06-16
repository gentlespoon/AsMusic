import {
  randomUuidV4,
  type LocalPlaylistStore,
  type LocalPlaylistSummary,
  type LocalPlaylistTrackRef,
} from '@asmusic/core';

const DB_NAME = 'asmusic-local-playlists';
const DB_VERSION = 1;

type PlaylistRow = {
  id: string;
  name: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
  sortIndex: number;
};

type EntryRow = LocalPlaylistTrackRef & {
  playlistId: string;
  sortIndex: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB local playlists open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('playlists')) {
        const store = db.createObjectStore('playlists', { keyPath: 'id' });
        store.createIndex('bySortIndex', 'sortIndex');
      }
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: ['playlistId', 'sortIndex'] });
        store.createIndex('byPlaylist', 'playlistId');
      }
    };
  });
}

async function readAllPlaylistRows(db: IDBDatabase): Promise<PlaylistRow[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readonly');
    const req = tx.objectStore('playlists').getAll();
    req.onerror = () => reject(req.error ?? new Error('read playlists failed'));
    req.onsuccess = () => {
      const rows = (req.result as PlaylistRow[]).slice();
      rows.sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name));
      resolve(rows);
    };
  });
}

async function readEntryRows(db: IDBDatabase, playlistId: string): Promise<EntryRow[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const idx = tx.objectStore('entries').index('byPlaylist');
    const req = idx.getAll(playlistId);
    req.onerror = () => reject(req.error ?? new Error('read entries failed'));
    req.onsuccess = () => {
      const rows = (req.result as EntryRow[]).slice();
      rows.sort((a, b) => a.sortIndex - b.sortIndex);
      resolve(rows);
    };
  });
}

function summaryFromRow(row: PlaylistRow): LocalPlaylistSummary {
  return {
    id: row.id,
    name: row.name,
    trackCount: row.trackCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createIndexedDbLocalPlaylistStorage(): LocalPlaylistStore {
  return {
    backend: 'indexeddb',

    async listSummaries() {
      const db = await openDb();
      const rows = await readAllPlaylistRows(db);
      return rows.map(summaryFromRow);
    },

    async readEntries(playlistId) {
      const db = await openDb();
      const rows = await readEntryRows(db, playlistId);
      return rows.map(({ playlistId: _p, sortIndex, ...ref }) => ({ ...ref, sortIndex }));
    },

    async create(name) {
      const db = await openDb();
      const now = Date.now();
      const rows = await readAllPlaylistRows(db);
      const id = randomUuidV4();
      const row: PlaylistRow = {
        id,
        name,
        trackCount: 0,
        createdAt: now,
        updatedAt: now,
        sortIndex: rows.length,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('playlists', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('create playlist failed'));
        tx.oncomplete = () => resolve();
        tx.objectStore('playlists').put(row);
      });
      return summaryFromRow(row);
    },

    async rename(playlistId, name) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('playlists', 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('rename playlist failed'));
        tx.oncomplete = () => resolve();
        const store = tx.objectStore('playlists');
        const req = store.get(playlistId);
        req.onerror = () => reject(req.error ?? new Error('read playlist failed'));
        req.onsuccess = () => {
          const row = req.result as PlaylistRow | undefined;
          if (!row) {
            reject(new Error('Playlist not found'));
            return;
          }
          store.put({ ...row, name, updatedAt: Date.now() });
        };
      });
    },

    async delete(playlistId) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['playlists', 'entries'], 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('delete playlist failed'));
        tx.oncomplete = () => resolve();
        tx.objectStore('playlists').delete(playlistId);
        const idx = tx.objectStore('entries').index('byPlaylist');
        const req = idx.openKeyCursor(IDBKeyRange.only(playlistId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            tx.objectStore('entries').delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      });
    },

    async replaceEntries(playlistId, refs) {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['playlists', 'entries'], 'readwrite');
        tx.onerror = () => reject(tx.error ?? new Error('replace entries failed'));
        tx.oncomplete = () => resolve();
        const playlistStore = tx.objectStore('playlists');
        const entryStore = tx.objectStore('entries');
        const getReq = playlistStore.get(playlistId);
        getReq.onerror = () => reject(getReq.error ?? new Error('read playlist failed'));
        getReq.onsuccess = () => {
          const row = getReq.result as PlaylistRow | undefined;
          if (!row) {
            reject(new Error('Playlist not found'));
            return;
          }
          const idx = entryStore.index('byPlaylist');
          const delReq = idx.openKeyCursor(IDBKeyRange.only(playlistId));
          delReq.onsuccess = () => {
            const cursor = delReq.result;
            if (cursor) {
              entryStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              refs.forEach((ref, sortIndex) => {
                entryStore.put({ playlistId, sortIndex, ...ref });
              });
              playlistStore.put({
                ...row,
                trackCount: refs.length,
                updatedAt: Date.now(),
              });
            }
          };
        };
      });
    },

    async appendTrack(playlistId, ref) {
      const db = await openDb();
      const existing = await readEntryRows(db, playlistId);
      const dup = existing.some(
        (e) =>
          e.serverKey === ref.serverKey &&
          e.libraryId === ref.libraryId &&
          e.trackId === ref.trackId
      );
      if (dup) return;
      const nextRefs: LocalPlaylistTrackRef[] = [
        ...existing.map(({ sortIndex: _i, playlistId: _p, ...r }) => r),
        ref,
      ];
      await this.replaceEntries(playlistId, nextRefs);
    },
  };
}
