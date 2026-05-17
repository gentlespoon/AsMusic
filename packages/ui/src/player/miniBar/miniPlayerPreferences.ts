import { useSyncExternalStore } from 'react';

const MINI_PLAYER_SWIPE_GESTURES_KEY = 'asmusic-mini-player-swipe-gestures-v1';

const listeners = new Set<() => void>();

function readSwipeGesturesEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(MINI_PLAYER_SWIPE_GESTURES_KEY) !== '0';
  } catch {
    return true;
  }
}

function subscribeSwipeGestures(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onMiniPlayerSwipeGesturesStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onMiniPlayerSwipeGesturesStorage);
    }
  };
}

function onMiniPlayerSwipeGesturesStorage(e: StorageEvent): void {
  if (e.key === MINI_PLAYER_SWIPE_GESTURES_KEY) {
    emitSwipeGesturesChanged();
  }
}

function emitSwipeGesturesChanged(): void {
  listeners.forEach((l) => l());
}

export function getMiniPlayerSwipeGesturesEnabled(): boolean {
  return readSwipeGesturesEnabled();
}

export function setMiniPlayerSwipeGesturesEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MINI_PLAYER_SWIPE_GESTURES_KEY, next ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
  emitSwipeGesturesChanged();
}

/** Matches legacy iOS player bar: swipes + tap play/pause + hold to scrub (when enabled in Settings). */
export function useMiniPlayerSwipeGesturesEnabled(): boolean {
  return useSyncExternalStore(subscribeSwipeGestures, readSwipeGesturesEnabled, readSwipeGesturesEnabled);
}
