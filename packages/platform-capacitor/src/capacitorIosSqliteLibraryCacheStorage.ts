import type { Child } from 'subsonic-api';
import {
  albumsFromCachedSongs,
  artistsFromCachedSongs,
  type LibraryCacheScope,
  type LibraryCacheMeta,
  type LibraryCacheStorage,
  type LibraryPlaylistSummary,
} from '@asmusic/core';
import { AsmusicNative } from './asmusicNativePlugin';

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Cap concurrent large base64→SQLite artwork writes so they cannot starve library sync RPCs. */
const MAX_ARTWORK_PUT_INFLIGHT = 2;
let artworkPutInflight = 0;
const artworkPutWaiters: Array<() => void> = [];

async function withArtworkPutSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (artworkPutInflight >= MAX_ARTWORK_PUT_INFLIGHT) {
    await new Promise<void>((resolve) => {
      artworkPutWaiters.push(resolve);
    });
  }
  artworkPutInflight += 1;
  try {
    return await fn();
  } finally {
    artworkPutInflight -= 1;
    const next = artworkPutWaiters.shift();
    next?.();
  }
}

/**
 * iOS native SQLite library cache via `AsmusicNative` Capacitor plugin.
 * Matches {@link LibraryCacheStorage} semantics used by IndexedDB on web.
 */
export function createCapacitorIosSqliteLibraryCacheStorage(): LibraryCacheStorage {
  return {
    backend: 'sqlite-ios',
    async readSongList(scope: LibraryCacheScope): Promise<Child[]> {
      const { songsJson } = await AsmusicNative.libraryCacheReadSongList({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
      const parsed = JSON.parse(songsJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as Child[];
    },
    async readMeta(scope: LibraryCacheScope): Promise<LibraryCacheMeta | null> {
      const r = await AsmusicNative.libraryCacheReadMeta({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
      if (r.lastSyncAt == null || r.songCount == null) return null;
      // Native SQLite stores Unix time in seconds; JS `Date` / IndexedDB use milliseconds.
      return { lastSyncAt: r.lastSyncAt * 1000, songCount: r.songCount };
    },
    async readCachedAlbumCount(scope: LibraryCacheScope): Promise<number> {
      const r = await AsmusicNative.libraryCacheReadCachedAlbumCount({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
      return typeof r.albumCount === 'number' && Number.isFinite(r.albumCount) ? r.albumCount : 0;
    },
    async purgeArtistAndAlbumCaches(scope: LibraryCacheScope): Promise<void> {
      await AsmusicNative.libraryCachePurgeArtistAndAlbumCaches({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
    },
    async replaceSongList(scope, songs, onProgress) {
      const songsJson = JSON.stringify(songs);
      const artistsJson = JSON.stringify(artistsFromCachedSongs(songs));
      const albumsJson = JSON.stringify(albumsFromCachedSongs(songs));
      await AsmusicNative.libraryCacheReplaceSongList({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
        songsJson,
        artistsJson,
        albumsJson,
      });
      onProgress?.(songs.length);
    },
    async patchSong(scope, song) {
      await AsmusicNative.libraryCachePatchSong({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
        songId: String(song.id),
        songJson: JSON.stringify(song),
      });
    },
    async readPlaylistSummaries(scope) {
      const { playlistsJson } = await AsmusicNative.libraryCacheReadPlaylistSummaries({
        serverKey: scope.serverKey,
      });
      const parsed = JSON.parse(playlistsJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as LibraryPlaylistSummary[];
    },
    async replacePlaylistSummaries(scope, playlists: LibraryPlaylistSummary[]) {
      await AsmusicNative.libraryCacheReplacePlaylistSummaries({
        serverKey: scope.serverKey,
        playlistsJson: JSON.stringify(playlists),
      });
    },
    async readPlaylistEntryTrackIds(scope, playlistId) {
      const { trackIdsJson } = await AsmusicNative.libraryCacheReadPlaylistEntryTrackIds({
        serverKey: scope.serverKey,
        playlistId,
      });
      const parsed = JSON.parse(trackIdsJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((id) => String(id));
    },
    async replacePlaylistEntryTrackIds(scope, playlistId, trackIds) {
      await AsmusicNative.libraryCacheReplacePlaylistEntryTrackIds({
        serverKey: scope.serverKey,
        playlistId,
        trackIdsJson: JSON.stringify(trackIds),
      });
    },
    async purgePlaylistEntryTrackIdsNotIn(scope, playlistIds) {
      await AsmusicNative.libraryCachePurgePlaylistEntryTrackIdsNotIn({
        serverKey: scope.serverKey,
        playlistIdsJson: JSON.stringify(playlistIds),
      });
    },
    async clearArtworkCache(scope) {
      await AsmusicNative.libraryCacheClearArtwork({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
    },
    async purgeAllArtworkCache() {
      await AsmusicNative.libraryCachePurgeAllArtwork();
    },
    async putArtworkBlob(scope, entry) {
      await withArtworkPutSlot(() =>
        AsmusicNative.libraryCachePutArtworkBlob({
          serverKey: scope.serverKey,
          libraryId: scope.libraryId,
          coverArtId: entry.coverArtId,
          mimeType: entry.mimeType,
          base64: uint8ToBase64(entry.data),
        }),
      );
    },
    async readArtworkBlob(scope, coverArtId) {
      const r = await AsmusicNative.libraryCacheReadArtworkBlob({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
        coverArtId,
      });
      if (r.mimeType == null || r.base64 == null) return null;
      return {
        coverArtId,
        mimeType: r.mimeType,
        data: base64ToUint8(r.base64),
      };
    },
    async readArtworkLocalFile(scope, coverArtId) {
      const r = await AsmusicNative.libraryCacheMaterializeArtworkFile({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
        coverArtId,
      });
      if (r.localFilePath == null || r.mimeType == null) return null;
      return { localFilePath: r.localFilePath, mimeType: r.mimeType };
    },
    async deleteScope(scope) {
      await AsmusicNative.libraryCacheDeleteScope({
        serverKey: scope.serverKey,
        libraryId: scope.libraryId,
      });
    },
    async purgeServerAccount(accountServerKey) {
      await AsmusicNative.libraryCachePurgeServerAccount({
        serverKey: accountServerKey,
      });
    },
  };
}
