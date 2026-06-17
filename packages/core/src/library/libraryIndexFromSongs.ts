import type { AlbumID3, ArtistID3, Child } from 'subsonic-api';

/** True when Subsonic/OpenSubsonic reports this track as starred (favorited). */
export function isChildStarred(track: Child): boolean {
  const s = track.starred;
  if (s == null || s === '') return false;
  if (typeof s === 'string') return s.trim().length > 0;
  if (s instanceof Date) return !Number.isNaN(s.getTime());
  return true;
}

/**
 * Derives album and artist lists from a flat song list, following the same rules as
 * `legacy-swiftui-ios/AsMusic/Stores/LibrarySongListSupport.swift` (`LibraryIndexFromSongs`).
 */

export function albumsFromCachedSongs(songs: Child[]): AlbumID3[] {
  const buckets = new Map<string, Child[]>();
  for (const song of songs) {
    const k = albumBucketKey(song);
    const arr = buckets.get(k) ?? [];
    arr.push(song);
    buckets.set(k, arr);
  }

  const result: AlbumID3[] = [];
  for (const group of buckets.values()) {
    if (group.length === 0) continue;
    const sorted = [...group].sort((a, b) => (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER));
    const first = sorted[0];
    const id = first.albumId?.trim() ? first.albumId : albumBucketKey(first);
    const title = albumTitle(first);
    const artistLine = albumArtistLine(first);
    const totalDuration = sorted.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    const years = sorted.map((s) => s.year).filter((y): y is number => y != null);
    const year = years.length ? Math.min(...years) : undefined;
    const cover = sorted.map((s) => s.coverArt).find((c) => c && c.length > 0);

    result.push({
      id,
      name: title,
      artist: artistLine,
      displayArtist: artistLine,
      artistId: first.albumArtists?.[0]?.id ?? first.artistId,
      coverArt: cover,
      songCount: sorted.length,
      duration: totalDuration > 0 ? totalDuration : 0,
      created: first.created ?? new Date(0),
      year,
    });
  }

  result.sort((a, b) => {
    const a0 = a.artist ?? '';
    const b0 = b.artist ?? '';
    if (a0.localeCompare(b0, undefined, { sensitivity: 'base' }) !== 0) {
      return a0.localeCompare(b0, undefined, { sensitivity: 'base' });
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return result;
}

/**
 * Album row id for a cached track — matches {@link albumsFromCachedSongs} `id` for that track's bucket.
 */
export function derivedAlbumIdForCachedSong(song: Child): string {
  const aid = song.albumId?.trim();
  if (aid) return aid;
  return albumBucketKey(song);
}

/**
 * Artist row id for a cached track — matches {@link artistsFromCachedSongs} `id` for that track's bucket.
 */
export function derivedArtistIdForCachedSong(song: Child): string {
  const aid = song.artistId?.trim();
  if (aid) return aid;
  return `name:${primaryTrackArtistName(song).toLowerCase()}`;
}

/**
 * Subsonic `getCoverArt` id from the derived album list (album-level cover, same as the album grid).
 */
export function coverArtIdFromAlbumsForCachedSong(song: Child, albums: AlbumID3[]): string | undefined {
  const id = derivedAlbumIdForCachedSong(song);
  const c = albums.find((a) => a.id === id)?.coverArt?.trim();
  return c || undefined;
}

export function artistsFromCachedSongs(songs: Child[]): ArtistID3[] {
  type Bucket = { kind: 'id'; key: string } | { kind: 'name'; key: string };
  const displayByBucket = new Map<string, string>();
  const albumSets = new Map<string, Set<string>>();

  const bucketKey = (b: Bucket) => (b.kind === 'id' ? `id:${b.key}` : `name:${b.key}`);

  for (const song of songs) {
    const bucket: Bucket =
      song.artistId && song.artistId.length > 0
        ? { kind: 'id', key: song.artistId }
        : { kind: 'name', key: primaryTrackArtistName(song).toLowerCase() };
    const bk = bucketKey(bucket);
    const name = primaryTrackArtistName(song);
    const prev = displayByBucket.get(bk);
    if (!prev || preferArtistDisplayName(prev, name)) {
      displayByBucket.set(bk, name);
    }
    const set = albumSets.get(bk) ?? new Set();
    set.add(albumBucketKey(song));
    albumSets.set(bk, set);
  }

  const rows: ArtistID3[] = [];
  for (const [bk, name] of displayByBucket) {
    const id = bk.startsWith('id:') ? bk.slice(3) : `name:${bk.slice('name:'.length)}`;
    const albumCount = albumSets.get(bk)?.size ?? 0;
    rows.push({
      id,
      name,
      albumCount,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return rows;
}

/**
 * Distinct Subsonic `getCoverArt` ids for derived albums (one per album row, not per song).
 */
export function collectCoverArtIdsFromAlbums(albums: AlbumID3[]): string[] {
  const ids = new Set<string>();
  for (const album of albums) {
    const t = album.coverArt?.trim();
    if (t) ids.add(t);
  }
  return [...ids];
}

/** Track `coverArt` when present, otherwise album-derived cover (same as album grid). */
export function resolveCoverArtIdForCachedSong(song: Child, albums: AlbumID3[]): string | undefined {
  const track = song.coverArt?.trim();
  if (track) return track;
  return coverArtIdFromAlbumsForCachedSong(song, albums);
}

/** Distinct cover ids for background prefetch: album covers plus per-track overrides. */
export function collectCoverArtIdsFromSongs(songs: Child[], albums: AlbumID3[]): string[] {
  const ids = new Set<string>(collectCoverArtIdsFromAlbums(albums));
  for (const song of songs) {
    const id = resolveCoverArtIdForCachedSong(song, albums);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Full cached library as a flat list: album artist line, album title, disc/track, then title.
 * Matches a natural browse order alongside {@link albumsFromCachedSongs}.
 */
export function allCachedSongsSorted(songs: Child[]): Child[] {
  return [...songs].sort((a, b) => {
    const byAlbumArtist = albumArtistLine(a).localeCompare(albumArtistLine(b), undefined, { sensitivity: 'base' });
    if (byAlbumArtist !== 0) return byAlbumArtist;
    const byAlbum = albumTitle(a).localeCompare(albumTitle(b), undefined, { sensitivity: 'base' });
    if (byAlbum !== 0) return byAlbum;
    const byDisc = (a.discNumber ?? 0) - (b.discNumber ?? 0);
    if (byDisc !== 0) return byDisc;
    const byTrack = (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER);
    if (byTrack !== 0) return byTrack;
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
  });
}

/**
 * Whether a cached track belongs to the same artist bucket as {@link artistsFromCachedSongs} rows
 * (Subsonic `artistId` when present, otherwise a case-insensitive `name:` + lowercased display name).
 */
export function songMatchesCachedArtistBucket(song: Child, artistRowId: string): boolean {
  if (artistRowId.startsWith('name:')) {
    const lower = artistRowId.slice('name:'.length);
    const byId = song.artistId?.trim();
    if (byId) return false;
    return primaryTrackArtistName(song).toLowerCase() === lower;
  }
  return song.artistId === artistRowId;
}

/** Album rows for one derived artist id, using the same bucketing as {@link albumsFromCachedSongs}. */
export function albumsFromCachedSongsForArtist(artistRowId: string, songs: Child[]): AlbumID3[] {
  const filtered = songs.filter((s) => songMatchesCachedArtistBucket(s, artistRowId));
  return albumsFromCachedSongs(filtered);
}

/** Cached tracks for one derived artist id, sorted like {@link allCachedSongsSorted}. */
export function cachedSongsForArtistSorted(artistRowId: string, songs: Child[]): Child[] {
  const filtered = songs.filter((s) => songMatchesCachedArtistBucket(s, artistRowId));
  return allCachedSongsSorted(filtered);
}

/** Songs belonging to a derived album id (same bucketing as {@link albumsFromCachedSongs}). */
export function songsInCachedAlbum(albumId: string, songs: Child[]): Child[] {
  const buckets = new Map<string, Child[]>();
  for (const song of songs) {
    const k = albumBucketKey(song);
    const arr = buckets.get(k) ?? [];
    arr.push(song);
    buckets.set(k, arr);
  }
  for (const group of buckets.values()) {
    if (group.length === 0) continue;
    const sorted = [...group].sort((a, b) => (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER));
    const first = sorted[0];
    const id = first.albumId?.trim() ? first.albumId : albumBucketKey(first);
    if (id === albumId) return sorted;
  }
  return [];
}

function albumBucketKey(song: Child): string {
  const aid = song.albumId?.trim();
  if (aid) return `album:${aid}`;
  const title = albumTitle(song).toLowerCase();
  const artist = albumArtistLine(song).toLowerCase();
  return `album:${title}|${artist}`;
}

function albumTitle(song: Child): string {
  const raw = song.album?.trim() ?? '';
  return raw.length === 0 ? 'Unknown Album' : raw;
}

function albumArtistLine(song: Child): string {
  if (song.displayAlbumArtist?.trim()) return song.displayAlbumArtist.trim();
  const aa = song.albumArtists?.[0]?.name?.trim();
  if (aa) return aa;
  if (song.displayArtist?.trim()) return song.displayArtist.trim();
  if (song.artist?.trim()) return song.artist.trim();
  return 'Unknown Artist';
}

function primaryTrackArtistName(song: Child): string {
  if (song.displayArtist?.trim()) return song.displayArtist.trim();
  if (song.artist?.trim()) return song.artist.trim();
  const n = song.artists?.[0]?.name?.trim();
  if (n) return n;
  return 'Unknown Artist';
}

/** Pick a row label when several tracks share one {@link Child.artistId} but credit strings differ. */
function preferArtistDisplayName(current: string, next: string): boolean {
  if (current === 'Unknown Artist' && next !== 'Unknown Artist') return true;
  if (next === 'Unknown Artist') return false;
  return next.length > current.length;
}

