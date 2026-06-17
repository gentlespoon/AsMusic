import { offlineLookupScopes } from './cacheScope';
import type { LibraryArtworkCacheRow, LibraryCacheStorage } from './storage/LibraryCacheStorage';
import type { LibraryCacheScope } from './cacheScope';

/** Reads artwork from disk, trying each scope until a row with bytes is found. */
export async function readCachedArtworkBlob(
  storage: LibraryCacheStorage,
  scopes: readonly LibraryCacheScope[],
  coverArtId: string,
): Promise<LibraryArtworkCacheRow | null> {
  const id = coverArtId.trim();
  if (!id) return null;
  for (const scope of scopes) {
    const row = await storage.readArtworkBlob(scope, id);
    if (row?.data?.byteLength) return row;
  }
  return null;
}

export async function readCachedArtworkBlobForAccount(
  storage: LibraryCacheStorage,
  serverUrl: string,
  username: string,
  libraryId: string,
  coverArtId: string,
): Promise<LibraryArtworkCacheRow | null> {
  return readCachedArtworkBlob(
    storage,
    offlineLookupScopes(serverUrl, username, libraryId),
    coverArtId,
  );
}
