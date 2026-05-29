import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-player-debug-log-menu-v1';

const listeners = new Set<() => void>();

function readPlayerDebugLogMenuEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribePlayerDebugLogMenu(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onPlayerDebugLogMenuStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onPlayerDebugLogMenuStorage);
    }
  };
}

function onPlayerDebugLogMenuStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitPlayerDebugLogMenuChanged(): void {
  listeners.forEach((l) => l());
}

export function getPlayerDebugLogMenuEnabled(): boolean {
  return readPlayerDebugLogMenuEnabled();
}

export function setPlayerDebugLogMenuEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitPlayerDebugLogMenuChanged();
}

export function usePlayerDebugLogMenuEnabled(): boolean {
  return useSyncExternalStore(
    subscribePlayerDebugLogMenu,
    readPlayerDebugLogMenuEnabled,
    readPlayerDebugLogMenuEnabled,
  );
}
