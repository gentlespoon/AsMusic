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
  refreshLibraryCache,
  fetchMusicFolders,
  type LibraryCacheScope,
  refreshPlaylistCacheForScope,
  updatePlaylistTracks,
  PENDING_STAR_MUTATIONS_STORAGE_KEY,
  coalescePendingStarMutations,
  parsePendingStarMutationsJson,
  serializePendingStarMutations,
  upsertPendingStarMutation,
  removePendingStarMutations,
  type PendingStarMutation,
  createLocalPlaylist,
  deleteLocalPlaylist,
  addTrackToLocalPlaylist,
  updateLocalPlaylistMembership,
  type LocalPlaylistSummary,
  type LocalPlaylistTrackRef,
  type LibraryPlaylistSummary,
  type LibraryRefreshProgress,
  type SubsonicAPI,
} from '@asmusic/core';
import { useT } from '@asmusic/i18n';
import { useHost } from '../host/HostContext';
import { useServerAndLibrary } from './ServerAndLibraryContext';
import { clearCoverArtObjectUrlCache } from '../shared/coverArtObjectUrlCache';
import { useNetworkStatus } from '../shared/useNetworkStatus';
import type { AlbumCatalogRow } from '../views/home/library/catalog/AlbumListView';
import type { ArtistCatalogRow } from '../views/home/library/catalog/ArtistListView';
import type { SongListEntry } from '../views/home/library/catalog/SongListView';

export type LibraryBrowseSlice = {
  serverId: string;
  serverUrl: string;
  username: string;
  libraryId: string;
  scope: LibraryCacheScope;
  songs: Child[];
  playlists: LibraryPlaylistSummary[];
};

export type PlaylistCatalogRow =
  | {
      kind: 'server';
      playlist: LibraryPlaylistSummary;
      serverId: string;
      libraryId: string;
      artworkScope: LibraryCacheScope;
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
  localPlaylistSummaries: LocalPlaylistSummary[];
  canCreateServerPlaylist: boolean;
  canCreateLocalPlaylist: boolean;
  reloadLocalPlaylists: () => Promise<void>;
  readLocalPlaylistEntries: (playlistId: string) => Promise<import('@asmusic/core').LocalPlaylistEntry[]>;
  initialReady: boolean;
  cacheReadError: string | null;
  syncing: boolean;
  syncError: string | null;
  syncProgress: LibraryRefreshProgress | null;
  runRefresh: () => Promise<void>;
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
  refreshPlaylistSummariesForScope: (args: { serverId: string; libraryId: string }) => Promise<void>;
  createPlaylist: (args: { serverId: string; libraryId: string; name: string }) => Promise<void>;
  deletePlaylist: (args: { serverId: string; libraryId: string; playlistId: string }) => Promise<void>;
  addTrackToPlaylist: (args: {
    serverId: string;
    libraryId: string;
    playlistId: string;
    trackId: string;
  }) => Promise<void>;
  updatePlaylistMembership: (args: {
    serverId: string;
    libraryId: string;
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
  const { isOnline } = useNetworkStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const { servers, activeLibraryRefs, getApiForServer } = useServerAndLibrary();

  const pendingStarQueueRef = useRef<PendingStarMutation[]>([]);

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
  const singleScopeRow = scopesToLoad.length === 1 ? scopesToLoad[0] : null;

  const scopesToLoadRef = useRef(scopesToLoad);
  scopesToLoadRef.current = scopesToLoad;

  const [slices, setSlices] = useState<LibraryBrowseSlice[]>([]);
  const slicesRef = useRef(slices);
  slicesRef.current = slices;
  const [cacheReadError, setCacheReadError] = useState<string | null>(null);
  const [initialReady, setInitialReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<LibraryRefreshProgress | null>(null);
  const [artworkVersionById, setArtworkVersionById] = useState<Record<string, number>>({});
  const [artworkCacheEpoch, setArtworkCacheEpoch] = useState(0);
  const [apiByServerId, setApiByServerId] = useState<Record<string, SubsonicAPI | null>>({});
  const [libraryNameByKey, setLibraryNameByKey] = useState<Record<string, string>>({});
  const [localPlaylistSummaries, setLocalPlaylistSummaries] = useState<LocalPlaylistSummary[]>([]);

  useEffect(() => {
    void host.secureStorage.get(PENDING_STAR_MUTATIONS_STORAGE_KEY).then((json) => {
      pendingStarQueueRef.current = parsePendingStarMutationsJson(json);
    });
  }, [host]);

  const persistPendingStarQueue = useCallback(async () => {
    await host.secureStorage.set(
      PENDING_STAR_MUTATIONS_STORAGE_KEY,
      serializePendingStarMutations(pendingStarQueueRef.current),
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

  useEffect(() => {
    let cancelled = false;
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setLibraryNameByKey({});
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const next: Record<string, string> = {};
      const defaultLibraryName = t('servers.defaultLibraryName');
      for (const serverId of [...new Set(toLoad.map((s) => s.serverId))]) {
        const scopesForServer = toLoad.filter((s) => s.serverId === serverId);
        const api = await getApiForServer(serverId);
        if (!api) {
          for (const s of scopesForServer) {
            next[libraryRefKey(s.serverId, s.libraryId)] = s.libraryId;
          }
          continue;
        }
        let folders: Awaited<ReturnType<typeof fetchMusicFolders>>;
        try {
          folders = await fetchMusicFolders(api);
        } catch {
          folders = [];
        }
        if (folders.length === 0) {
          for (const s of scopesForServer) {
            next[libraryRefKey(s.serverId, s.libraryId)] =
              s.libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : s.libraryId;
          }
          continue;
        }
        for (const s of scopesForServer) {
          const key = libraryRefKey(s.serverId, s.libraryId);
          const folder = folders.find((f) => f.id === s.libraryId);
          next[key] = folder?.name ?? (s.libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : s.libraryId);
        }
      }
      if (!cancelled) setLibraryNameByKey(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [scopesKey, getApiForServer, t]);

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
    for (const sl of slices) {
      const sorted = [...sl.playlists].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      for (const playlist of sorted) {
        out.push({
          kind: 'server',
          playlist,
          serverId: sl.serverId,
          libraryId: sl.libraryId,
          artworkScope: sl.scope,
          rowKey: `${sl.scope.serverKey}|${sl.scope.libraryId}|${playlist.id}`,
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
  }, [slices, localPlaylistSummaries]);

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

  useEffect(() => {
    let cancelled = false;
    const toLoad = scopesToLoadRef.current;
    const ids = [...new Set(toLoad.map((s) => s.serverId))];
    void (async () => {
      const next: Record<string, SubsonicAPI | null> = {};
      for (const id of ids) {
        next[id] = await getApiForServer(id);
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
    const queue = coalescePendingStarMutations(pendingStarQueueRef.current);
    if (queue.length === 0) return;
    const flushed: PendingStarMutation[] = [];
    for (const m of queue) {
      const api = await getApiForServer(m.serverId);
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
    if (flushed.length > 0) {
      pendingStarQueueRef.current = removePendingStarMutations(pendingStarQueueRef.current, flushed);
      await persistPendingStarQueue();
    }
  }, [getApiForServer, persistPendingStarQueue]);

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

  useEffect(() => {
    if (!isOnline) return;
    void flushPendingStarMutations();
  }, [isOnline, flushPendingStarMutations]);

  const clearAllArtworkCache = useCallback(async () => {
    await host.libraryCache.purgeAllArtworkCache();
    clearCoverArtObjectUrlCache();
    clearArtworkVersionThrottle();
    setArtworkVersionById({});
    setArtworkCacheEpoch((epoch) => epoch + 1);
  }, [host.libraryCache, clearArtworkVersionThrottle]);

  const runRefresh = useCallback(async () => {
    if (scopesToLoad.length === 0) return;
    clearArtworkVersionThrottle();

    setSyncing(true);
    setSyncError(null);
    setSyncProgress(null);
    try {
      await flushPendingStarMutations();
      const built: LibraryBrowseSlice[] = [];

      for (const sl of scopesToLoad) {
        const api = await getApiForServer(sl.serverId);
        if (!api) {
          throw new Error(`Could not open a session for ${sl.serverUrl}`);
        }
        const { songs } = await refreshLibraryCache(api, host.libraryCache, sl.scope, (p) => setSyncProgress(p), {
          offlineMedia: host.offlineMedia,
        });
        const playlists = await host.libraryCache.readPlaylistSummaries(sl.scope);
        built.push({
          serverId: sl.serverId,
          serverUrl: sl.serverUrl,
          username: sl.username,
          libraryId: sl.libraryId,
          scope: sl.scope,
          songs,
          playlists,
        });
      }

      setSlices(built);
      await reapplyPendingStarsToSlices();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Library sync failed');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [
    scopesToLoad,
    getApiForServer,
    host.libraryCache,
    host.offlineMedia,
    clearArtworkVersionThrottle,
    flushPendingStarMutations,
    reapplyPendingStarsToSlices,
  ]);

  const runRefreshRef = useRef(runRefresh);
  runRefreshRef.current = runRefresh;

  const reloadCachedSongsFromDisk = useCallback(async () => {
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setSlices([]);
      return;
    }
    const nextSlices: LibraryBrowseSlice[] = [];
    for (const sl of toLoad) {
      const [songs, playlists] = await Promise.all([
        host.libraryCache.readSongList(sl.scope),
        host.libraryCache.readPlaylistSummaries(sl.scope),
      ]);
      nextSlices.push({
        serverId: sl.serverId,
        serverUrl: sl.serverUrl,
        username: sl.username,
        libraryId: sl.libraryId,
        scope: sl.scope,
        songs,
        playlists,
      });
    }
    setSlices(nextSlices);
  }, [host.libraryCache]);

  useEffect(() => {
    let cancelled = false;
    setInitialReady(false);
    setCacheReadError(null);
    const toLoad = scopesToLoadRef.current;
    if (toLoad.length === 0) {
      setSlices([]);
      setInitialReady(true);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const nextSlices: LibraryBrowseSlice[] = [];
        for (const sl of toLoad) {
          const [songs, playlists] = await Promise.all([
            host.libraryCache.readSongList(sl.scope),
            host.libraryCache.readPlaylistSummaries(sl.scope),
          ]);
          nextSlices.push({
            serverId: sl.serverId,
            serverUrl: sl.serverUrl,
            username: sl.username,
            libraryId: sl.libraryId,
            scope: sl.scope,
            songs,
            playlists,
          });
        }
        if (cancelled) return;
        setSlices(nextSlices);
        setInitialReady(true);
        if (nextSlices.every((s) => s.songs.length === 0)) {
          void runRefreshRef.current();
        }
      } catch (e) {
        if (!cancelled) {
          setCacheReadError(e instanceof Error ? e.message : 'Could not open local library cache');
          setInitialReady(true);
          void runRefreshRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopesKey, host.libraryCache]);

  const applyPlaylistsToSlice = useCallback((serverId: string, libraryId: string, playlists: LibraryPlaylistSummary[]) => {
    setSlices((prev) =>
      prev.map((s) => (s.serverId === serverId && s.libraryId === libraryId ? { ...s, playlists } : s))
    );
  }, []);

  const refreshPlaylistSummariesForScope = useCallback(
    async (args: { serverId: string; libraryId: string }) => {
      const { serverId, libraryId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const sl = scopesToLoadRef.current.find((s) => s.serverId === serverId && s.libraryId === libraryId);
      if (!sl) throw new Error('Library is not available');
      const playlists = await refreshPlaylistCacheForScope(api, host.libraryCache, sl.scope);
      applyPlaylistsToSlice(serverId, libraryId, playlists);
    },
    [getApiForServer, host.libraryCache, applyPlaylistsToSlice]
  );

  const createPlaylist = useCallback(
    async (args: { serverId: string; libraryId: string; name: string }) => {
      const { serverId, libraryId, name } = args;
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Playlist name cannot be empty');
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const res = await api.createPlaylist({ name: trimmed });
      if (res.status !== 'ok') throw new Error('Could not create playlist');
      await refreshPlaylistSummariesForScope({ serverId, libraryId });
    },
    [getApiForServer, refreshPlaylistSummariesForScope]
  );

  const deletePlaylist = useCallback(
    async (args: { serverId: string; libraryId: string; playlistId: string }) => {
      const { serverId, libraryId, playlistId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      const res = await api.deletePlaylist({ id: playlistId });
      if (res.status !== 'ok') throw new Error('Could not delete playlist');
      await refreshPlaylistSummariesForScope({ serverId, libraryId });
    },
    [getApiForServer, refreshPlaylistSummariesForScope]
  );

  const addTrackToPlaylist = useCallback(
    async (args: { serverId: string; libraryId: string; playlistId: string; trackId: string }) => {
      const { serverId, libraryId, playlistId, trackId } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      await updatePlaylistTracks(api, {
        playlistId,
        songIdsToAdd: [trackId],
        songIndexesToRemove: [],
      });
      await refreshPlaylistSummariesForScope({ serverId, libraryId });
    },
    [getApiForServer, refreshPlaylistSummariesForScope]
  );

  const updatePlaylistMembership = useCallback(
    async (args: {
      serverId: string;
      libraryId: string;
      playlistId: string;
      songIdsToAdd: string[];
      songIndexesToRemove: number[];
    }) => {
      const { serverId, libraryId, playlistId, songIdsToAdd, songIndexesToRemove } = args;
      const api = await getApiForServer(serverId);
      if (!api) throw new Error('Could not open a session for this server');
      await updatePlaylistTracks(api, { playlistId, songIdsToAdd, songIndexesToRemove });
      await refreshPlaylistSummariesForScope({ serverId, libraryId });
    },
    [getApiForServer, refreshPlaylistSummariesForScope]
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

      if (!isOnlineRef.current) {
        await applyLocalStarState(args);
        pendingStarQueueRef.current = upsertPendingStarMutation(pendingStarQueueRef.current, {
          serverId,
          libraryId,
          trackId: tid,
          starred,
        });
        await persistPendingStarQueue();
        return;
      }

      const api = await getApiForServer(serverId);
      if (!api) {
        throw new Error('Could not open a session for this server');
      }
      if (starred) {
        await api.star({ id: tid });
      } else {
        await api.unstar({ id: tid });
      }
      await applyLocalStarState(args);
    },
    [getApiForServer, applyLocalStarState, persistPendingStarQueue]
  );

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
      localPlaylistSummaries,
      canCreateServerPlaylist,
      canCreateLocalPlaylist,
      reloadLocalPlaylists,
      readLocalPlaylistEntries,
      initialReady,
      cacheReadError,
      syncing,
      syncError,
      syncProgress,
      runRefresh,
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
      refreshPlaylistSummariesForScope,
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
      localPlaylistSummaries,
      canCreateServerPlaylist,
      canCreateLocalPlaylist,
      reloadLocalPlaylists,
      readLocalPlaylistEntries,
      initialReady,
      cacheReadError,
      syncing,
      syncError,
      syncProgress,
      runRefresh,
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
      refreshPlaylistSummariesForScope,
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
