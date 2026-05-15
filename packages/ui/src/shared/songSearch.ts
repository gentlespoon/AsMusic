import type { Child } from 'subsonic-api';

export function songMatchesQuery(track: Child, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [track.title, track.artist, track.album, track.genre].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}
