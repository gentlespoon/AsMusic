import type { PlaylistCatalogRow } from '@ui/contexts/LibraryBrowseCacheContext';

export function playlistMatchesQuery(row: PlaylistCatalogRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.playlist.name.toLowerCase().includes(q);
}
