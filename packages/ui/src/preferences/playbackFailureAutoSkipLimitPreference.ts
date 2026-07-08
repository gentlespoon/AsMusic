import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-playback-failure-auto-skip-limit-v1';

export const PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MIN = 5;
export const PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MAX = 20;
export const PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_DEFAULT = 5;

const listeners = new Set<() => void>();

function clampLimit(value: number): number {
  return Math.max(
    PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MIN,
    Math.min(PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_MAX, Math.floor(value))
  );
}

function readPlaybackFailureAutoSkipLimit(): number {
  try {
    if (typeof localStorage === 'undefined') {
      return PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_DEFAULT;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') {
      return PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_DEFAULT;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_DEFAULT;
    }
    return clampLimit(parsed);
  } catch {
    return PLAYBACK_FAILURE_AUTO_SKIP_LIMIT_DEFAULT;
  }
}

function subscribePlaybackFailureAutoSkipLimit(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onPlaybackFailureAutoSkipLimitStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onPlaybackFailureAutoSkipLimitStorage);
    }
  };
}

function onPlaybackFailureAutoSkipLimitStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    emitPlaybackFailureAutoSkipLimitChanged();
  }
}

function emitPlaybackFailureAutoSkipLimitChanged(): void {
  listeners.forEach((l) => l());
}

export function getPlaybackFailureAutoSkipLimit(): number {
  return readPlaybackFailureAutoSkipLimit();
}

export function setPlaybackFailureAutoSkipLimit(next: number): void {
  const clamped = clampLimit(next);
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* ignore quota / private mode */
  }
  emitPlaybackFailureAutoSkipLimitChanged();
}

export function usePlaybackFailureAutoSkipLimit(): number {
  return useSyncExternalStore(
    subscribePlaybackFailureAutoSkipLimit,
    readPlaybackFailureAutoSkipLimit,
    readPlaybackFailureAutoSkipLimit
  );
}
