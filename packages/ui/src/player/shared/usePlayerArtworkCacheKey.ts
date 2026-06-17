import { useLibraryBrowseCache } from '../../contexts/LibraryBrowseCacheContext';
import type { PlayerQueueItem } from '../core/types';
import { playerQueueItemArtworkScope } from './resolvePlayerCachedArtwork';

/** Matches library browse {@link artworkVersionKey} so player shares cover-art cache entries. */
export function usePlayerArtworkCacheKey(item: PlayerQueueItem | null): string | undefined {
  const { artworkVersionKey } = useLibraryBrowseCache();
  const coverArtId = item?.coverArtId?.trim();
  if (!item || !coverArtId) return undefined;
  return artworkVersionKey(coverArtId, playerQueueItemArtworkScope(item));
}
