import type { Child } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import type { OfflineMediaStore } from '../offline/OfflineMediaStore';
import type { LibraryCacheScope } from './cacheScope';
import { DEFAULT_LIBRARY_ID } from './constants';
import { fetchAllLibrarySongs } from './fetchAllLibrarySongs';
import {
  purgeRemovedLibraryCacheEntries,
  removedSongIdsFromLibraryRefresh,
} from './purgeRemovedLibraryCacheEntries';
import { refreshPlaylistSummariesOnly } from './playlistMutations';
import type { LibraryCacheStorage } from './storage/LibraryCacheStorage';

export type RefreshLibraryCacheOptions = {
  /** When set, downloaded audio for tracks removed from the server is deleted during refresh. */
  offlineMedia?: OfflineMediaStore;
};

export type LibraryRefreshProgress =
  | { phase: 'fetch'; loaded: number }
  | { phase: 'write'; written: number }
  | { phase: 'playlists' };

/**
 * Full library refresh: paginated songs (`search3`, same as legacy iOS), write through {@link LibraryCacheStorage},
 * then playlist summaries. Compares the latest server list to the pre-refresh cache and purges local rows for
 * removed tracks (offline downloads when {@link RefreshLibraryCacheOptions.offlineMedia} is provided; library
 * songs via {@link LibraryCacheStorage.replaceSongList}). Derived artist/album index rows stay intact until
 * {@link LibraryCacheStorage.replaceSongList} atomically replaces songs and rebuilds those indexes from the new
 * song list. Cover art is filled separately via {@link runLibraryArtworkBackgroundCache}.
 */
export async function refreshLibraryCache(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: LibraryCacheScope,
  onProgress?: (p: LibraryRefreshProgress) => void,
  options?: RefreshLibraryCacheOptions
): Promise<{ songCount: number; songs: Child[]; removedSongCount: number }> {
  const cachedSongs = await storage.readSongList(scope);

  const musicFolderId = scope.libraryId === DEFAULT_LIBRARY_ID ? undefined : scope.libraryId;
  const songs = await fetchAllLibrarySongs(
    api,
    (loaded) => {
      onProgress?.({ phase: 'fetch', loaded });
    },
    { musicFolderId }
  );

  const removedTrackIds = removedSongIdsFromLibraryRefresh(cachedSongs, songs);
  await purgeRemovedLibraryCacheEntries(scope, songs, options?.offlineMedia);

  await storage.replaceSongList(scope, songs, (written) => {
    onProgress?.({ phase: 'write', written });
  });

  await refreshPlaylistSummariesOnly(api, storage, scope);
  onProgress?.({ phase: 'playlists' });
  return { songCount: songs.length, songs, removedSongCount: removedTrackIds.length };
}
