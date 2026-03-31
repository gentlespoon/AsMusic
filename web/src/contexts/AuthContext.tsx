import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createNavidromeApi, ping, type NavidromeAuth, type SubsonicAPI } from '@/api';

const SESSION_KEY = 'asmusic-session';

type StoredSession = {
  serverUrl: string;
  username: string;
  password: string;
};

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed?.serverUrl && parsed?.username && parsed?.password) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(session: StoredSession | null) {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

type AuthState = {
  api: SubsonicAPI | null;
  user: string | null;
  serverUrl: string | null;
  /** From navidromeSession(); used to build stream URLs without extra requests. */
  subsonicToken: string | null;
  subsonicSalt: string | null;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  /** True while attempting to restore session from storage on mount. */
  isRestoring: boolean;
  login: (serverUrl: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Build stream URL for a track id (Navidrome). Returns null if no token/salt. */
  getStreamUrl: (id: string) => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    api: null,
    user: null,
    serverUrl: null,
    subsonicToken: null,
    subsonicSalt: null,
  });
  const [isRestoring, setIsRestoring] = useState(true);

  const applyLogin = useCallback(
    (url: string, username: string, api: SubsonicAPI) => {
      let subsonicToken: string | null = null;
      let subsonicSalt: string | null = null;
      return (async () => {
        try {
          const session = await api.navidromeSession();
          subsonicToken = session.subsonicToken;
          subsonicSalt = session.subsonicSalt;
        } catch {
          /* non-Navidrome */
        }
        setState({ api, user: username, serverUrl: url, subsonicToken, subsonicSalt });
      })();
    },
    []
  );

  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setIsRestoring(false);
      return;
    }
    const url = stored.serverUrl.replace(/\/$/, '');
    const auth: NavidromeAuth = { username: stored.username, password: stored.password };
    ping(url, auth)
      .then((ok) => {
        if (!ok) {
          saveSession(null);
          return;
        }
        const api = createNavidromeApi(url, auth);
        return applyLogin(url, stored.username, api);
      })
      .catch(() => saveSession(null))
      .finally(() => setIsRestoring(false));
  }, [applyLogin]);

  const login = useCallback(
    async (
      serverUrl: string,
      username: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const url = serverUrl.replace(/\/$/, '');
      const auth: NavidromeAuth = { username, password };

      try {
        const ok = await ping(url, auth);
        if (!ok) {
          return { ok: false, error: 'Server unreachable or invalid credentials' };
        }
        const api = createNavidromeApi(url, auth);
        let subsonicToken: string | null = null;
        let subsonicSalt: string | null = null;
        try {
          const session = await api.navidromeSession();
          subsonicToken = session.subsonicToken;
          subsonicSalt = session.subsonicSalt;
        } catch {
          // Non-Navidrome or auth API disabled; stream URLs will use fallback
        }
        setState({ api, user: username, serverUrl: url, subsonicToken, subsonicSalt });
        saveSession({ serverUrl: url, username, password });
        return { ok: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Login failed';
        return { ok: false, error: message };
      }
    },
    []
  );

  const logout = useCallback(() => {
    saveSession(null);
    setState({
      api: null,
      user: null,
      serverUrl: null,
      subsonicToken: null,
      subsonicSalt: null,
    });
  }, []);

  const getStreamUrl = useCallback(
    (id: string): string | null => {
      const { serverUrl, user, subsonicToken, subsonicSalt } = state;
      if (!serverUrl || !user || !subsonicToken || !subsonicSalt) return null;
      const base = serverUrl.replace(/\/$/, '');
      const params = new URLSearchParams({
        id,
        u: user,
        t: subsonicToken,
        s: subsonicSalt,
        v: '1.16.1',
        c: 'AsMusic',
      });
      return `${base}/rest/stream.view?${params.toString()}`;
    },
    [state.serverUrl, state.user, state.subsonicToken, state.subsonicSalt]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.api !== null,
      isRestoring,
      login,
      logout,
      getStreamUrl,
    }),
    [state, isRestoring, login, logout, getStreamUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
