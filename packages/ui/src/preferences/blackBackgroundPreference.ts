import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-black-background-v1';

const listeners = new Set<() => void>();

function readBlackBackgroundEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeBlackBackground(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onBlackBackgroundStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onBlackBackgroundStorage);
    }
  };
}

function onBlackBackgroundStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitBlackBackgroundChanged(): void {
  listeners.forEach((l) => l());
}

export function getBlackBackgroundEnabled(): boolean {
  return readBlackBackgroundEnabled();
}

export function setBlackBackgroundEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitBlackBackgroundChanged();
}

export function useBlackBackgroundEnabled(): boolean {
  return useSyncExternalStore(
    subscribeBlackBackground,
    readBlackBackgroundEnabled,
    readBlackBackgroundEnabled,
  );
}
