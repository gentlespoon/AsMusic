import {
  albumsFromCachedSongs,
  libraryCacheScope,
  resolveCoverArtIdsForCachedSong,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type LibraryCacheStorage,
} from '@asmusic/core';
import type { AlbumID3 } from 'subsonic-api';
import { createResolveCachedArtwork } from '@ui/shared/createResolveCachedArtwork';
import {
  createPersistCachedArtworkForScope,
  type PersistCachedArtwork,
} from '@ui/shared/libraryArtworkCacheAccess';
import type { PlayerQueueItem } from '@ui/player/core/types';

type QueueItemCoverArtLookup = {
  slices?: readonly { scope: LibraryCacheScope; songs: import('subsonic-api').Child[] }[];
  albumCatalogRows?: readonly {
    album: AlbumID3;
    serverId: string;
    artworkScope: LibraryCacheScope;
  }[];
};

/** Ordered `getCoverArt` ids for a queue item, including album fallbacks from library cache. */
export function resolveCoverArtIdsToTryForQueueItem(
  item: PlayerQueueItem,
  lookup?: QueueItemCoverArtLookup,
): string[] {
  const primary = item.coverArtId?.trim();
  if (!primary) return [];

  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id?: string) => {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    ids.push(trimmed);
  };

  push(primary);
  push(item.coverArtFallbackId);

  const scope = playerQueueItemArtworkScope(item);
  const slice = lookup?.slices?.find(
    (s) => s.scope.serverKey === scope.serverKey && s.scope.libraryId === scope.libraryId,
  );
  if (slice) {
    const song = slice.songs.find((s) => String(s.id) === item.trackId);
    if (song) {
      const albums = albumsFromCachedSongs(slice.songs);
      const { primary: resolvedPrimary, fallback } = resolveCoverArtIdsForCachedSong(song, albums);
      push(resolvedPrimary);
      push(fallback);
    }
  } else if (lookup?.albumCatalogRows && item.album?.trim()) {
    const albumTitle = item.album.trim();
    for (const row of lookup.albumCatalogRows) {
      if (row.serverId !== item.serverId) continue;
      if (row.artworkScope.serverKey !== scope.serverKey) continue;
      if (row.artworkScope.libraryId !== scope.libraryId) continue;
      if (row.album.name?.trim() !== albumTitle) continue;
      push(row.album.coverArt?.trim());
      break;
    }
  }

  return ids;
}

export function playerQueueItemArtworkScope(item: PlayerQueueItem): LibraryCacheScope {
  return libraryCacheScope(item.serverUrl, item.username, item.libraryId);
}

export function resolvePlayerCachedArtwork(
  libraryCache: LibraryCacheStorage,
  item: PlayerQueueItem,
): (coverArtId: string) => Promise<LibraryArtworkCacheRow | null> {
  return createResolveCachedArtwork(
    libraryCache,
    item.serverUrl,
    item.username,
    item.libraryId,
  );
}

export function resolvePlayerArtworkLocalFile(
  libraryCache: LibraryCacheStorage,
  item: PlayerQueueItem,
): ((coverArtId: string) => Promise<{ localFilePath: string; mimeType: string } | null>) | undefined {
  if (!libraryCache.readArtworkLocalFile) return undefined;
  const scope = playerQueueItemArtworkScope(item);
  return (coverArtId) => libraryCache.readArtworkLocalFile!(scope, coverArtId);
}

export function persistPlayerCachedArtwork(
  libraryCache: LibraryCacheStorage,
  item: PlayerQueueItem,
): PersistCachedArtwork {
  const scope = playerQueueItemArtworkScope(item);
  return createPersistCachedArtworkForScope(libraryCache, scope);
}
