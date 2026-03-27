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
import { useAuth } from './AuthContext';
import type { Child } from 'subsonic-api';

type PlayerState = {
  queue: Child[];
  currentIndex: number;
  isPlaying: boolean;
  position: number;
};

type PlayerContextValue = PlayerState & {
  currentTrack: Child | null;
  /** Resolve stream URL for a track id (uses getStreamUrl or api.stream fallback). */
  getStreamUrlForId: (id: string) => Promise<string>;
  /** Set queue and optionally start at index. */
  setQueue: (tracks: Child[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (position: number) => void;
  /** Play a single track (replaces queue with one item). */
  playTrack: (track: Child) => void;
  /** Play track at index in current queue. */
  playIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { api, getStreamUrl } = useAuth();
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    position: 0,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = state.queue[state.currentIndex] ?? null;

  const getStreamUrlForId = useCallback(
    async (id: string): Promise<string> => {
      const url = getStreamUrl(id);
      if (url) return url;
      if (!api) throw new Error('Not authenticated');
      const response = await api.stream({ id });
      return response.url;
    },
    [api, getStreamUrl]
  );

  const setQueue = useCallback((tracks: Child[], startIndex = 0) => {
    setState((s) => ({
      ...s,
      queue: tracks,
      currentIndex: Math.max(0, Math.min(startIndex, tracks.length - 1)),
      isPlaying: tracks.length > 0,
      position: 0,
    }));
  }, []);

  const play = useCallback(() => setState((s) => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, isPlaying: false })), []);
  const togglePlayPause = useCallback(
    () => setState((s) => ({ ...s, isPlaying: !s.isPlaying })),
    []
  );
  const seek = useCallback((position: number) => {
    setState((s) => ({ ...s, position }));
    if (audioRef.current) {
      audioRef.current.currentTime = position;
    }
  }, []);

  const playTrack = useCallback(
    (track: Child) => {
      setQueue([track], 0);
    },
    [setQueue]
  );

  const playIndex = useCallback(
    (index: number) => {
      setState((s) => ({
        ...s,
        currentIndex: Math.max(0, Math.min(index, s.queue.length - 1)),
        isPlaying: true,
        position: 0,
      }));
    },
    []
  );

  const next = useCallback(() => {
    setState((s) => {
      const nextIndex = s.currentIndex + 1;
      if (nextIndex >= s.queue.length) return { ...s, isPlaying: false };
      return {
        ...s,
        currentIndex: nextIndex,
        position: 0,
        isPlaying: true,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState((s) => {
      if (s.position > 2) {
        return { ...s, position: 0 };
      }
      const prevIndex = s.currentIndex - 1;
      if (prevIndex < 0) return { ...s, position: 0 };
      return {
        ...s,
        currentIndex: prevIndex,
        position: 0,
        isPlaying: true,
      };
    });
  }, []);

  // Sync audio element with current track and play state
  useEffect(() => {
    if (!currentTrack || !api) return;
    let cancelled = false;
    const id = currentTrack.id;
    getStreamUrlForId(id).then((url) => {
      if (cancelled) return;
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.currentTime = state.position;
      if (state.isPlaying) audio.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, getStreamUrlForId, api]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.isPlaying]);

  // Update position from audio and handle track end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setState((s) => ({ ...s, position: audio.currentTime }));
    const onEnded = () => setState((s) => {
      const nextIndex = s.currentIndex + 1;
      if (nextIndex >= s.queue.length) return { ...s, isPlaying: false };
      return { ...s, currentIndex: nextIndex, position: 0 };
    });
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.id, state.currentIndex, state.queue.length]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      ...state,
      currentTrack,
      getStreamUrlForId,
      setQueue,
      play,
      pause,
      togglePlayPause,
      seek,
      playTrack,
      playIndex,
      next,
      previous,
    }),
    [
      state,
      currentTrack,
      getStreamUrlForId,
      setQueue,
      play,
      pause,
      togglePlayPause,
      seek,
      playTrack,
      playIndex,
      next,
      previous,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audioRef} />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return ctx;
}
