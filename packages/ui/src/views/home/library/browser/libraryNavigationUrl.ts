/**
 * Library UI state in the URL query string (back/forward, bookmarks).
 * Active server and library come from app settings, not from the URL.
 *
 * Query keys:
 * - `tab`: `albums` | `artists` | `songs` | `favorites` | `playlists`
 * - `albumId`: optional; opens that album’s track list (songs tab). With multiple active libraries,
 *   this may be an opaque `lb1.` + base64url ref (see {@link encodeLibraryBrowserRef}) so the row
 *   resolves to the correct cache scope (no separate `serverId` / `libraryId` query params).
 * - `artistId`: optional (without `albumId`); opens that artist’s album list (albums tab); same `lb1.` rule.
 * - `artistSongs`: optional `1` with `artistId`; opens all cached tracks for that artist (songs tab).
 * - `playlistId`: optional; opens that playlist’s track list (playlists tab); same `lb1.` rule.
 *
 * Optional: `artistName` for display before the artist list is resolved from cache.
 * Optional: `playlistName` for display before the playlist is resolved from cache.
 */

const LIBRARY_BROWSER_REF_PREFIX = 'lb1.';

export type LibraryBrowserEncodedRef = {
  serverKey: string;
  libraryId: string;
  id: string;
};

function utf8ToB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToUtf8(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Encode scope + entity id for multi-library deep links (single opaque query value). */
export function encodeLibraryBrowserRef(ref: LibraryBrowserEncodedRef): string {
  return LIBRARY_BROWSER_REF_PREFIX + utf8ToB64Url(JSON.stringify(ref));
}

export function decodeLibraryBrowserRef(param: string): LibraryBrowserEncodedRef | null {
  if (!param.startsWith(LIBRARY_BROWSER_REF_PREFIX)) return null;
  try {
    const raw = b64UrlToUtf8(param.slice(LIBRARY_BROWSER_REF_PREFIX.length));
    const o = JSON.parse(raw) as Partial<LibraryBrowserEncodedRef>;
    if (typeof o.serverKey === 'string' && typeof o.libraryId === 'string' && typeof o.id === 'string') {
      return { serverKey: o.serverKey, libraryId: o.libraryId, id: o.id };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type LibraryBrowserTab = 'albums' | 'artists' | 'songs' | 'favorites' | 'playlists';

export type LibraryBrowserView = {
  tab: LibraryBrowserTab;
  album: { id: string } | null;
  artist: { id: string; name: string; allSongs: boolean } | null;
  playlist: { id: string; name: string } | null;
};

/** Legacy keys removed from URLs on merge (multi-server safe). */
const LEGACY_SERVER_ID_PARAM = 'serverId';
const LEGACY_LIBRARY_ID_PARAM = 'libraryId';

/** Query keys (terse names for shareable URLs). */
export const LIBRARY_URL_TAB = 'tab';
export const LIBRARY_URL_ALBUM_ID = 'albumId';
export const LIBRARY_URL_ARTIST_ID = 'artistId';
export const LIBRARY_URL_ARTIST_NAME = 'artistName';
/** When `1`, combined with `artistId`, shows all cached tracks for that artist. */
export const LIBRARY_URL_ARTIST_ALL_SONGS = 'artistSongs';
export const LIBRARY_URL_PLAYLIST_ID = 'playlistId';
export const LIBRARY_URL_PLAYLIST_NAME = 'playlistName';

export const defaultLibraryBrowserView: LibraryBrowserView = {
  tab: 'albums',
  album: null,
  artist: null,
  playlist: null,
};

function isTab(v: string | null): v is LibraryBrowserTab {
  return v === 'albums' || v === 'artists' || v === 'songs' || v === 'favorites' || v === 'playlists';
}

/** True when the URL already specifies tab or a library deep link (do not override from prefs). */
export function hasExplicitLibraryBrowserNavigation(searchParams: URLSearchParams): boolean {
  if (searchParams.get(LIBRARY_URL_TAB)) return true;
  if (searchParams.get(LIBRARY_URL_ALBUM_ID)?.trim()) return true;
  if (searchParams.get(LIBRARY_URL_ARTIST_ID)?.trim()) return true;
  if (searchParams.get(LIBRARY_URL_PLAYLIST_ID)?.trim()) return true;
  return false;
}

export function parseLibraryBrowserView(searchParams: URLSearchParams): LibraryBrowserView {
  const rawTab = searchParams.get(LIBRARY_URL_TAB);
  let tab: LibraryBrowserTab = isTab(rawTab) ? rawTab : defaultLibraryBrowserView.tab;
  const albumId = searchParams.get(LIBRARY_URL_ALBUM_ID)?.trim() ?? '';
  const artistId = searchParams.get(LIBRARY_URL_ARTIST_ID)?.trim() ?? '';
  const artistName = (searchParams.get(LIBRARY_URL_ARTIST_NAME) ?? '').trim();
  const artistAllSongs = searchParams.get(LIBRARY_URL_ARTIST_ALL_SONGS)?.trim() === '1';
  const playlistId = searchParams.get(LIBRARY_URL_PLAYLIST_ID)?.trim() ?? '';
  const playlistName = (searchParams.get(LIBRARY_URL_PLAYLIST_NAME) ?? '').trim();

  if (albumId) {
    return {
      tab: 'songs',
      album: { id: albumId },
      artist: null,
      playlist: null,
    };
  }
  if (artistId) {
    return {
      tab: artistAllSongs ? 'songs' : 'albums',
      album: null,
      artist: { id: artistId, name: artistName.length > 0 ? artistName : artistId, allSongs: artistAllSongs },
      playlist: null,
    };
  }
  if (playlistId) {
    return {
      tab: 'playlists',
      album: null,
      artist: null,
      playlist: { id: playlistId, name: playlistName.length > 0 ? playlistName : playlistId },
    };
  }
  return { tab, album: null, artist: null, playlist: null };
}

/** Apply library view to a copy of `base` (other query keys preserved; legacy scope params stripped). */
export function mergeLibraryBrowserSearchParams(base: URLSearchParams, view: LibraryBrowserView): URLSearchParams {
  const next = new URLSearchParams(base);
  next.delete(LEGACY_SERVER_ID_PARAM);
  next.delete(LEGACY_LIBRARY_ID_PARAM);
  next.set(LIBRARY_URL_TAB, view.tab);
  next.delete('albumTitle');
  if (view.album) {
    next.set(LIBRARY_URL_ALBUM_ID, view.album.id);
  } else {
    next.delete(LIBRARY_URL_ALBUM_ID);
  }
  if (view.artist) {
    next.set(LIBRARY_URL_ARTIST_ID, view.artist.id);
    if (view.artist.name.length > 0 && view.artist.name !== view.artist.id) {
      next.set(LIBRARY_URL_ARTIST_NAME, view.artist.name);
    } else {
      next.delete(LIBRARY_URL_ARTIST_NAME);
    }
    if (view.artist.allSongs) {
      next.set(LIBRARY_URL_ARTIST_ALL_SONGS, '1');
    } else {
      next.delete(LIBRARY_URL_ARTIST_ALL_SONGS);
    }
  } else {
    next.delete(LIBRARY_URL_ARTIST_ID);
    next.delete(LIBRARY_URL_ARTIST_NAME);
    next.delete(LIBRARY_URL_ARTIST_ALL_SONGS);
  }
  if (view.playlist) {
    next.set(LIBRARY_URL_PLAYLIST_ID, view.playlist.id);
    if (view.playlist.name.length > 0 && view.playlist.name !== view.playlist.id) {
      next.set(LIBRARY_URL_PLAYLIST_NAME, view.playlist.name);
    } else {
      next.delete(LIBRARY_URL_PLAYLIST_NAME);
    }
  } else {
    next.delete(LIBRARY_URL_PLAYLIST_ID);
    next.delete(LIBRARY_URL_PLAYLIST_NAME);
  }
  return next;
}
