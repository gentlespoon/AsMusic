import type { AlbumID3, ArtistID3, Child } from 'subsonic-api';
import {
  albumsFromCachedSongs,
  artistsFromCachedSongs,
  type LibraryCacheScope,
  type LibraryArtworkCacheRow,
  type LibraryCacheMeta,
  type LibraryCacheStorage,
  type LibraryPlaylistSummary,
} from '@asmusic/core';

const DB_NAME = 'asmusic-library-cache';
const DB_VERSION = 5;

type SongRow = {
  serverKey: string;
  libraryId: string;
  songId: string;
  sortIndex: number;
  song: Child;
};

type ArtworkRow = {
  serverKey: string;
  libraryId: string;
  coverArtId: string;
  mimeType: string;
  data: Uint8Array;
  updatedAt: number;
};

type ArtistRow = {
  serverKey: string;
  libraryId: string;
  artistId: string;
  sortIndex: number;
  artist: ArtistID3;
};

type AlbumRow = {
  serverKey: string;
  libraryId: string;
  albumId: string;
  sortIndex: number;
  album: AlbumID3;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) {
        reject(new Error('IndexedDB upgrade missing transaction'));
        return;
      }
      if (ev.oldVersion < 1) {
        const songs = db.createObjectStore('songs', { keyPath: ['serverKey', 'libraryId', 'songId'] });
        songs.createIndex('byScope', ['serverKey', 'libraryId']);
        db.createObjectStore('meta', { keyPath: ['serverKey', 'libraryId'] });
        const playlists = db.createObjectStore('playlists', { keyPath: ['serverKey', 'libraryId', 'playlistId'] });
        playlists.createIndex('byScopePl', ['serverKey', 'libraryId']);
      }
      if (ev.oldVersion < 2) {
        const artwork = db.createObjectStore('artwork', { keyPath: ['serverKey', 'libraryId', 'coverArtId'] });
        artwork.createIndex('byScopeArt', ['serverKey', 'libraryId']);
      }
      if (ev.oldVersion < 3) {
        const artists = db.createObjectStore('artists', { keyPath: ['serverKey', 'libraryId', 'artistId'] });
        artists.createIndex('byScopeArtists', ['serverKey', 'libraryId']);
        const albums = db.createObjectStore('albums', { keyPath: ['serverKey', 'libraryId', 'albumId'] });
        albums.createIndex('byScopeAlbums', ['serverKey', 'libraryId']);

        if (db.objectStoreNames.contains('artwork')) {
          const artworks = db.createObjectStore('artworks', { keyPath: ['serverKey', 'libraryId', 'coverArtId'] });
          artworks.createIndex('byScopeArtwork', ['serverKey', 'libraryId']);
          const oldStore = tx.objectStore('artwork');
          const newStore = tx.objectStore('artworks');
          const cur = oldStore.openCursor();
          cur.onerror = () => {
            /* upgrade fails via transaction */
          };
          cur.onsuccess = () => {
            const cursor = cur.result;
            if (cursor) {
              newStore.put(cursor.value as ArtworkRow);
              cursor.continue();
            } else {
              db.deleteObjectStore('artwork');
            }
          };
        } else if (!db.objectStoreNames.contains('artworks')) {
          const artworks = db.createObjectStore('artworks', { keyPath: ['serverKey', 'libraryId', 'coverArtId'] });
          artworks.createIndex('byScopeArtwork', ['serverKey', 'libraryId']);
        }
      }
      if (ev.oldVersion < 4) {
        /** Account-level serverKey; wipe legacy rows from older key derivation. */
        const names: string[] = [];
        for (let i = 0; i < db.objectStoreNames.length; i++) {
          names.push(db.objectStoreNames[i]!);
        }
        for (const name of names) {
          tx.objectStore(name).clear();
        }
      }
      if (ev.oldVersion < 5) {
        const playlistTrackLists = db.createObjectStore('playlistTrackLists', {
          keyPath: ['serverKey', 'libraryId', 'playlistId'],
        });
        playlistTrackLists.createIndex('byScopePt', ['serverKey', 'libraryId']);
      }
    };
  });
}

function countAlbumsForScopeDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readonly');
    const store = tx.objectStore('albums');
    const idx = store.index('byScopeAlbums');
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const req = idx.count(range);
    req.onsuccess = () => resolve(typeof req.result === 'number' ? req.result : 0);
    req.onerror = () => reject(req.error);
  });
}

function readMetaDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<LibraryCacheMeta | null> {
  type MetaRow = LibraryCacheMeta & { serverKey: string; libraryId: string };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get([serverKey, libraryId]);
    req.onsuccess = () => {
      const row = req.result as MetaRow | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      resolve({ lastSyncAt: row.lastSyncAt, songCount: row.songCount });
    };
    req.onerror = () => reject(req.error);
  });
}

function readAllSongsDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<Child[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readonly');
    const store = tx.objectStore('songs');
    const idx = store.index('byScope');
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const req = idx.getAll(range);
    req.onsuccess = () => {
      const rows = (req.result as SongRow[]) ?? [];
      rows.sort((a, b) => a.sortIndex - b.sortIndex);
      resolve(rows.map((r) => r.song));
    };
    req.onerror = () => reject(req.error);
  });
}

function patchSongDb(db: IDBDatabase, serverKey: string, libraryId: string, song: Child): Promise<void> {
  const songId = String(song.id);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('songs', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    const store = tx.objectStore('songs');
    const key: [string, string, string] = [serverKey, libraryId, songId];
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as SongRow | undefined;
      if (!row) {
        reject(new Error('patchSong: song not in cache'));
        return;
      }
      store.put({
        ...row,
        song,
      } satisfies SongRow);
    };
  });
}

function replaceSongsDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  songs: Child[],
  onProgress?: (written: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'meta', 'artists', 'albums'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));

    const range = IDBKeyRange.only([serverKey, libraryId]);
    const songsStore = tx.objectStore('songs');
    const artistsStore = tx.objectStore('artists');
    const albumsStore = tx.objectStore('albums');
    const metaStore = tx.objectStore('meta');

    const clearByScope = (store: IDBObjectStore, indexName: string, onEmpty: () => void) => {
      const idx = store.index(indexName);
      const r = idx.openCursor(range);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const c = r.result;
        if (c) {
          c.delete();
          c.continue();
        } else {
          onEmpty();
        }
      };
    };

    clearByScope(songsStore, 'byScope', () => {
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        songsStore.put({
          serverKey,
          libraryId,
          songId: song.id,
          sortIndex: i,
          song,
        });
        if (i === 0 || i === songs.length - 1 || (i + 1) % 400 === 0) {
          onProgress?.(i + 1);
        }
      }

      clearByScope(artistsStore, 'byScopeArtists', () => {
        const artists = artistsFromCachedSongs(songs);
        artists.forEach((artist, sortIndex) => {
          artistsStore.put({
            serverKey,
            libraryId,
            artistId: artist.id,
            sortIndex,
            artist,
          } satisfies ArtistRow);
        });

        clearByScope(albumsStore, 'byScopeAlbums', () => {
          const albums = albumsFromCachedSongs(songs);
          albums.forEach((album, sortIndex) => {
            albumsStore.put({
              serverKey,
              libraryId,
              albumId: album.id,
              sortIndex,
              album,
            } satisfies AlbumRow);
          });

          metaStore.put({
            serverKey,
            libraryId,
            lastSyncAt: Date.now(),
            songCount: songs.length,
          });
        });
      });
    });
  });
}

function readPlaylistsDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string
): Promise<LibraryPlaylistSummary[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readonly');
    const store = tx.objectStore('playlists');
    const idx = store.index('byScopePl');
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const req = idx.getAll(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      type Row = {
        playlistId: string;
        name: string;
        songCount: number;
        sortIndex?: number;
      };
      const rows = (req.result as Row[] | undefined) ?? [];
      rows.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
      resolve(
        rows.map((r) => ({
          id: r.playlistId,
          name: r.name,
          songCount: r.songCount,
        }))
      );
    };
  });
}

function replacePlaylistsDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  rows: LibraryPlaylistSummary[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));

    const store = tx.objectStore('playlists');
    const idx = store.index('byScopePl');
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const delReq = idx.openCursor(range);
    delReq.onerror = () => reject(delReq.error);
    delReq.onsuccess = () => {
      const cursor = delReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
      rows.forEach((p, sortIndex) => {
        store.put({
          serverKey,
          libraryId,
          playlistId: p.id,
          sortIndex,
          name: p.name,
          songCount: p.songCount,
        });
      });
    };
  });
}

type PlaylistTrackListRow = {
  serverKey: string;
  libraryId: string;
  playlistId: string;
  trackIds: string[];
};

function readPlaylistEntryTrackIdsDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  playlistId: string,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlistTrackLists', 'readonly');
    const store = tx.objectStore('playlistTrackLists');
    const req = store.get([serverKey, libraryId, playlistId]);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as PlaylistTrackListRow | undefined;
      resolve(row?.trackIds ?? []);
    };
  });
}

function replacePlaylistEntryTrackIdsDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  playlistId: string,
  trackIds: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlistTrackLists', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    const store = tx.objectStore('playlistTrackLists');
    if (trackIds.length === 0) {
      store.delete([serverKey, libraryId, playlistId]);
      return;
    }
    store.put({ serverKey, libraryId, playlistId, trackIds });
  });
}

function purgePlaylistEntryTrackIdsNotInDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  playlistIds: string[],
): Promise<void> {
  const keep = new Set(playlistIds);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlistTrackLists', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    const store = tx.objectStore('playlistTrackLists');
    const idx = store.index('byScopePt');
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const req = idx.openCursor(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const row = cursor.value as PlaylistTrackListRow;
      if (!keep.has(row.playlistId)) {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

function clearArtworkDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<void> {
  return clearObjectStoreByScope(db, 'artworks', 'byScopeArtwork', serverKey, libraryId);
}

function purgeAllArtworkDb(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('artworks', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB purgeAllArtwork tx failed'));
    tx.objectStore('artworks').clear();
  });
}

function putArtworkBlobDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  entry: LibraryArtworkCacheRow
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('artworks', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.objectStore('artworks').put({
      serverKey,
      libraryId,
      coverArtId: entry.coverArtId,
      mimeType: entry.mimeType,
      data: entry.data.slice(),
      updatedAt: Date.now(),
    } satisfies ArtworkRow);
  });
}

function readArtworkDb(
  db: IDBDatabase,
  serverKey: string,
  libraryId: string,
  coverArtId: string
): Promise<LibraryArtworkCacheRow | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('artworks', 'readonly');
    const req = tx.objectStore('artworks').get([serverKey, libraryId, coverArtId]);
    req.onsuccess = () => {
      const row = req.result as ArtworkRow | undefined;
      if (!row?.data?.byteLength) {
        resolve(null);
        return;
      }
      resolve({
        coverArtId: row.coverArtId,
        mimeType: row.mimeType,
        data: row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data as ArrayBuffer),
      });
    };
    req.onerror = () => reject(req.error);
  });
}

function clearObjectStoreByScope(
  db: IDBDatabase,
  storeName: 'songs' | 'playlists' | 'playlistTrackLists' | 'artworks' | 'artists' | 'albums',
  indexName: 'byScope' | 'byScopePl' | 'byScopePt' | 'byScopeArtwork' | 'byScopeArtists' | 'byScopeAlbums',
  serverKey: string,
  libraryId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    const range = IDBKeyRange.only([serverKey, libraryId]);
    const r = idx.openCursor(range);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  });
}

function deleteScopeDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<void> {
  return (async () => {
    await clearObjectStoreByScope(db, 'songs', 'byScope', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'playlists', 'byScopePl', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'playlistTrackLists', 'byScopePt', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'artworks', 'byScopeArtwork', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'artists', 'byScopeArtists', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'albums', 'byScopeAlbums', serverKey, libraryId);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.objectStore('meta').delete([serverKey, libraryId]);
    });
  })();
}

function purgeArtistAndAlbumCachesDb(db: IDBDatabase, serverKey: string, libraryId: string): Promise<void> {
  return (async () => {
    await clearObjectStoreByScope(db, 'artists', 'byScopeArtists', serverKey, libraryId);
    await clearObjectStoreByScope(db, 'albums', 'byScopeAlbums', serverKey, libraryId);
  })();
}

const STORES_WITH_SERVER_KEY = ['songs', 'meta', 'playlists', 'playlistTrackLists', 'artworks', 'artists', 'albums'] as const;

function purgeServerAccountDb(db: IDBDatabase, accountServerKey: string): Promise<void> {
  return (async () => {
    for (const name of STORES_WITH_SERVER_KEY) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(name, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        const store = tx.objectStore(name);
        const r = store.openCursor();
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const c = r.result;
          if (!c) {
            return;
          }
          const v = c.value as { serverKey?: string };
          if (v.serverKey === accountServerKey) {
            c.delete();
          }
          c.continue();
        };
      });
    }
  })();
}

/** IndexedDB-backed {@link LibraryCacheStorage} (browser and Capacitor WebView). */
export function createIndexedDbLibraryCacheStorage(): LibraryCacheStorage {
  return {
    backend: 'indexeddb',
    async readSongList(scope: LibraryCacheScope) {
      const db = await openDb();
      return readAllSongsDb(db, scope.serverKey, scope.libraryId);
    },
    async readMeta(scope: LibraryCacheScope) {
      const db = await openDb();
      return readMetaDb(db, scope.serverKey, scope.libraryId);
    },
    async readCachedAlbumCount(scope: LibraryCacheScope) {
      const db = await openDb();
      return countAlbumsForScopeDb(db, scope.serverKey, scope.libraryId);
    },
    async purgeArtistAndAlbumCaches(scope: LibraryCacheScope) {
      const db = await openDb();
      await purgeArtistAndAlbumCachesDb(db, scope.serverKey, scope.libraryId);
    },
    async replaceSongList(scope, songs, onProgress) {
      const db = await openDb();
      await replaceSongsDb(db, scope.serverKey, scope.libraryId, songs, onProgress);
    },
    async patchSong(scope, song) {
      const db = await openDb();
      await patchSongDb(db, scope.serverKey, scope.libraryId, song);
    },
    async readPlaylistSummaries(scope) {
      const db = await openDb();
      return readPlaylistsDb(db, scope.serverKey, scope.libraryId);
    },
    async replacePlaylistSummaries(scope, playlists) {
      const db = await openDb();
      await replacePlaylistsDb(db, scope.serverKey, scope.libraryId, playlists);
    },
    async readPlaylistEntryTrackIds(scope, playlistId) {
      const db = await openDb();
      return readPlaylistEntryTrackIdsDb(db, scope.serverKey, scope.libraryId, playlistId);
    },
    async replacePlaylistEntryTrackIds(scope, playlistId, trackIds) {
      const db = await openDb();
      await replacePlaylistEntryTrackIdsDb(db, scope.serverKey, scope.libraryId, playlistId, trackIds);
    },
    async purgePlaylistEntryTrackIdsNotIn(scope, playlistIds) {
      const db = await openDb();
      await purgePlaylistEntryTrackIdsNotInDb(db, scope.serverKey, scope.libraryId, playlistIds);
    },
    async clearArtworkCache(scope) {
      const db = await openDb();
      await clearArtworkDb(db, scope.serverKey, scope.libraryId);
    },
    async purgeAllArtworkCache() {
      const db = await openDb();
      await purgeAllArtworkDb(db);
    },
    async putArtworkBlob(scope, entry) {
      const db = await openDb();
      await putArtworkBlobDb(db, scope.serverKey, scope.libraryId, entry);
    },
    async readArtworkBlob(scope, coverArtId) {
      const db = await openDb();
      return readArtworkDb(db, scope.serverKey, scope.libraryId, coverArtId);
    },
    async deleteScope(scope) {
      const db = await openDb();
      await deleteScopeDb(db, scope.serverKey, scope.libraryId);
    },
    async purgeServerAccount(accountServerKey) {
      const db = await openDb();
      await purgeServerAccountDb(db, accountServerKey);
    },
  };
}
