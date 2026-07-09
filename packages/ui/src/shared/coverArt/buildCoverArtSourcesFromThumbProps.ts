import {
  CANONICAL_COVER_ART_SIZE,
  type LibraryArtworkCacheRow,
  type SubsonicAPI,
} from '@asmusic/core';
import type { PersistCachedArtwork } from '../libraryArtworkCacheAccess';
import { artworkDisplayMimeType } from './mimeType';
import type { CoverArtSources } from './types';

/** Build resolver sources from legacy {@link CoverArtThumb} callback props. */
export function buildCoverArtSourcesFromThumbProps(args: {
  api?: SubsonicAPI | null;
  resolveCachedArtwork?: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  resolveCoverArtNetworkUrl?: (coverArtId: string) => string | null;
  persistCachedArtwork?: PersistCachedArtwork;
}): CoverArtSources {
  const {
    api,
    resolveCachedArtwork,
    resolveArtworkLocalFile,
    resolveCoverArtNetworkUrl,
    persistCachedArtwork,
  } = args;

  const sources: CoverArtSources = {
    readDisk: resolveCachedArtwork ?? (async () => null),
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
  }

  if (persistCachedArtwork) {
    sources.persistNetwork = persistCachedArtwork;
  }

  if (resolveArtworkLocalFile) {
    sources.readLocalFile = resolveArtworkLocalFile;
  }

  if (resolveCoverArtNetworkUrl) {
    sources.buildNetworkUrl = resolveCoverArtNetworkUrl;
  }

  return sources;
}
