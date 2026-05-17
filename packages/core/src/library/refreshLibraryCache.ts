import type { Child } from 'subsonic-api';
import type { SubsonicAPI } from '../api/client';
import type { LibraryCacheScope } from './cacheScope';
import { DEFAULT_LIBRARY_ID } from './constants';
import { fetchAllLibrarySongs } from './fetchAllLibrarySongs';
import { refreshPlaylistSummariesOnly } from './playlistMutations';
import type { LibraryCacheStorage } from './storage/LibraryCacheStorage';

export type LibraryRefreshProgress =
  | { phase: 'fetch'; loaded: number }
  | { phase: 'write'; written: number }
  | { phase: 'playlists' };

/**
 * Full library refresh: paginated songs (`search3`, same as legacy iOS), write through {@link LibraryCacheStorage},
 * then playlist summaries. Clears derived artist/album index rows before the network fetch; backends rebuild
 * those indexes from the new song list when persisting. Cover art is filled separately via {@link runLibraryArtworkBackgroundCache}.
 */
export async function refreshLibraryCache(
  api: SubsonicAPI,
  storage: LibraryCacheStorage,
  scope: LibraryCacheScope,
  onProgress?: (p: LibraryRefreshProgress) => void
): Promise<{ songCount: number; songs: Child[] }> {
  await storage.purgeArtistAndAlbumCaches(scope);

  const musicFolderId = scope.libraryId === DEFAULT_LIBRARY_ID ? undefined : scope.libraryId;
  const songs = await fetchAllLibrarySongs(
    api,
    (loaded) => {
      onProgress?.({ phase: 'fetch', loaded });
    },
    { musicFolderId }
  );

  await storage.replaceSongList(scope, songs, (written) => {
    onProgress?.({ phase: 'write', written });
  });

  await refreshPlaylistSummariesOnly(api, storage, scope);
  onProgress?.({ phase: 'playlists' });
  return { songCount: songs.length, songs };
}
