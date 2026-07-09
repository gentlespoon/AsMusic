import { useMemo } from 'react';
import type { SubsonicAPI } from '@asmusic/core';
import { useServerAndLibrary } from '@ui/contexts/ServerAndLibraryContext';
import { useHost } from '@ui/host/HostContext';
import { buildCoverArtSources } from '@ui/shared/coverArt';
import type { PlayerQueueItem } from '@ui/player/core/types';
import { playerQueueItemArtworkScope } from './resolvePlayerCachedArtwork';
import { usePlayerCoverArtCacheBump } from './usePlayerCoverArtCacheBump';
import { usePlayerArtworkCacheKey } from './usePlayerArtworkCacheKey';

export function usePlayerCoverArt(
  item: PlayerQueueItem | null,
  api?: SubsonicAPI | null,
) {
  const host = useHost();
  const { getCoverArtUrl } = useServerAndLibrary();
  const artworkCacheBump = usePlayerCoverArtCacheBump(item);
  const artworkCacheKey = usePlayerArtworkCacheKey(item);

  const sources = useMemo(() => {
    if (!item) return undefined;
    return buildCoverArtSources({
      libraryCache: host.libraryCache,
      serverUrl: item.serverUrl,
      username: item.username,
      libraryId: item.libraryId,
      scope: playerQueueItemArtworkScope(item),
      api: api ?? undefined,
      getCoverArtUrl: (coverArtId) => getCoverArtUrl(item.serverId, coverArtId),
    });
  }, [api, getCoverArtUrl, host.libraryCache, item]);

  return {
    sources,
    artworkCacheKey,
    artworkCacheBump,
    coverArtId: item?.coverArtId,
    fallbackCoverArtId: item?.coverArtFallbackId,
  };
}
