import { useSyncExternalStore } from 'react';

export type AlbumDisplayMode = 'grid' | 'list';

const STORAGE_KEY = 'asmusic-album-display-mode-v1';

const listeners = new Set<() => void>();

function readAlbumDisplayMode(): AlbumDisplayMode {
  try {
    if (typeof localStorage === 'undefined') return 'grid';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'grid' || raw === 'list') return raw;
    return 'grid';
  } catch {
    return 'grid';
  }
}

function subscribeAlbumDisplayMode(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onAlbumDisplayModeStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onAlbumDisplayModeStorage);
    }
  };
}

function onAlbumDisplayModeStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitAlbumDisplayModeChanged(): void {
  listeners.forEach((l) => l());
}

export function getAlbumDisplayMode(): AlbumDisplayMode {
  return readAlbumDisplayMode();
}

export function setAlbumDisplayMode(next: AlbumDisplayMode): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  emitAlbumDisplayModeChanged();
}

export function useAlbumDisplayMode(): AlbumDisplayMode {
  return useSyncExternalStore(subscribeAlbumDisplayMode, readAlbumDisplayMode, readAlbumDisplayMode);
}
