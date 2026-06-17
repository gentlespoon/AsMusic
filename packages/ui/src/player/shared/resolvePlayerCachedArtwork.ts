import {
  libraryCacheScope,
  type LibraryArtworkCacheRow,
  type LibraryCacheScope,
  type LibraryCacheStorage,
} from '@asmusic/core';
import { createResolveCachedArtwork } from '../../shared/createResolveCachedArtwork';
import {
  createPersistCachedArtworkForScope,
  type PersistCachedArtwork,
} from '../../shared/libraryArtworkCacheAccess';
import type { PlayerQueueItem } from '../core/types';

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
