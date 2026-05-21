import type { Child } from 'subsonic-api';
import type { LibraryCacheScope } from './cacheScope';
import type { OfflineMediaStore } from '../offline/OfflineMediaStore';

/** Song ids present in the local cache but absent from the latest server catalog. */
export function removedSongIdsFromLibraryRefresh(
  cachedSongs: Child[],
  latestSongs: Child[]
): string[] {
  const latestIds = new Set(latestSongs.map((s) => String(s.id)));
  const removed: string[] = [];
  const seen = new Set<string>();
  for (const song of cachedSongs) {
    const id = String(song.id);
    if (latestIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    removed.push(id);
  }
  return removed;
}

/** Deletes ready offline audio whose track id is not in the latest server catalog for this scope. */
export async function purgeOfflineMediaNotInServerCatalog(
  offlineMedia: OfflineMediaStore,
  scope: LibraryCacheScope,
  latestSongs: Child[]
): Promise<void> {
  const latestIds = new Set(latestSongs.map((s) => String(s.id)));
  const keys = await offlineMedia.listReadyKeys(scope);
  const toDelete = keys.filter((k) => !latestIds.has(k.trackId));
  await Promise.all(toDelete.map((k) => offlineMedia.delete(k)));
}

/**
 * After comparing the pre-refresh cache to the latest server list, drop local rows for
 * tracks that no longer exist on the server. Library song rows are removed by the subsequent
 * {@link LibraryCacheStorage.replaceSongList}; offline rows are removed when their track id is
 * absent from the latest server catalog (covers orphans never written to the song cache).
 */
export async function purgeRemovedLibraryCacheEntries(
  scope: LibraryCacheScope,
  latestSongs: Child[],
  offlineMedia?: OfflineMediaStore
): Promise<void> {
  if (!offlineMedia) return;
  await purgeOfflineMediaNotInServerCatalog(offlineMedia, scope, latestSongs);
}
