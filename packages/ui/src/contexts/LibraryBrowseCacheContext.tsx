import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Child } from 'subsonic-api';
import {
  DEFAULT_LIBRARY_ID,
  libraryCacheScope,
  albumsFromCachedSongs,
  allCachedSongsSorted,
  artistsFromCachedSongs,
  isChildStarred,
  fetchMusicFolders,
  type LibraryCacheScope,
  refreshPlaylistCacheForServer,
  updatePlaylistTracks,
  PENDING_STAR_MUTATIONS_STORAGE_KEY,
  PENDING_STAR_MUTATIONS_RETRY_INTERVAL_MS,
  coalescePendingStarMutations,
  parsePendingStarMutationsJson,
  serializePendingStarMutations,
  upsertPendingStarMutation,
  removePendingStarMutations,
  type PendingStarMutation,
  PENDING_PLAY_SCROBBLES_STORAGE_KEY,
  PENDING_PLAY_SCROBBLES_RETRY_INTERVAL_MS,
  PLAY_COUNT_REFRESH_DEBOUNCE_MS,
  parsePendingPlayScrobblesJson,
  serializePendingPlayScrobbles,
  appendPendingPlayScrobble,
  removePendingPlayScrobblesById,
  pendingPlayDeltasByTrack,
  pendingCountForTrack,
  pendingPlayTrackKey,
  type PendingPlayScrobble,
  createLocalPlaylist,
  deleteLocalPlaylist,
  addTrackToLocalPlaylist,
  updateLocalPlaylistMembership,
  type LocalPlaylistSummary,
  type LocalPlaylistTrackRef,
  type LibraryPlaylistSummary,
  type SubsonicAPI,
} from '@asmusic/core';
import { useT } from '@asmusic/i18n';
import { useHost } from '@ui/host/HostContext';
import { useServerAndLibrary } from './ServerAndLibraryContext';
import { clearCoverArtObjectUrlCache } from '@ui/shared/coverArtObjectUrlCache';
import type { AlbumCatalogRow } from '@ui/views/home/library/catalog/AlbumListView';
import type { ArtistCatalogRow } from '@ui/views/home/library/catalog/ArtistListView';
import type { SongListEntry } from '@ui/views/home/library/catalog/SongListView';

export type LibraryBrowseSlice = {
  serverId: string;
  serverUrl: string;
  username: string;
  libraryId: string;
  scope: LibraryCacheScope;
  songs: Child[];
};

export type PlaylistCatalogRow =
  | {
      kind: 'server';
      playlist: LibraryPlaylistSummary;
      serverId: string;
      serverKey: string;
      rowKey: string;
    }
  | {
      kind: 'local';
      playlist: LibraryPlaylistSummary;
      rowKey: string;
    };

function scopeListKey(list: { scope: LibraryCacheScope }[]): string {
  return list.map((s) => `${s.scope.serverKey}|${s.scope.libraryId}`).join('||');
}

export function libraryRefKey(serverId: string, libraryId: string): string {
  return `${serverId}:${libraryId}`;
}

/** Minimum interval between artwork-driven library UI re-renders during background cache fill. */
const ARTWORK_UI_RENDER_COOLDOWN_MS = 5000;
const MAX_ARTWORK_VERSION_ENTRIES = 2000;

export type LibraryBrowseScopeRow = {
  serverId: string;
  libraryId: string;
  serverUrl: string;
  username: string;
  scope: LibraryCacheScope;
};

type LibraryBrowseCacheContextValue = {
  scopesToLoad: LibraryBrowseScopeRow[];
  scopesKey: string;
  slices: LibraryBrowseSlice[];
  multiLibrary: boolean;
  singleSlice: LibraryBrowseScopeRow | null;
  cachedSongs: Child[];
  albums: ReturnType<typeof albumsFromCachedSongs>;
  albumCatalogRows: AlbumCatalogRow[];
  artistCatalogRows: ArtistCatalogRow[];
  songEntriesSorted: SongListEntry[];
  favoriteSongEntriesSorted: SongListEntry[];
  playlistCatalogRows: PlaylistCatalogRow[];
  serverPlaylistsByServerKey: Record<string, LibraryPlaylistSummary[]>;
  multiServer: boolean;
  localPlaylistSummaries: LocalPlaylistSummary[];
  canCreateServerPlaylist: boolean;
  canCreateLocalPlaylist: boolean;
  reloadLocalPlaylists: () => Promise<void>;
  readLocalPlaylistEntries: (playlistId: string) => Promise<import('@asmusic/core').LocalPlaylistEntry[]>;
  initialReady: boolean;
  cacheReadError: string | null;
  reloadCachedSongsFromDisk: () => Promise<void>;
  clearAllArtworkCache: () => Promise<void>;
  apiByServerId: Record<string, SubsonicAPI | null>;
  apiForServer: (serverId: string) => SubsonicAPI | null;
  artworkVersionById: Record<string, number>;
  artworkVersionKey: (coverArtId: string, sc: LibraryCacheScope) => string;
  getArtworkCacheBump: (coverArtId: string, sc: LibraryCacheScope) => number;
  notifyArtworkCached: (key: string) => void;
  libraryDisplayName: (serverId: string, libraryId: string) => string;
  serverDisplayName: (serverId: string) => string;
  ensureLibraryNames: (
    refs: readonly { serverId: string; libraryId: string }[]
  ) => Promise<Record<string, string>>;
  setTrackStarred: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    starred: boolean;
  }) => Promise<void>;
  /** Record a completed listen: optimistic local playCount + pending scrobble queue. */
  recordTrackPlayed: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    playedAt?: number;
  }) => Promise<void>;
  /**
   * Best-effort `getSong` refresh of playCount/played; merges pending local scrobbles.
   * Failures are ignored. Debounced unless `force` (e.g. Track details open).
   */
  refreshTrackPlayCount: (args: {
    serverId: string;
    libraryId: string;
    trackId: string;
    force?: boolean;
  }) => Promise<void>;
  /** Flush pending star/unstar and play scrobbles (e.g. before library sync). */
  flushPendingLibraryMutations: () => Promise<void>;
  refreshPlaylistCacheForServer: (args: { serverId: string }) => Promise<void>;
  createPlaylist: (args: { serverId: string; name: string }) => Promise<void>;
  deletePlaylist: (args: { serverId: string; playlistId: string }) => Promise<void>;
  addTrackToPlaylist: (args: {
    serverId: string;
    playlistId: string;
    trackId: string;
  }) => Promise<void>;
  updatePlaylistMembership: (args: {
    serverId: string;
    playlistId: string;
    songIdsToAdd: string[];
    songIndexesToRemove: number[];
  }) => Promise<void>;
  createLocalPlaylist: (name: string) => Promise<LocalPlaylistSummary>;
  deleteLocalPlaylist: (playlistId: string) => Promise<void>;
  addTrackToLocalPlaylist: (args: { playlistId: string; ref: LocalPlaylistTrackRef }) => Promise<void>;
  updateLocalPlaylistMembership: (args: {
    playlistId: string;
    songIdsToAdd: string[];
    songIndexesToRemove: number[];
    resolveRefForNewId: (compositeKey: string) => LocalPlaylistTrackRef | null;
  }) => Promise<void>;
};

const LibraryBrowseCacheContext = createContext<LibraryBrowseCacheContextValue | null>(null);

export function LibraryBrowseCacheProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const host = useHost();
  const { servers, activeLibraryRefs, getApiForServer, isRestoring } = useServerAndLibrary();

  const pendingStarQueueRef = useRef<PendingStarMutation[]>([]);
  const flushPendingStarsInFlightRef = useRef(false);
  const pendingStarsHydratedRef = useRef(false);
  const flushPendingStarMutationsRef = useRef<() => Promise<void>>(async () => {});

  const pendingPlayQueueRef = useRef<PendingPlayScrobble[]>([]);
  const flushPendingPlaysInFlightRef = useRef(false);
  const pendingPlaysHydratedRef = useRef(false);
  const flushPendingPlayScrobblesRef = useRef<() => Promise<void>>(async () => {});
  /** Last opportunistic getSong refresh per track key (debounce). */
  const playCountRefreshAtRef = useRef<Map<string, number>>(new Map());
  const refreshTrackPlayCountRef = useRef<
    (args: {
      serverId: string;
      libraryId: string;
      trackId: string;
      force?: boolean;
    }) => Promise<void>
  >(async () => {});

  const scopesToLoad = useMemo(() => {
    return activeLibraryRefs
      .map((ref) => {
        const s = servers.find((x) => x.id === ref.serverId);
        if (!s) return null;
        return {
          serverId: ref.serverId,
          libraryId: ref.libraryId,
          serverUrl: s.serverUrl,
          username: s.username,
          scope: libraryCacheScope(s.serverUrl, s.username, ref.libraryId),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [activeLibraryRefs, servers]);

  const scopesKey = useMemo(() => scopeListKey(scopesToLoad), [scopesToLoad]);
  const multiLibrary = scopesToLoad.length > 1;
  const multiServer = useMemo(() => new Set(scopesToLoad.map((s) => s.serverId)).size > 1, [scopesToLoad]);
  const singleScopeRow = scopesToLoad.length === 1 ? scopesToLoad[0] : null;

  const uniqueServers = useMemo(() => {
    const seen = new Map<string, { serverId: string; serverKey: string }>();
    for (const sl of scopesToLoad) {
      if (!seen.has(sl.scope.serverKey)) {
        seen.set(sl.scope.serverKey, { serverId: sl.serverId, serverKey: sl.scope.serverKey });
      }
    }
    return [...seen.values()];
  }, [scopesToLoad]);

  const scopesToLoadRef = useRef(scopesToLoad);
  scopesToLoadRef.current = scopesToLoad;

  const [slices, setSlices] = useState<LibraryBrowseSlice[]>([]);
  const [serverPlaylistsByServerKey, setServerPlaylistsByServerKey] = useState<
    Record<string, LibraryPlaylistSummary[]>
  >({});
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const [cacheReadError, setCacheReadError] = useState<string | null>(null);
  const [initialReady, setInitialReady] = useState(false);
  const [artworkVersionById, setArtworkVersionById] = useState<Record<string, number>>({});
  const [artworkCacheEpoch, setArtworkCacheEpoch] = useState(0);
  const [apiByServerId, setApiByServerId] = useState<Record<string, SubsonicAPI | null>>({});
  const [libraryNameByKey, setLibraryNameByKey] = useState<Record<string, string>>({});
  const [localPlaylistSummaries, setLocalPlaylistSummaries] = useState<LocalPlaylistSummary[]>([]);

  const persistPendingStarQueue = useCallback(async () => {
    // Avoid writing a partial in-memory queue over disk before hydration merges them.
    if (!pendingStarsHydratedRef.current) return;
    await host.secureStorage.set(
      PENDING_STAR_MUTATIONS_STORAGE_KEY,
      serializePendingStarMutations(pendingStarQueueRef.current),
    );
  }, [host]);

  const persistPendingPlayQueue = useCallback(async () => {
    if (!pendingPlaysHydratedRef.current) return;
    await host.secureStorage.set(
      PENDING_PLAY_SCROBBLES_STORAGE_KEY,
      serializePendingPlayScrobbles(pendingPlayQueueRef.current),
    );
  }, [host]);

  const reloadLocalPlaylists = useCallback(async () => {
    const list = await host.localPlaylists.listSummaries();
    setLocalPlaylistSummaries(list);
  }, [host.localPlaylists]);

  useEffect(() => {
    void reloadLocalPlaylists();
  }, [reloadLocalPlaylists]);

  const readLocalPlaylistEntries = useCallback(
    (playlistId: string) => host.localPlaylists.readEntries(playlistId),
    [host.localPlaylists]
  );

  const artworkPendingRef = useRef<Record<string, number>>({});
  const artworkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artworkLastFlushAtRef = useRef(0);
  const artworkVersionLastTouchedRef = useRef<Record<string, number>>({});

  const artworkVersionKey = useCallback(
    (coverArtId: string, sc: LibraryCacheScope) =>
      multiLibrary ? `${sc.serverKey}|${sc.libraryId}|${coverArtId}` : coverArtId,
    [multiLibrary],
  );

  const getArtworkCacheBump = useCallback(
    (coverArtId: string, sc: LibraryCacheScope) => {
      const key = artworkVersionKey(coverArtId, sc);
      return (artworkVersionById[key] ?? 0) + artworkCacheEpoch;
    },
    [artworkVersionById, artworkCacheEpoch, artworkVersionKey],
  );

  const libraryDisplayName = useCallback(
    (serverId: string, libraryId: string) =>
      libraryNameByKey[libraryRefKey(serverId, libraryId)] ?? libraryId,
    [libraryNameByKey]
  );

  const libraryNameByKeyRef = useRef(libraryNameByKey);
  libraryNameByKeyRef.current = libraryNameByKey;

  const serverDisplayName = useCallback(
    (serverId: string) => {
      const s = servers.find((x) => x.id === serverId);
      if (!s) return serverId;
      return `${s.serverUrl.replace(/\/$/, '')} · ${s.username}`;
    },
    [servers]
  );

  const ensureLibraryNames = useCallback(
    async (refs: readonly { serverId: string; libraryId: string }[]) => {
      const defaultLibraryName = t('servers.defaultLibraryName');
      const resolveName = (serverId: string, libraryId: string) => {
        const key = libraryRefKey(serverId, libraryId);
        return (
          libraryNameByKeyRef.current[key] ??
          (libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : libraryId)
        );
      };

      const missingByServer = new Map<string, string[]>();
      for (const ref of refs) {
        const key = libraryRefKey(ref.serverId, ref.libraryId);
        if (libraryNameByKeyRef.current[key]) continue;
        const list = missingByServer.get(ref.serverId);
        if (list) {
          if (!list.includes(ref.libraryId)) list.push(ref.libraryId);
        } else {
          missingByServer.set(ref.serverId, [ref.libraryId]);
        }
      }

      const updates: Record<string, string> = {};
      if (missingByServer.size > 0) {
        await Promise.all(
          [...missingByServer.entries()].map(async ([serverId, libraryIds]) => {
            const api = await getApiForServer(serverId);
            let folders: Awaited<ReturnType<typeof fetchMusicFolders>> = [];
            if (api) {
              try {
                folders = await fetchMusicFolders(api);
              } catch {
                folders = [];
              }
            }
            for (const libraryId of libraryIds) {
              const key = libraryRefKey(serverId, libraryId);
              if (folders.length === 0) {
                updates[key] = libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : libraryId;
              } else {
                const folder = folders.find((f) => f.id === libraryId);
                updates[key] =
                  folder?.name ?? (libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : libraryId);
              }
            }
          })
        );

        if (Object.keys(updates).length > 0) {
          setLibraryNameByKey((prev) => ({ ...prev, ...updates }));
          libraryNameByKeyRef.current = { ...libraryNameByKeyRef.current, ...updates };
        }
      }

      const out: Record<string, string> = {};
      for (const ref of refs) {
        const key = libraryRefKey(ref.serverId, ref.libraryId);
        out[key] = updates[key] ?? resolveName(ref.serverId, ref.libraryId);
      }
      return out;
    },
    [getApiForServer, t]
  );

  /** Local-only display names — never fetch music folders on launch (sync is user-triggered). */
  useEffect(() => {
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setLibraryNameByKey({});
      return;
    }
    const defaultLibraryName = t('servers.defaultLibraryName');
    const next: Record<string, string> = {};
    for (const s of toLoad) {
      const key = libraryRefKey(s.serverId, s.libraryId);
      next[key] =
        libraryNameByKeyRef.current[key] ??
        (s.libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : s.libraryId);
    }
    setLibraryNameByKey((prev) => ({ ...prev, ...next }));
  }, [scopesKey, t]);

  const cachedSongs = useMemo(() => slices.flatMap((s) => s.songs), [slices]);
  const albums = useMemo(() => albumsFromCachedSongs(cachedSongs), [cachedSongs]);

  const albumCatalogRows = useMemo(() => {
    const out: AlbumCatalogRow[] = [];
    for (const sl of slices) {
      for (const album of albumsFromCachedSongs(sl.songs)) {
        out.push({ album, serverId: sl.serverId, artworkScope: sl.scope });
      }
    }
    out.sort((a, b) => {
      const a0 = a.album.artist ?? '';
      const b0 = b.album.artist ?? '';
      const c = a0.localeCompare(b0, undefined, { sensitivity: 'base' });
      if (c !== 0) return c;
      return (a.album.name ?? '').localeCompare(b.album.name ?? '', undefined, { sensitivity: 'base' });
    });
    return out;
  }, [slices]);

  const artistCatalogRows = useMemo(() => {
    const out: ArtistCatalogRow[] = [];
    for (const sl of slices) {
      for (const artist of artistsFromCachedSongs(sl.songs)) {
        out.push({
          artist,
          serverId: sl.serverId,
          artworkScope: sl.scope,
          rowKey: `${sl.scope.serverKey}|${sl.scope.libraryId}|${artist.id}`,
        });
      }
    }
    out.sort((a, b) => a.artist.name.localeCompare(b.artist.name, undefined, { sensitivity: 'base' }));
    return out;
  }, [slices]);

  const songEntriesSorted: SongListEntry[] = useMemo(() => {
    const out: SongListEntry[] = [];
    for (const sl of slices) {
      const sorted = allCachedSongsSorted(sl.songs);
      for (const song of sorted) {
        out.push({
          song,
          rowKey: `${sl.scope.serverKey}|${sl.scope.libraryId}|${song.id}`,
          serverId: sl.serverId,
          artworkScope: sl.scope,
        });
      }
    }
    return out;
  }, [slices]);

  const favoriteSongEntriesSorted: SongListEntry[] = useMemo(() => {
    const out: SongListEntry[] = [];
    for (const sl of slices) {
      const starred = sl.songs.filter((s) => isChildStarred(s));
      starred.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }));
      for (const song of starred) {
        out.push({
          song,
          rowKey: `${sl.scope.serverKey}|${sl.scope.libraryId}|${song.id}`,
          serverId: sl.serverId,
          artworkScope: sl.scope,
        });
      }
    }
    return out;
  }, [slices]);

  const playlistCatalogRows = useMemo(() => {
    const out: PlaylistCatalogRow[] = [];
    for (const { serverId, serverKey } of uniqueServers) {
      const playlists = serverPlaylistsByServerKey[serverKey] ?? [];
      const sorted = [...playlists].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      for (const playlist of sorted) {
        out.push({
          kind: 'server',
          playlist,
          serverId,
          serverKey,
          rowKey: `${serverKey}|${playlist.id}`,
        });
      }
    }
    for (const playlist of localPlaylistSummaries) {
      out.push({
        kind: 'local',
        playlist: {
          id: playlist.id,
          name: playlist.name,
          songCount: playlist.trackCount,
        },
        rowKey: `local|${playlist.id}`,
      });
    }
    out.sort((a, b) => {
      const c = a.playlist.name.localeCompare(b.playlist.name, undefined, { sensitivity: 'base' });
      if (c !== 0) return c;
      return a.rowKey.localeCompare(b.rowKey);
    });
    return out;
  }, [uniqueServers, serverPlaylistsByServerKey, localPlaylistSummaries]);

  const canCreateServerPlaylist = scopesToLoad.length > 0;
  const canCreateLocalPlaylist = scopesToLoad.length > 0;

  const clearArtworkVersionThrottle = useCallback(() => {
    if (artworkFlushTimerRef.current) {
      clearTimeout(artworkFlushTimerRef.current);
      artworkFlushTimerRef.current = null;
    }
    artworkPendingRef.current = {};
    artworkLastFlushAtRef.current = 0;
    artworkVersionLastTouchedRef.current = {};
  }, []);

  const flushPendingArtworkVersions = useCallback(() => {
    if (artworkFlushTimerRef.current) {
      clearTimeout(artworkFlushTimerRef.current);
      artworkFlushTimerRef.current = null;
    }
    const pending = artworkPendingRef.current;
    const keys = Object.keys(pending);
    if (keys.length === 0) return;
    artworkPendingRef.current = {};
    artworkLastFlushAtRef.current = Date.now();
    const now = Date.now();
    setArtworkVersionById((prev) => {
      const next = { ...prev };
      const touched = artworkVersionLastTouchedRef.current;
      for (const k of keys) {
        next[k] = (next[k] ?? 0) + pending[k]!;
        touched[k] = now;
      }
      const entries = Object.keys(next);
      if (entries.length > MAX_ARTWORK_VERSION_ENTRIES) {
        const sorted = entries.sort((a, b) => (touched[a] ?? 0) - (touched[b] ?? 0));
        const removeCount = entries.length - MAX_ARTWORK_VERSION_ENTRIES;
        for (let i = 0; i < removeCount; i++) {
          const key = sorted[i]!;
          delete next[key];
          delete touched[key];
        }
      }
      return next;
    });
  }, []);

  const notifyArtworkCached = useCallback(
    (key: string) => {
      artworkPendingRef.current[key] = (artworkPendingRef.current[key] ?? 0) + 1;
      artworkVersionLastTouchedRef.current[key] = Date.now();
      const elapsed = Date.now() - artworkLastFlushAtRef.current;
      if (artworkLastFlushAtRef.current === 0 || elapsed >= ARTWORK_UI_RENDER_COOLDOWN_MS) {
        flushPendingArtworkVersions();
        return;
      }
      if (artworkFlushTimerRef.current) return;
      const delay = ARTWORK_UI_RENDER_COOLDOWN_MS - elapsed;
      artworkFlushTimerRef.current = setTimeout(() => {
        flushPendingArtworkVersions();
      }, delay);
    },
    [flushPendingArtworkVersions]
  );

  useEffect(() => {
    clearArtworkVersionThrottle();
    setArtworkVersionById({});
    return () => {
      clearArtworkVersionThrottle();
    };
  }, [scopesKey, host.libraryCache, clearArtworkVersionThrottle]);

  /** Warm Subsonic clients best-effort — do not gate on navigator.onLine (spotty mobile nets). */
  useEffect(() => {
    let cancelled = false;
    const toLoad = scopesToLoadRef.current;
    const ids = [...new Set(toLoad.map((s) => s.serverId))];
    void (async () => {
      const next: Record<string, SubsonicAPI | null> = {};
      for (const id of ids) {
        try {
          next[id] = await getApiForServer(id);
        } catch {
          next[id] = null;
        }
      }
      if (!cancelled) setApiByServerId((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [scopesKey, getApiForServer]);

  const apiForServer = useCallback((serverId: string) => apiByServerId[serverId] ?? null, [apiByServerId]);

  const applyLocalStarState = useCallback(
    async (args: { serverId: string; libraryId: string; trackId: string; starred: boolean }) => {
      const { serverId, libraryId, trackId, starred } = args;
      const toLoad = scopesToLoadRef.current;
      const sl = toLoad.find((s) => s.serverId === serverId && s.libraryId === libraryId);
      if (!sl) {
        throw new Error('Library is not available');
      }
      const tid = String(trackId);
      const prevSlices = slicesRef.current;
      const sliceIdx = prevSlices.findIndex((s) => s.serverId === serverId && s.libraryId === libraryId);
      if (sliceIdx < 0) {
        throw new Error('Library slice not loaded');
      }
      const songIdx = prevSlices[sliceIdx]!.songs.findIndex((s) => String(s.id) === tid);
      if (songIdx < 0) {
        throw new Error('Track not in local library cache');
      }
      const song = prevSlices[sliceIdx]!.songs[songIdx]!;
      const nextSong: Child = {
        ...song,
        starred: starred ? new Date().toISOString() : undefined,
      };
      await host.libraryCache.patchSong(sl.scope, nextSong);
      setSlices((prev) => {
        const i = prev.findIndex((s) => s.serverId === serverId && s.libraryId === libraryId);
        if (i < 0) return prev;
        const j = prev[i]!.songs.findIndex((s) => String(s.id) === tid);
        if (j < 0) return prev;
        const nextSongs = [...prev[i]!.songs];
        nextSongs[j] = nextSong;
        const next = [...prev];
        next[i] = { ...prev[i]!, songs: nextSongs };
        return next;
      });
    },
    [host.libraryCache]
  );

  const flushPendingStarMutations = useCallback(async () => {
    if (!pendingStarsHydratedRef.current) return;
    if (flushPendingStarsInFlightRef.current) return;
    flushPendingStarsInFlightRef.current = true;
    try {
      while (true) {
        const queue = coalescePendingStarMutations(pendingStarQueueRef.current);
        if (queue.length === 0) break;
        const flushed: PendingStarMutation[] = [];
        for (const m of queue) {
          let api: SubsonicAPI | null = null;
          try {
            api = await getApiForServer(m.serverId);
          } catch {
            continue;
          }
          if (!api) continue;
          try {
            if (m.starred) {
              await api.star({ id: m.trackId });
            } else {
              await api.unstar({ id: m.trackId });
            }
            flushed.push(m);
          } catch {
            /* keep in queue for retry */
          }
        }
        if (flushed.length === 0) break;
        pendingStarQueueRef.current = removePendingStarMutations(pendingStarQueueRef.current, flushed);
        await persistPendingStarQueue();
      }
    } finally {
      flushPendingStarsInFlightRef.current = false;
    }
  }, [getApiForServer, persistPendingStarQueue]);

  flushPendingStarMutationsRef.current = flushPendingStarMutations;

  const reapplyPendingStarsToSlices = useCallback(async () => {
    const queue = coalescePendingStarMutations(pendingStarQueueRef.current);
    for (const m of queue) {
      try {
        await applyLocalStarState(m);
      } catch {
        /* track may no longer be in cache */
      }
    }
  }, [applyLocalStarState]);

  const reapplyPendingStarsToSlicesRef = useRef(reapplyPendingStarsToSlices);
  reapplyPendingStarsToSlicesRef.current = reapplyPendingStarsToSlices;

  /** Load persisted queue once on launch, then try to sync once servers are restored. */
  useEffect(() => {
    if (isRestoring) return;
    let cancelled = false;
    void (async () => {
      if (!pendingStarsHydratedRef.current) {
        const json = await host.secureStorage.get(PENDING_STAR_MUTATIONS_STORAGE_KEY);
        if (cancelled) return;
        const fromDisk = parsePendingStarMutationsJson(json);
        // Merge disk with any mutations queued while the read was in flight.
        pendingStarQueueRef.current = coalescePendingStarMutations([
          ...fromDisk,
          ...pendingStarQueueRef.current,
        ]);
        pendingStarsHydratedRef.current = true;
        await persistPendingStarQueue();
        await reapplyPendingStarsToSlicesRef.current();
      }
      if (cancelled) return;
      await flushPendingStarMutationsRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [host, isRestoring, persistPendingStarQueue]);

  /** Opportunistic retry on browser `online` hint (never used as a pre-check gate). */
  useEffect(() => {
    if (isRestoring) return;
    const onOnline = () => {
      void flushPendingStarMutationsRef.current();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [isRestoring]);

  /** Retry periodically while the app is open. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void flushPendingStarMutationsRef.current();
    }, PENDING_STAR_MUTATIONS_RETRY_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const applyLocalPlayIncrement = useCallback(
    async (args: {
      serverId: string;
      libraryId: string;
      trackId: string;
      playedAt: number;
      /** When reapplying after sync, add this many plays instead of 1. */
      delta?: number;
    }) => {
      const { serverId, libraryId, trackId, playedAt } = args;
      const delta = args.delta ?? 1;
      if (delta <= 0) return;
      const toLoad = scopesToLoadRef.current;
      const sl = toLoad.find((s) => s.serverId === serverId && s.libraryId === libraryId);
      if (!sl) return;
      const tid = String(trackId);
      const prevSlices = slicesRef.current;
      const sliceIdx = prevSlices.findIndex((s) => s.serverId === serverId && s.libraryId === libraryId);
      if (sliceIdx < 0) return;
      const songIdx = prevSlices[sliceIdx]!.songs.findIndex((s) => String(s.id) === tid);
      if (songIdx < 0) return;
      const song = prevSlices[sliceIdx]!.songs[songIdx]!;
      const serverPlayedMs = song.played ? Date.parse(String(song.played)) : NaN;
      const keepServerPlayed =
        Number.isFinite(serverPlayedMs) && (serverPlayedMs as number) >= playedAt;
      const nextSong: Child = {
        ...song,
        playCount: (song.playCount ?? 0) + delta,
        played: keepServerPlayed ? song.played : new Date(playedAt).toISOString(),
      };
      await host.libraryCache.patchSong(sl.scope, nextSong);
      setSlices((prev) => {
        const i = prev.findIndex((s) => s.serverId === serverId && s.libraryId === libraryId);
        if (i < 0) return prev;
        const j = prev[i]!.songs.findIndex((s) => String(s.id) === tid);
        if (j < 0) return prev;
        const nextSongs = [...prev[i]!.songs];
        nextSongs[j] = nextSong;
        const next = [...prev];
        next[i] = { ...prev[i]!, songs: nextSongs };
        return next;
      });
    },
    [host.libraryCache]
  );

  const flushPendingPlayScrobbles = useCallback(async () => {
    if (!pendingPlaysHydratedRef.current) return;
    if (flushPendingPlaysInFlightRef.current) return;
    flushPendingPlaysInFlightRef.current = true;
    const flushedTracks: { serverId: string; libraryId: string; trackId: string }[] = [];
    try {
      while (true) {
        const queue = pendingPlayQueueRef.current;
        if (queue.length === 0) break;
        const flushedIds: string[] = [];
        for (const m of queue) {
          let api: SubsonicAPI | null = null;
          try {
            api = await getApiForServer(m.serverId);
          } catch {
            continue;
          }
          if (!api) continue;
          try {
            await api.scrobble({
              id: m.trackId,
              submission: true,
              time: m.playedAt,
            });
            flushedIds.push(m.id);
            flushedTracks.push({
              serverId: m.serverId,
              libraryId: m.libraryId,
              trackId: m.trackId,
            });
          } catch {
            /* keep in queue for retry */
          }
        }
        if (flushedIds.length === 0) break;
        pendingPlayQueueRef.current = removePendingPlayScrobblesById(
          pendingPlayQueueRef.current,
          flushedIds,
        );
        await persistPendingPlayQueue();
      }
    } finally {
      flushPendingPlaysInFlightRef.current = false;
    }
    // Best-effort reconcile with server (other devices) for tracks we just submitted.
    const seen = new Set<string>();
    for (const t of flushedTracks) {
      const key = pendingPlayTrackKey(t);
      if (seen.has(key)) continue;
      seen.add(key);
      void refreshTrackPlayCountRef.current(t);
    }
  }, [getApiForServer, persistPendingPlayQueue]);

  flushPendingPlayScrobblesRef.current = flushPendingPlayScrobbles;

  /** Load persisted play queue once on launch, then try to sync. */
  useEffect(() => {
    if (isRestoring) return;
    let cancelled = false;
    void (async () => {
      if (!pendingPlaysHydratedRef.current) {
        const json = await host.secureStorage.get(PENDING_PLAY_SCROBBLES_STORAGE_KEY);
        if (cancelled) return;
        const fromDisk = parsePendingPlayScrobblesJson(json);
        const byId = new Map<string, PendingPlayScrobble>();
        for (const m of fromDisk) byId.set(m.id, m);
        for (const m of pendingPlayQueueRef.current) byId.set(m.id, m);
        pendingPlayQueueRef.current = [...byId.values()].sort((a, b) => a.queuedAt - b.queuedAt);
        pendingPlaysHydratedRef.current = true;
        await persistPendingPlayQueue();
        // Do not reapply here: disk already has optimistic playCount from patchSong.
        // Reapply only after library sync replaces songs with server truth.
      }
      if (cancelled) return;
      await flushPendingPlayScrobblesRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [host, isRestoring, persistPendingPlayQueue]);

  useEffect(() => {
    if (isRestoring) return;
    const onOnline = () => {
      void flushPendingPlayScrobblesRef.current();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [isRestoring]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void flushPendingPlayScrobblesRef.current();
    }, PENDING_PLAY_SCROBBLES_RETRY_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const clearAllArtworkCache = useCallback(async () => {
    await host.libraryCache.purgeAllArtworkCache();
    clearCoverArtObjectUrlCache();
    clearArtworkVersionThrottle();
    setArtworkVersionById({});
    setArtworkCacheEpoch((epoch) => epoch + 1);
  }, [host.libraryCache, clearArtworkVersionThrottle]);

  const loadServerPlaylistsFromDisk = useCallback(async () => {
    const servers = uniqueServers.length > 0 ? uniqueServers : uniqueServersRef.current;
    const next: Record<string, LibraryPlaylistSummary[]> = {};
    for (const { serverKey } of servers) {
      next[serverKey] = await host.libraryCache.readPlaylistSummaries({ serverKey });
    }
    setServerPlaylistsByServerKey(next);
    return next;
  }, [host.libraryCache, uniqueServers]);

  const uniqueServersRef = useRef(uniqueServers);
  uniqueServersRef.current = uniqueServers;

  /**
   * Overlay pending offline star intents and play-count deltas onto slices freshly loaded
   * from disk (server truth after sync). Patches disk and returns a new slices array so the
   * first `setSlices` already includes pending local state (no flicker of wiped stars/counts).
   */
  const mergePendingLibraryMutationsIntoSlices = useCallback(
    async (slicesIn: LibraryBrowseSlice[]): Promise<LibraryBrowseSlice[]> => {
      const slices: LibraryBrowseSlice[] = slicesIn.map((s) => ({
        ...s,
        songs: s.songs.slice(),
      }));

      const patchInSlices = async (
        serverId: string,
        libraryId: string,
        trackId: string,
        mapSong: (song: Child) => Child,
      ) => {
        const sliceIdx = slices.findIndex(
          (s) => s.serverId === serverId && s.libraryId === libraryId,
        );
        if (sliceIdx < 0) return;
        const slice = slices[sliceIdx]!;
        const songIdx = slice.songs.findIndex((s) => String(s.id) === trackId);
        if (songIdx < 0) return;
        const nextSong = mapSong(slice.songs[songIdx]!);
        try {
          await host.libraryCache.patchSong(slice.scope, nextSong);
        } catch {
          return;
        }
        const nextSongs = slice.songs.slice();
        nextSongs[songIdx] = nextSong;
        slices[sliceIdx] = { ...slice, songs: nextSongs };
      };

      for (const m of coalescePendingStarMutations(pendingStarQueueRef.current)) {
        const tid = String(m.trackId);
        await patchInSlices(m.serverId, m.libraryId, tid, (song) => ({
          ...song,
          starred: m.starred ? new Date().toISOString() : undefined,
        }));
      }

      for (const d of pendingPlayDeltasByTrack(pendingPlayQueueRef.current).values()) {
        const tid = String(d.trackId);
        await patchInSlices(d.serverId, d.libraryId, tid, (song) => {
          const serverPlayedMs = song.played ? Date.parse(String(song.played)) : NaN;
          const keepServerPlayed =
            Number.isFinite(serverPlayedMs) && (serverPlayedMs as number) >= d.latestPlayedAt;
          return {
            ...song,
            playCount: (song.playCount ?? 0) + d.count,
            played: keepServerPlayed ? song.played : new Date(d.latestPlayedAt).toISOString(),
          };
        });
      }

      return slices;
    },
    [host.libraryCache],
  );

  const reloadCachedSongsFromDisk = useCallback(async () => {
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setSlices([]);
      setServerPlaylistsByServerKey({});
      return;
    }
    const loaded: LibraryBrowseSlice[] = [];
    for (const sl of toLoad) {
      const songs = await host.libraryCache.readSongList(sl.scope);
      loaded.push({
        serverId: sl.serverId,
        serverUrl: sl.serverUrl,
        username: sl.username,
        libraryId: sl.libraryId,
        scope: sl.scope,
        songs,
      });
    }
    const nextSlices = await mergePendingLibraryMutationsIntoSlices(loaded);
    slicesRef.current = nextSlices;
    setSlices(nextSlices);
    await loadServerPlaylistsFromDisk();
  }, [host.libraryCache, loadServerPlaylistsFromDisk, mergePendingLibraryMutationsIntoSlices]);

  useEffect(() => {
    if (isRestoring) return;
    let cancelled = false;
    setInitialReady(false);
    setCacheReadError(null);
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setSlices([]);
      setServerPlaylistsByServerKey({});
      setInitialReady(true);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const nextSlices: LibraryBrowseSlice[] = [];
      let songReadError: string | null = null;

      for (const sl of toLoad) {
        try {
          const songs = await host.libraryCache.readSongList(sl.scope);
          nextSlices.push({
            serverId: sl.serverId,
            serverUrl: sl.serverUrl,
            username: sl.username,
            libraryId: sl.libraryId,
            scope: sl.scope,
            songs,
          });
        } catch (e) {
          songReadError =
            e instanceof Error ? e.message : 'Could not open local library cache';
          nextSlices.push({
            serverId: sl.serverId,
            serverUrl: sl.serverUrl,
            username: sl.username,
            libraryId: sl.libraryId,
            scope: sl.scope,
            songs: [],
          });
        }
      }

      const playlistMap: Record<string, LibraryPlaylistSummary[]> = {};
      const loadedServerKeys = new Set<string>();
      for (const sl of toLoad) {
        if (loadedServerKeys.has(sl.scope.serverKey)) continue;
        loadedServerKeys.add(sl.scope.serverKey);
        try {
          playlistMap[sl.scope.serverKey] = await host.libraryCache.readPlaylistSummaries({
            serverKey: sl.scope.serverKey,
          });
        } catch {
          playlistMap[sl.scope.serverKey] = [];
        }
      }

      if (cancelled) return;
      setSlices(nextSlices);
      setServerPlaylistsByServerKey(playlistMap);
      setCacheReadError(songReadError);
      setInitialReady(true);
      void reapplyPendingStarsToSlicesRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [scopesKey, host.libraryCache, isRestoring]);

  const refreshPlaylistCacheForServerFn = useCallback(
    async (args: { serverId: string }) => {
      const { serverId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const scopeRow = scopesToLoadRef.current.find((s) => s.serverId === serverId);
      if (!scopeRow) throw new Error('Server is not available');
      const playlists = await refreshPlaylistCacheForServer(api, host.libraryCache, {
        serverKey: scopeRow.scope.serverKey,
      });
      setServerPlaylistsByServerKey((prev) => ({ ...prev, [scopeRow.scope.serverKey]: playlists }));
    },
    [getApiForServer, host.libraryCache]
  );

  const createPlaylist = useCallback(
    async (args: { serverId: string; name: string }) => {
      const { serverId, name } = args;
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Playlist name cannot be empty');
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const res = await api.createPlaylist({ name: trimmed });
      if (res.status !== 'ok') throw new Error('Could not create playlist');
      await refreshPlaylistCacheForServerFn({ serverId });
    },
    [getApiForServer, refreshPlaylistCacheForServerFn]
  );

  const deletePlaylist = useCallback(
    async (args: { serverId: string; playlistId: string }) => {
      const { serverId, playlistId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const res = await api.deletePlaylist({ id: playlistId });
      if (res.status !== 'ok') throw new Error('Could not delete playlist');
      await refreshPlaylistCacheForServerFn({ serverId });
    },
    [getApiForServer, refreshPlaylistCacheForServerFn]
  );

  const addTrackToPlaylist = useCallback(
    async (args: { serverId: string; playlistId: string; trackId: string }) => {
      const { serverId, playlistId, trackId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      await updatePlaylistTracks(api, {
        playlistId,
        songIdsToAdd: [trackId],
        songIndexesToRemove: [],
      });
      await refreshPlaylistCacheForServerFn({ serverId });
    },
    [getApiForServer, refreshPlaylistCacheForServerFn]
  );

  const updatePlaylistMembership = useCallback(
    async (args: {
      serverId: string;
      playlistId: string;
      songIdsToAdd: string[];
      songIndexesToRemove: number[];
    }) => {
      const { serverId, playlistId, songIdsToAdd, songIndexesToRemove } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      await updatePlaylistTracks(api, { playlistId, songIdsToAdd, songIndexesToRemove });
      await refreshPlaylistCacheForServerFn({ serverId });
    },
    [getApiForServer, refreshPlaylistCacheForServerFn]
  );

  const createLocalPlaylistFn = useCallback(
    async (name: string) => {
      const summary = await createLocalPlaylist(host.localPlaylists, name);
      await reloadLocalPlaylists();
      return summary;
    },
    [host.localPlaylists, reloadLocalPlaylists]
  );

  const deleteLocalPlaylistFn = useCallback(
    async (playlistId: string) => {
      await deleteLocalPlaylist(host.localPlaylists, playlistId);
      await reloadLocalPlaylists();
    },
    [host.localPlaylists, reloadLocalPlaylists]
  );

  const addTrackToLocalPlaylistFn = useCallback(
    async (args: { playlistId: string; ref: LocalPlaylistTrackRef }) => {
      await addTrackToLocalPlaylist(host.localPlaylists, args);
      await reloadLocalPlaylists();
    },
    [host.localPlaylists, reloadLocalPlaylists]
  );

  const updateLocalPlaylistMembershipFn = useCallback(
    async (args: {
      playlistId: string;
      songIdsToAdd: string[];
      songIndexesToRemove: number[];
      resolveRefForNewId: (compositeKey: string) => LocalPlaylistTrackRef | null;
    }) => {
      const entries = await host.localPlaylists.readEntries(args.playlistId);
      await updateLocalPlaylistMembership(host.localPlaylists, {
        playlistId: args.playlistId,
        entries,
        songIdsToAdd: args.songIdsToAdd,
        songIndexesToRemove: args.songIndexesToRemove,
        resolveRefForNewId: args.resolveRefForNewId,
      });
      await reloadLocalPlaylists();
    },
    [host.localPlaylists, reloadLocalPlaylists]
  );

  const setTrackStarred = useCallback(
    async (args: { serverId: string; libraryId: string; trackId: string; starred: boolean }) => {
      const { serverId, libraryId, trackId, starred } = args;
      const tid = String(trackId);

      await applyLocalStarState(args);
      pendingStarQueueRef.current = upsertPendingStarMutation(pendingStarQueueRef.current, {
        serverId,
        libraryId,
        trackId: tid,
        starred,
      });
      await persistPendingStarQueue();
      // Always attempt sync; failed requests stay queued (pendingStarMutation).
      void flushPendingStarMutations();
    },
    [applyLocalStarState, persistPendingStarQueue, flushPendingStarMutations]
  );

  const recordTrackPlayed = useCallback(
    async (args: {
      serverId: string;
      libraryId: string;
      trackId: string;
      playedAt?: number;
    }) => {
      const playedAt = args.playedAt ?? Date.now();
      const tid = String(args.trackId);
      // Optimistic patch when the track is in cache; always queue the scrobble.
      try {
        await applyLocalPlayIncrement({
          serverId: args.serverId,
          libraryId: args.libraryId,
          trackId: tid,
          playedAt,
          delta: 1,
        });
      } catch {
        /* track may not be in library cache */
      }
      pendingPlayQueueRef.current = appendPendingPlayScrobble(pendingPlayQueueRef.current, {
        serverId: args.serverId,
        libraryId: args.libraryId,
        trackId: tid,
        playedAt,
      });
      await persistPendingPlayQueue();
      void flushPendingPlayScrobbles();
    },
    [applyLocalPlayIncrement, persistPendingPlayQueue, flushPendingPlayScrobbles]
  );

  const refreshTrackPlayCount = useCallback(
    async (args: {
      serverId: string;
      libraryId: string;
      trackId: string;
      force?: boolean;
    }) => {
      const tid = String(args.trackId);
      const trackKey = pendingPlayTrackKey({
        serverId: args.serverId,
        libraryId: args.libraryId,
        trackId: tid,
      });
      const now = Date.now();
      if (!args.force) {
        const last = playCountRefreshAtRef.current.get(trackKey) ?? 0;
        if (now - last < PLAY_COUNT_REFRESH_DEBOUNCE_MS) return;
      }
      playCountRefreshAtRef.current.set(trackKey, now);

      try {
        const api = await getApiForServer(args.serverId);
        if (!api) return;
        const res = await api.getSong({ id: tid });
        const remote = res.song;
        if (!remote) return;

        const toLoad = scopesToLoadRef.current;
        const sl = toLoad.find(
          (s) => s.serverId === args.serverId && s.libraryId === args.libraryId,
        );
        if (!sl) return;

        const pending = pendingCountForTrack(pendingPlayQueueRef.current, {
          serverId: args.serverId,
          libraryId: args.libraryId,
          trackId: tid,
        });
        const serverCount = remote.playCount ?? 0;
        const mergedCount = serverCount + pending;

        const remotePlayedMs = remote.played ? Date.parse(String(remote.played)) : NaN;
        let latestPendingPlayedAt = 0;
        for (const m of pendingPlayQueueRef.current) {
          if (pendingPlayTrackKey(m) !== trackKey) continue;
          if (m.playedAt > latestPendingPlayedAt) latestPendingPlayedAt = m.playedAt;
        }
        const remotePlayedOk = Number.isFinite(remotePlayedMs);
        const usePendingPlayed =
          latestPendingPlayedAt > 0 &&
          (!remotePlayedOk || latestPendingPlayedAt > (remotePlayedMs as number));
        const nextPlayed = usePendingPlayed
          ? new Date(latestPendingPlayedAt).toISOString()
          : remote.played
            ? String(remote.played)
            : undefined;

        const prevSlices = slicesRef.current;
        const sliceIdx = prevSlices.findIndex(
          (s) => s.serverId === args.serverId && s.libraryId === args.libraryId,
        );
        if (sliceIdx < 0) return;
        const songIdx = prevSlices[sliceIdx]!.songs.findIndex((s) => String(s.id) === tid);
        if (songIdx < 0) return;
        const song = prevSlices[sliceIdx]!.songs[songIdx]!;
        const nextSong: Child = {
          ...song,
          playCount: mergedCount,
          played: nextPlayed ?? song.played,
        };
        await host.libraryCache.patchSong(sl.scope, nextSong);
        setSlices((prev) => {
          const i = prev.findIndex(
            (s) => s.serverId === args.serverId && s.libraryId === args.libraryId,
          );
          if (i < 0) return prev;
          const j = prev[i]!.songs.findIndex((s) => String(s.id) === tid);
          if (j < 0) return prev;
          const nextSongs = [...prev[i]!.songs];
          nextSongs[j] = nextSong;
          const next = [...prev];
          next[i] = { ...prev[i]!, songs: nextSongs };
          return next;
        });
      } catch {
        /* best-effort; keep cached count */
      }
    },
    [getApiForServer, host.libraryCache],
  );

  refreshTrackPlayCountRef.current = refreshTrackPlayCount;

  const flushPendingLibraryMutations = useCallback(async () => {
    await flushPendingStarMutations();
    await flushPendingPlayScrobbles();
  }, [flushPendingStarMutations, flushPendingPlayScrobbles]);

  const value = useMemo<LibraryBrowseCacheContextValue>(
    () => ({
      scopesToLoad,
      scopesKey,
      slices,
      multiLibrary,
      singleSlice: singleScopeRow,
      cachedSongs,
      albums,
      albumCatalogRows,
      artistCatalogRows,
      songEntriesSorted,
      favoriteSongEntriesSorted,
      playlistCatalogRows,
      serverPlaylistsByServerKey,
      multiServer,
      localPlaylistSummaries,
      canCreateServerPlaylist,
      canCreateLocalPlaylist,
      reloadLocalPlaylists,
      readLocalPlaylistEntries,
      initialReady,
      cacheReadError,
      reloadCachedSongsFromDisk,
      clearAllArtworkCache,
      apiByServerId,
      apiForServer,
      artworkVersionById,
      artworkVersionKey,
      getArtworkCacheBump,
      notifyArtworkCached,
      libraryDisplayName,
      serverDisplayName,
      ensureLibraryNames,
      setTrackStarred,
      recordTrackPlayed,
      refreshTrackPlayCount,
      flushPendingLibraryMutations,
      refreshPlaylistCacheForServer: refreshPlaylistCacheForServerFn,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      updatePlaylistMembership,
      createLocalPlaylist: createLocalPlaylistFn,
      deleteLocalPlaylist: deleteLocalPlaylistFn,
      addTrackToLocalPlaylist: addTrackToLocalPlaylistFn,
      updateLocalPlaylistMembership: updateLocalPlaylistMembershipFn,
    }),
    [
      scopesToLoad,
      scopesKey,
      slices,
      multiLibrary,
      singleScopeRow,
      cachedSongs,
      albums,
      albumCatalogRows,
      artistCatalogRows,
      songEntriesSorted,
      favoriteSongEntriesSorted,
      playlistCatalogRows,
      serverPlaylistsByServerKey,
      multiServer,
      localPlaylistSummaries,
      canCreateServerPlaylist,
      canCreateLocalPlaylist,
      reloadLocalPlaylists,
      readLocalPlaylistEntries,
      initialReady,
      cacheReadError,
      reloadCachedSongsFromDisk,
      clearAllArtworkCache,
      apiByServerId,
      apiForServer,
      artworkVersionById,
      artworkVersionKey,
      getArtworkCacheBump,
      notifyArtworkCached,
      libraryDisplayName,
      serverDisplayName,
      ensureLibraryNames,
      setTrackStarred,
      recordTrackPlayed,
      refreshTrackPlayCount,
      flushPendingLibraryMutations,
      refreshPlaylistCacheForServerFn,
      createPlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      updatePlaylistMembership,
      createLocalPlaylistFn,
      deleteLocalPlaylistFn,
      addTrackToLocalPlaylistFn,
      updateLocalPlaylistMembershipFn,
    ]
  );

  return <LibraryBrowseCacheContext.Provider value={value}>{children}</LibraryBrowseCacheContext.Provider>;
}

export function useLibraryBrowseCache(): LibraryBrowseCacheContextValue {
  const ctx = useContext(LibraryBrowseCacheContext);
  if (!ctx) {
    throw new Error('useLibraryBrowseCache must be used within LibraryBrowseCacheProvider');
  }
  return ctx;
}
