import { useLibraryBrowseCache } from '@ui/contexts/LibraryBrowseCacheContext';
import type { PlayerQueueItem } from '@ui/player/core/types';
import { playerQueueItemArtworkScope } from './resolvePlayerCachedArtwork';

export function usePlayerCoverArtCacheBump(item: PlayerQueueItem | null): number {
  const { getArtworkCacheBump } = useLibraryBrowseCache();
  const coverArtId = item?.coverArtId?.trim();
  if (!item || !coverArtId) return 0;
  return getArtworkCacheBump(coverArtId, playerQueueItemArtworkScope(item));
}
