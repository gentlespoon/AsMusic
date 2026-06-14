import {
  libraryCacheScope,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type LibraryCacheStorage,
} from '@asmusic/core';
import type { PlayerQueueItem } from '../core/types';

export function playerQueueItemArtworkScope(item: PlayerQueueItem): LibraryCacheScope {
  return libraryCacheScope(item.serverUrl, item.username, item.libraryId);
}

export function playerQueueItemArtworkCacheKey(item: PlayerQueueItem): string {
  const scope = playerQueueItemArtworkScope(item);
  return `${scope.serverKey}|${scope.libraryId}`;
}

export function resolvePlayerCachedArtwork(
  libraryCache: LibraryCacheStorage,
  item: PlayerQueueItem,
): (coverArtId: string) => Promise<LibraryArtworkCacheRow | null> {
  const scope = playerQueueItemArtworkScope(item);
  return (coverArtId) => libraryCache.readArtworkBlob(scope, coverArtId);
}
