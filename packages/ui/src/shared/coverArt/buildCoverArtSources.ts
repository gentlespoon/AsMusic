import {
  CANONICAL_COVER_ART_SIZE,
  type LibraryCacheScope,
  type LibraryCacheStorage,
  type SubsonicAPI,
} from '@asmusic/core';
import { createResolveCachedArtwork } from '../createResolveCachedArtwork';
import { createPersistCachedArtworkForScope } from '../libraryArtworkCacheAccess';
import { artworkDisplayMimeType } from './mimeType.ts';
import type { CoverArtSources } from './types.ts';

export function buildCoverArtSources(args: {
  libraryCache: LibraryCacheStorage;
  serverUrl: string;
  username: string;
  libraryId: string;
  scope: LibraryCacheScope;
  api?: SubsonicAPI | null;
  getCoverArtUrl?: (coverArtId: string) => string | null;
}): CoverArtSources {
  const { libraryCache, serverUrl, username, libraryId, scope, api, getCoverArtUrl } = args;

  const readDisk = createResolveCachedArtwork(libraryCache, serverUrl, username, libraryId);

  const sources: CoverArtSources = {
    readDisk,
  };

  if (api) {
    sources.fetchNetwork = async (coverArtId) => {
      const res = await api.getCoverArt({ id: coverArtId, size: CANONICAL_COVER_ART_SIZE });
      if (!res.ok) return null;
      const data = new Uint8Array(await res.arrayBuffer());
      const mimeType = artworkDisplayMimeType(
        data,
        res.headers.get('content-type') ?? undefined,
      );
      return { data, mimeType };
    };
    sources.persistNetwork = createPersistCachedArtworkForScope(libraryCache, scope);
  }

  if (libraryCache.readArtworkLocalFile) {
    sources.readLocalFile = (coverArtId) => libraryCache.readArtworkLocalFile!(scope, coverArtId);
  }

  if (getCoverArtUrl) {
    sources.buildNetworkUrl = getCoverArtUrl;
  }

  return sources;
}

/** Lock-screen sources: iOS uses cached bytes; all platforms fall back to authenticated URL. */
export function buildNowPlayingCoverArtSources(args: {
  libraryCache: LibraryCacheStorage;
  serverUrl: string;
  username: string;
  libraryId: string;
  hostKind: 'browser' | 'ios-capacitor';
  getCoverArtUrl?: (coverArtId: string) => string | null;
}): CoverArtSources {
  const { libraryCache, serverUrl, username, libraryId, hostKind, getCoverArtUrl } = args;
  const readDisk =
    hostKind === 'ios-capacitor'
      ? createResolveCachedArtwork(libraryCache, serverUrl, username, libraryId)
      : async () => null;

  return {
    readDisk,
    buildNetworkUrl: getCoverArtUrl,
  };
}
