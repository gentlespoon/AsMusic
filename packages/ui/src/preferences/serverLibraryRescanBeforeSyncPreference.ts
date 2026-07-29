import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-server-library-rescan-before-sync-v1';

const listeners = new Set<() => void>();

function readServerLibraryRescanBeforeSyncEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeServerLibraryRescanBeforeSync(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onServerLibraryRescanBeforeSyncStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onServerLibraryRescanBeforeSyncStorage);
    }
  };
}

function onServerLibraryRescanBeforeSyncStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitServerLibraryRescanBeforeSyncChanged(): void {
  listeners.forEach((l) => l());
}

export function getServerLibraryRescanBeforeSyncEnabled(): boolean {
  return readServerLibraryRescanBeforeSyncEnabled();
}

export function setServerLibraryRescanBeforeSyncEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitServerLibraryRescanBeforeSyncChanged();
}

export function useServerLibraryRescanBeforeSyncEnabled(): boolean {
  return useSyncExternalStore(
    subscribeServerLibraryRescanBeforeSync,
    readServerLibraryRescanBeforeSyncEnabled,
    readServerLibraryRescanBeforeSyncEnabled,
  );
}
