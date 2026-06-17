import {
  offlineLookupScopes,
  readCachedArtworkBlob,
  type LibraryArtworkCacheRow,
  type LibraryCacheStorage,
} from '@asmusic/core';

export function createResolveCachedArtwork(
  storage: LibraryCacheStorage,
  serverUrl: string,
  username: string,
  libraryId: string,
): (coverArtId: string) => Promise<LibraryArtworkCacheRow | null> {
  const scopes = offlineLookupScopes(serverUrl, username, libraryId);
  return (coverArtId) => readCachedArtworkBlob(storage, scopes, coverArtId);
}
