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
import {
  CANONICAL_COVER_ART_SIZE,
  createNavidromeApi,
  ping,
  randomUuidV4,
  serverAccountKey,
  type NavidromeAuth,
  type PlatformHost,
  type SubsonicAPI,
} from '@asmusic/core';
import { useHost } from '@ui/host/HostContext';

const SERVERS_JSON_KEY = 'asmusic-servers-v1';
const LEGACY_SESSION_KEY = 'asmusic-session';
const ACTIVE_LIBRARIES_KEY = 'asmusic-active-libraries-v1';

function passwordStorageKey(serverId: string): string {
  return `asmusic-server-pw-${serverId}`;
}

function streamCredsStorageKey(serverId: string): string {
  return `asmusic-server-stream-creds-${serverId}`;
}

function parseStreamCredsJson(raw: string | null): NavidromeStreamCreds | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as NavidromeStreamCreds).subsonicToken === 'string' &&
      typeof (parsed as NavidromeStreamCreds).subsonicSalt === 'string'
    ) {
      return parsed as NavidromeStreamCreds;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type SavedServer = {
  id: string;
  serverUrl: string;
  username: string;
};

export type ActiveLibraryRef = {
  serverId: string;
  libraryId: string;
};

type NavidromeStreamCreds = {
  subsonicToken: string;
  subsonicSalt: string;
};

type ServerAndLibraryContextValue = {
  isRestoring: boolean;
  servers: SavedServer[];
  activeLibraryRefs: ActiveLibraryRef[];
  setActiveLibraryRefs: (next: ActiveLibraryRef[]) => void;
  toggleActiveLibrary: (ref: ActiveLibraryRef) => void;
  isLibraryActive: (ref: ActiveLibraryRef) => boolean;
  addServer: (
    serverUrl: string,
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateServer: (
    id: string,
    serverUrl: string,
    username: string,
    password?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  removeServer: (id: string) => Promise<void>;
  getApiForServer: (serverId: string) => Promise<SubsonicAPI | null>;
  /** Resolves Navidrome stream credentials; safe to call repeatedly. */
  ensureStreamReady: (serverId: string) => Promise<void>;
  getStreamUrl: (serverId: string, trackId: string) => string | null;
  getCoverArtUrl: (serverId: string, coverArtId: string) => string | null;
};

const ServerAndLibraryContext = createContext<ServerAndLibraryContextValue | null>(null);

function readActiveLibrariesFromDisk(): ActiveLibraryRef[] {
  try {
    const raw = localStorage.getItem(ACTIVE_LIBRARIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ActiveLibraryRef =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof (x as ActiveLibraryRef).serverId === 'string' &&
        typeof (x as ActiveLibraryRef).libraryId === 'string'
    );
  } catch {
    return [];
  }
}

function persistActiveLibraries(refs: ActiveLibraryRef[]) {
  localStorage.setItem(ACTIVE_LIBRARIES_KEY, JSON.stringify(refs));
}

export function ServerAndLibraryProvider({ children }: { children: ReactNode }) {
  const host = useHost() as PlatformHost;
  const [servers, setServers] = useState<SavedServer[]>([]);
  const [activeLibraryRefs, setActiveLibraryRefsState] = useState<ActiveLibraryRef[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [navidromeByServer, setNavidromeByServer] = useState<Record<string, NavidromeStreamCreds | null>>({});
  const navidromeByServerRef = useRef<Record<string, NavidromeStreamCreds | null>>({});
  const apiCacheRef = useRef<Map<string, SubsonicAPI>>(new Map());

  useEffect(() => {
    navidromeByServerRef.current = navidromeByServer;
  }, [navidromeByServer]);

  const setActiveLibraryRefs = useCallback((next: ActiveLibraryRef[]) => {
    setActiveLibraryRefsState(next);
    persistActiveLibraries(next);
  }, []);

  const loadServers = useCallback(async () => {
    try {
      const raw = await host.secureStorage.get(SERVERS_JSON_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (x): x is SavedServer =>
              Boolean(x) &&
              typeof x === 'object' &&
              typeof (x as SavedServer).id === 'string' &&
              typeof (x as SavedServer).serverUrl === 'string' &&
              typeof (x as SavedServer).username === 'string'
          );
          setServers(cleaned);
          return;
        }
      }

      const legacyRaw = await host.secureStorage.get(LEGACY_SESSION_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as {
          serverUrl?: string;
          username?: string;
          password?: string;
        };
        if (legacy?.serverUrl && legacy?.username && legacy?.password) {
          const id = randomUuidV4();
          const url = legacy.serverUrl.replace(/\/$/, '');
          const next: SavedServer = { id, serverUrl: url, username: legacy.username };
          await host.secureStorage.set(passwordStorageKey(id), legacy.password);
          await host.secureStorage.set(SERVERS_JSON_KEY, JSON.stringify([next]));
          await host.secureStorage.remove(LEGACY_SESSION_KEY);
          setServers([next]);
          return;
        }
      }
      setServers([]);
    } catch {
      setServers([]);
    }
  }, [host]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadServers();
      if (cancelled) return;
      setActiveLibraryRefsState(readActiveLibrariesFromDisk());
      setIsRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadServers]);

  /** Restore persisted stream creds so getStreamUrl works before navidromeSession on cold start. */
  useEffect(() => {
    if (servers.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, NavidromeStreamCreds | null> = {};
      for (const s of servers) {
        if (navidromeByServerRef.current[s.id]) {
          next[s.id] = navidromeByServerRef.current[s.id]!;
          continue;
        }
        const persisted = parseStreamCredsJson(
          await host.secureStorage.get(streamCredsStorageKey(s.id)),
        );
        if (persisted) {
          next[s.id] = persisted;
          navidromeByServerRef.current[s.id] = persisted;
        }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setNavidromeByServer((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [servers, host]);

  const persistServers = useCallback(
    async (next: SavedServer[]) => {
      setServers(next);
      await host.secureStorage.set(SERVERS_JSON_KEY, JSON.stringify(next));
    },
    [host]
  );

  const invalidateApiCache = useCallback((serverId?: string) => {
    if (serverId) {
      apiCacheRef.current.delete(serverId);
      delete navidromeByServerRef.current[serverId];
      setNavidromeByServer((prev) => {
        const copy = { ...prev };
        delete copy[serverId];
        return copy;
      });
    } else {
      apiCacheRef.current.clear();
      navidromeByServerRef.current = {};
      setNavidromeByServer({});
    }
  }, []);

  const hydrateNavidrome = useCallback(
    async (serverId: string, api: SubsonicAPI) => {
      try {
        const session = await api.navidromeSession();
        const creds = { subsonicToken: session.subsonicToken, subsonicSalt: session.subsonicSalt };
        await host.secureStorage.set(streamCredsStorageKey(serverId), JSON.stringify(creds));
        navidromeByServerRef.current = { ...navidromeByServerRef.current, [serverId]: creds };
        setNavidromeByServer((prev) => ({
          ...prev,
          [serverId]: creds,
        }));
      } catch {
        if (navidromeByServerRef.current[serverId]) {
          return;
        }
        const persisted = parseStreamCredsJson(
          await host.secureStorage.get(streamCredsStorageKey(serverId)),
        );
        if (persisted) {
          navidromeByServerRef.current = { ...navidromeByServerRef.current, [serverId]: persisted };
          setNavidromeByServer((prev) => ({ ...prev, [serverId]: persisted }));
          return;
        }
        navidromeByServerRef.current = { ...navidromeByServerRef.current, [serverId]: null };
        setNavidromeByServer((prev) => ({ ...prev, [serverId]: null }));
      }
    },
    [host]
  );

  const getApiForServer = useCallback(
    async (serverId: string): Promise<SubsonicAPI | null> => {
      const entry = servers.find((s) => s.id === serverId);
      if (!entry) return null;
      const cached = apiCacheRef.current.get(serverId);
      if (cached) {
        return cached;
      }
      const password = await host.secureStorage.get(passwordStorageKey(serverId));
      if (!password) return null;
      const url = entry.serverUrl.replace(/\/$/, '');
      const auth: NavidromeAuth = { username: entry.username, password };
      const api = createNavidromeApi(url, auth);
      await hydrateNavidrome(serverId, api);
      apiCacheRef.current.set(serverId, api);
      return api;
    },
    [servers, host, hydrateNavidrome]
  );

  const ensureStreamReady = useCallback(
    async (serverId: string): Promise<void> => {
      await getApiForServer(serverId);
    },
    [getApiForServer]
  );

  /** Warm Navidrome stream creds on launch so playback does not wait for a lazy API call. */
  useEffect(() => {
    if (isRestoring || servers.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const s of servers) {
        if (cancelled) return;
        await getApiForServer(s.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRestoring, servers, getApiForServer]);

  const getStreamUrl = useCallback(
    (serverId: string, trackId: string): string | null => {
      const entry = servers.find((s) => s.id === serverId);
      const creds = navidromeByServerRef.current[serverId];
      if (!entry || !creds) return null;
      const base = entry.serverUrl.replace(/\/$/, '');
      const params = new URLSearchParams({
        id: trackId,
        u: entry.username,
        t: creds.subsonicToken,
        s: creds.subsonicSalt,
        v: '1.16.1',
        c: 'AsMusic',
      });
      return `${base}/rest/stream.view?${params.toString()}`;
    },
    [servers]
  );

  const getCoverArtUrl = useCallback(
    (serverId: string, coverArtId: string): string | null => {
      const entry = servers.find((s) => s.id === serverId);
      const creds = navidromeByServerRef.current[serverId];
      if (!entry || !creds) return null;
      const id = coverArtId.trim();
      if (!id) return null;
      const base = entry.serverUrl.replace(/\/$/, '');
      const params = new URLSearchParams({
        id,
        size: String(CANONICAL_COVER_ART_SIZE),
        u: entry.username,
        t: creds.subsonicToken,
        s: creds.subsonicSalt,
        v: '1.16.1',
        c: 'AsMusic',
      });
      return `${base}/rest/getCoverArt.view?${params.toString()}`;
    },
    [servers]
  );

  const addServer = useCallback(
    async (
      serverUrl: string,
      username: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const url = serverUrl.trim().replace(/\/$/, '');
      const user = username.trim();
      const auth: NavidromeAuth = { username: user, password };
      try {
        const ok = await ping(url, auth);
        if (!ok) {
          return { ok: false, error: 'Server unreachable or invalid credentials' };
        }
        const id = randomUuidV4();
        await host.secureStorage.set(passwordStorageKey(id), password);
        const next: SavedServer = { id, serverUrl: url, username: user };
        await persistServers([...servers, next]);
        invalidateApiCache(id);
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not add server';
        return { ok: false, error: message };
      }
    },
    [servers, persistServers, host, invalidateApiCache]
  );

  const updateServer = useCallback(
    async (
      id: string,
      serverUrl: string,
      username: string,
      password?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const idx = servers.findIndex((s) => s.id === id);
      if (idx < 0) return { ok: false, error: 'Server not found' };
      const url = serverUrl.trim().replace(/\/$/, '');
      const user = username.trim();
      const pw =
        password && password.length > 0
          ? password
          : (await host.secureStorage.get(passwordStorageKey(id))) ?? '';
      if (!pw) {
        return { ok: false, error: 'Password required' };
      }
      const auth: NavidromeAuth = { username: user, password: pw };
      try {
        const ok = await ping(url, auth);
        if (!ok) {
          return { ok: false, error: 'Server unreachable or invalid credentials' };
        }
        if (password && password.length > 0) {
          await host.secureStorage.set(passwordStorageKey(id), password);
          await host.secureStorage.remove(streamCredsStorageKey(id));
        }
        const next = [...servers];
        next[idx] = { id, serverUrl: url, username: user };
        await persistServers(next);
        invalidateApiCache(id);
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not update server';
        return { ok: false, error: message };
      }
    },
    [servers, persistServers, host, invalidateApiCache]
  );

  const removeServer = useCallback(
    async (id: string) => {
      const entry = servers.find((s) => s.id === id);
      const nextList = servers.filter((s) => s.id !== id);
      await persistServers(nextList);
      await host.secureStorage.remove(passwordStorageKey(id));
      await host.secureStorage.remove(streamCredsStorageKey(id));
      invalidateApiCache(id);
      setActiveLibraryRefsState((prev) => {
        const pruned = prev.filter((r) => r.serverId !== id);
        persistActiveLibraries(pruned);
        return pruned;
      });
      if (entry) {
        try {
          await host.libraryCache.purgeServerAccount(serverAccountKey(entry.serverUrl, entry.username));
        } catch {
          /* ignore */
        }
      }
    },
    [servers, persistServers, host, invalidateApiCache]
  );

  const toggleActiveLibrary = useCallback(
    (ref: ActiveLibraryRef) => {
      setActiveLibraryRefsState((prev) => {
        const exists = prev.some((r) => r.serverId === ref.serverId && r.libraryId === ref.libraryId);
        const next = exists
          ? prev.filter((r) => !(r.serverId === ref.serverId && r.libraryId === ref.libraryId))
          : [...prev, ref];
        persistActiveLibraries(next);
        return next;
      });
    },
    []
  );

  const isLibraryActive = useCallback(
    (ref: ActiveLibraryRef) =>
      activeLibraryRefs.some((r) => r.serverId === ref.serverId && r.libraryId === ref.libraryId),
    [activeLibraryRefs]
  );

  const value = useMemo<ServerAndLibraryContextValue>(
    () => ({
      isRestoring,
      servers,
      activeLibraryRefs,
      setActiveLibraryRefs,
      toggleActiveLibrary,
      isLibraryActive,
      addServer,
      updateServer,
      removeServer,
      getApiForServer,
      ensureStreamReady,
      getStreamUrl,
      getCoverArtUrl,
    }),
    [
      isRestoring,
      servers,
      activeLibraryRefs,
      setActiveLibraryRefs,
      toggleActiveLibrary,
      isLibraryActive,
      addServer,
      updateServer,
      removeServer,
      getApiForServer,
      ensureStreamReady,
      getStreamUrl,
      getCoverArtUrl,
    ]
  );

  return <ServerAndLibraryContext.Provider value={value}>{children}</ServerAndLibraryContext.Provider>;
}

export function useServerAndLibrary(): ServerAndLibraryContextValue {
  const ctx = useContext(ServerAndLibraryContext);
  if (!ctx) {
    throw new Error('useServerAndLibrary must be used within ServerAndLibraryProvider');
  }
  return ctx;
}
