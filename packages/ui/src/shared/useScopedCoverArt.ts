import { useCallback, useMemo } from 'react';
import type { LibraryCacheScope, SubsonicAPI } from '@asmusic/core';
import { useLibraryBrowseCache } from '@ui/contexts/LibraryBrowseCacheContext';
import { useHost } from '@ui/host/HostContext';
import { buildCoverArtSources } from '@ui/shared/coverArt';
import { createResolveCachedArtwork } from './createResolveCachedArtwork';
import { createPersistCachedArtworkForScope } from './libraryArtworkCacheAccess';

export function useScopedCoverArt(args: {
  scope: LibraryCacheScope;
  serverUrl: string;
  username: string;
  libraryId: string;
  api?: SubsonicAPI | null;
  getCoverArtUrl?: (coverArtId: string) => string | null;
}) {
  const { scope, serverUrl, username, libraryId, api, getCoverArtUrl } = args;
  const host = useHost();
  const { artworkVersionKey, getArtworkCacheBump } = useLibraryBrowseCache();

  const resolveCachedArtwork = useMemo(
    () => createResolveCachedArtwork(host.libraryCache, serverUrl, username, libraryId),
    [host.libraryCache, serverUrl, username, libraryId],
  );

  const resolveArtworkLocalFile = useMemo(() => {
    if (!host.libraryCache.readArtworkLocalFile) return undefined;
    return (coverArtId: string) => host.libraryCache.readArtworkLocalFile!(scope, coverArtId);
  }, [host.libraryCache, scope]);

  const persistCachedArtwork = useMemo(
    () => createPersistCachedArtworkForScope(host.libraryCache, scope),
    [host.libraryCache, scope],
  );

  const sources = useMemo(
    () =>
      buildCoverArtSources({
        libraryCache: host.libraryCache,
        serverUrl,
        username,
        libraryId,
        scope,
        api,
        getCoverArtUrl,
      }),
    [api, getCoverArtUrl, host.libraryCache, libraryId, scope, serverUrl, username],
  );

  const artworkCacheKeyFor = useCallback(
    (coverArtId: string) => artworkVersionKey(coverArtId, scope),
    [artworkVersionKey, scope],
  );

  const artworkCacheBumpFor = useCallback(
    (coverArtId: string) => getArtworkCacheBump(coverArtId, scope),
    [getArtworkCacheBump, scope],
  );

  return {
    sources,
    resolveCachedArtwork,
    resolveArtworkLocalFile,
    persistCachedArtwork,
    artworkCacheKeyFor,
    artworkCacheBumpFor,
    buildNetworkUrl: getCoverArtUrl,
  };
}
