import { useLibraryBrowseCache } from '../../contexts/LibraryBrowseCacheContext';
import type { PlayerQueueItem } from '../core/types';
import { playerQueueItemArtworkScope } from './resolvePlayerCachedArtwork';

export function usePlayerCoverArtCacheBump(item: PlayerQueueItem | null): number {
  const { artworkVersionById, artworkVersionKey } = useLibraryBrowseCache();
  const coverArtId = item?.coverArtId?.trim();
  if (!item || !coverArtId) return 0;
  const scope = playerQueueItemArtworkScope(item);
  const key = artworkVersionKey(coverArtId, scope);
  return artworkVersionById[key] ?? 0;
}
