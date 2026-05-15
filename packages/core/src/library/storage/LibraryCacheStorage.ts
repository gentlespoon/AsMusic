import type { Child } from 'subsonic-api';
import type { LibraryCacheScope } from '../cacheScope';

/** Sync metadata for a library scope (backend-agnostic). */
export type LibraryCacheMeta = {
  lastSyncAt: number;
  songCount: number;
};

export type LibraryPlaylistSummary = {
  id: string;
  name: string;
  songCount: number;
};

/** Binary cover-art row for `putArtworkBlob` / `readArtworkBlob`. */
export type LibraryArtworkCacheRow = {
  coverArtId: string;
  data: Uint8Array;
  mimeType: string;
};

/**
 * Platform library persistence. UI and sync logic depend only on this contract;
 * IndexedDB, SQLite (plugin), etc. live behind implementations.
 */
export interface LibraryCacheStorage {
  /** Stable tag for diagnostics (e.g. `indexeddb`). */
  readonly backend: string;
  readSongList(scope: LibraryCacheScope): Promise<Child[]>;
  readMeta(scope: LibraryCacheScope): Promise<LibraryCacheMeta | null>;
  /**
   * Number of rows in the materialized album index for this scope (written during {@link replaceSongList}).
   * Cheap to query; does not load songs.
   */
  readCachedAlbumCount(scope: LibraryCacheScope): Promise<number>;
  /**
   * Clears derived album/artist index rows for the scope (not songs).
   * Invoked at the start of a full library refresh so indexes stay empty while songs are re-fetched.
   */
  purgeArtistAndAlbumCaches(scope: LibraryCacheScope): Promise<void>;
  replaceSongList(scope: LibraryCacheScope, songs: Child[], onProgress?: (written: number) => void): Promise<void>;
  /** Upserts one cached track row (e.g. after star/unstar) without rewriting the whole library. */
  patchSong(scope: LibraryCacheScope, song: Child): Promise<void>;
  readPlaylistSummaries(scope: LibraryCacheScope): Promise<LibraryPlaylistSummary[]>;
  replacePlaylistSummaries(scope: LibraryCacheScope, playlists: LibraryPlaylistSummary[]): Promise<void>;
  /** Removes all cached artwork for the scope (e.g. before a background refill). */
  clearArtworkCache(scope: LibraryCacheScope): Promise<void>;
  /** Upserts one cover-art blob for the scope. */
  putArtworkBlob(scope: LibraryCacheScope, entry: LibraryArtworkCacheRow): Promise<void>;
  readArtworkBlob(scope: LibraryCacheScope, coverArtId: string): Promise<LibraryArtworkCacheRow | null>;
  deleteScope(scope: LibraryCacheScope): Promise<void>;
  /**
   * Remove every row for this account server key (from `serverAccountKey()` in `@asmusic/core`) across all music folders.
   */
  purgeServerAccount(accountServerKey: string): Promise<void>;
}
