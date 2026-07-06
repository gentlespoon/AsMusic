import { useCallback, useMemo } from 'react';
import type { LibraryCacheScope } from '@asmusic/core';
import { useLibraryBrowseCache } from '@ui/contexts/LibraryBrowseCacheContext';
import { useHost } from '@ui/host/HostContext';
import { createResolveCachedArtwork } from './createResolveCachedArtwork';
import { createPersistCachedArtworkForScope } from './libraryArtworkCacheAccess';

export function useScopedCoverArt(args: {
  scope: LibraryCacheScope;
  serverUrl: string;
  username: string;
  libraryId: string;
}) {
  const { scope, serverUrl, username, libraryId } = args;
  const host = useHost();
  const { artworkVersionKey, notifyArtworkCached, getArtworkCacheBump } = useLibraryBrowseCache();

  const resolveCachedArtwork = useMemo(
    () => createResolveCachedArtwork(host.libraryCache, serverUrl, username, libraryId),
    [host.libraryCache, serverUrl, username, libraryId],
  );

  const resolveArtworkLocalFile = useMemo(() => {
    if (!host.libraryCache.readArtworkLocalFile) return undefined;
    return (coverArtId: string) => host.libraryCache.readArtworkLocalFile!(scope, coverArtId);
  }, [host.libraryCache, scope]);

  const persistCachedArtwork = useMemo(
    () =>
      createPersistCachedArtworkForScope(host.libraryCache, scope, {
        onCached: (coverArtId) => notifyArtworkCached(artworkVersionKey(coverArtId, scope)),
      }),
    [host.libraryCache, scope, notifyArtworkCached, artworkVersionKey],
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
    resolveCachedArtwork,
    resolveArtworkLocalFile,
    persistCachedArtwork,
    artworkCacheKeyFor,
    artworkCacheBumpFor,
  };
}
