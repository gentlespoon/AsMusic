import type {
  LibraryArtworkCacheRow,
  LibraryCacheScope,
  LibraryCacheStorage,
} from '@asmusic/core';

export type PersistCachedArtwork = (
  coverArtId: string,
  row: Pick<LibraryArtworkCacheRow, 'data' | 'mimeType'>,
) => Promise<void>;

export function createPersistCachedArtworkForScope(
  libraryCache: LibraryCacheStorage,
  scope: LibraryCacheScope,
  options?: { onCached?: (coverArtId: string) => void },
): PersistCachedArtwork {
  return async (coverArtId, row) => {
    await libraryCache.putArtworkBlob(scope, {
      coverArtId,
      data: row.data,
      mimeType: row.mimeType,
    });
    options?.onCached?.(coverArtId);
  };
}
