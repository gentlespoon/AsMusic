import type { Child, SubsonicAPI } from 'subsonic-api';

const PAGE_SIZE = 500;

function isOk(r: { status?: string } | null | undefined): boolean {
  return r?.status === 'ok';
}

/**
 * Paginated library songs using Subsonic `search3`, matching legacy iOS
 * `AsNavidromeClient.SongRoutes.getSongsPage` (empty query, songs only).
 */
export type FetchAllLibrarySongsOptions = {
  /** When set, limits search to that music folder (Subsonic `musicFolderId`). */
  musicFolderId?: string | number;
};

export async function fetchAllLibrarySongs(
  api: SubsonicAPI,
  onProgress?: (loadedCount: number) => void,
  options?: FetchAllLibrarySongsOptions
): Promise<Child[]> {
  const all: Child[] = [];
  let offset = 0;
  for (;;) {
    const r = await api.search3({
      query: '',
      artistCount: 0,
      albumCount: 0,
      songCount: PAGE_SIZE,
      songOffset: offset,
      musicFolderId: options?.musicFolderId,
    });
    if (!isOk(r)) {
      throw new Error(
        r && 'error' in r ? String((r as { error?: { message?: string } }).error?.message) : 'search3 failed'
      );
    }
    const page = r.searchResult3?.song ?? [];
    all.push(...page);
    onProgress?.(all.length);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}
