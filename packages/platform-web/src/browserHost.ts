import { browserClipboard } from './browserClipboard';
import { createIndexedDbLibraryCacheStorage } from './indexedDbLibraryCacheStorage';
import { createIndexedDbOfflineMediaStorage } from './indexedDbOfflineMediaStorage';
import type {
  HapticsHost,
  PlatformHost,
  PlaybackHost,
  PlaybackStatePayload,
  SecureStorageHost,
  SleepTimerHost,
} from '@asmusic/core';

const libraryCache = createIndexedDbLibraryCacheStorage();
const offlineMedia = createIndexedDbOfflineMediaStorage();

let audioEl: HTMLAudioElement | null = null;

function audio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.setAttribute('playsinline', 'true');
    audioEl.preload = 'auto';
    document.body.appendChild(audioEl);
  }
  return audioEl;
}

const secureStorage: SecureStorageHost = {
  async get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  async remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function emitState(
  subs: Set<(s: PlaybackStatePayload) => void>,
  a: HTMLAudioElement,
  isPlaying: boolean
) {
  const durationSeconds = Number.isFinite(a.duration) ? a.duration : 0;
  const positionSeconds = Number.isFinite(a.currentTime) ? a.currentTime : 0;
  subs.forEach((cb) => cb({ durationSeconds, positionSeconds, isPlaying }));
}

function buildPlayback(): PlaybackHost {
  const stateSubs = new Set<(s: PlaybackStatePayload) => void>();
  const endedSubs = new Set<() => void>();
  const errorSubs = new Set<(e: { message: string }) => void>();

  const attachOnce = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const a = audio();
      const tick = () => emitState(stateSubs, a, !a.paused);
      a.addEventListener('timeupdate', tick);
      a.addEventListener('play', tick);
      a.addEventListener('pause', tick);
      a.addEventListener('loadedmetadata', tick);
      a.addEventListener('ended', () => {
        endedSubs.forEach((cb) => cb());
        tick();
      });
      a.addEventListener('error', () => {
        const message = a.error ? `Media error ${a.error.code}` : 'Playback error';
        errorSubs.forEach((cb) => cb({ message }));
      });
    };
  })();

  return {
    async loadUrl(url: string, _meta?: { title?: string; artist?: string; album?: string; artworkUrl?: string | null }) {
      attachOnce();
      const a = audio();
      a.src = url;
      a.load();
    },
    async play() {
      attachOnce();
      await audio().play();
    },
    async pause() {
      audio().pause();
    },
    async seek(positionSeconds: number) {
      const a = audio();
      a.currentTime = positionSeconds;
    },
    onPlaybackState(cb) {
      stateSubs.add(cb);
      return () => stateSubs.delete(cb);
    },
    onPlaybackEnded(cb) {
      endedSubs.add(cb);
      return () => endedSubs.delete(cb);
    },
    onPlaybackError(cb) {
      errorSubs.add(cb);
      return () => errorSubs.delete(cb);
    },
  };
}

function buildSleepTimer(): SleepTimerHost {
  let endsAtEpochMs: number | null = null;
  const elapsedSubs = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lifecycleAttached = false;

  const clearTick = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const fireElapsed = () => {
    if (endsAtEpochMs == null) return;
    endsAtEpochMs = null;
    clearTick();
    const cbs = [...elapsedSubs];
    cbs.forEach((cb) => cb());
  };

  const checkDeadline = () => {
    if (endsAtEpochMs == null) return;
    if (Date.now() >= endsAtEpochMs) fireElapsed();
  };

  const attachLifecycle = () => {
    if (lifecycleAttached || typeof document === 'undefined') return;
    lifecycleAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkDeadline();
    });
    window.addEventListener('focus', checkDeadline);
    window.addEventListener('pageshow', checkDeadline);
  };

  const armIfNeeded = () => {
    attachLifecycle();
    clearTick();
    if (endsAtEpochMs != null) {
      intervalId = setInterval(checkDeadline, 1000);
    }
  };

  return {
    async setDeadline(ms: number | null) {
      endsAtEpochMs = ms;
      clearTick();
      if (ms != null) {
        armIfNeeded();
        checkDeadline();
      }
    },
    async getDeadline() {
      return endsAtEpochMs;
    },
    onElapsed(cb) {
      elapsedSubs.add(cb);
      return () => elapsedSubs.delete(cb);
    },
  };
}

const haptics: HapticsHost = {
  async impact() {
    /* web dev — no haptics */
  },
};

export const browserHost: PlatformHost = {
  kind: 'browser',
  secureStorage,
  playback: buildPlayback(),
  sleepTimer: buildSleepTimer(),
  haptics,
  clipboard: browserClipboard,
  libraryCache,
  offlineMedia,
};
