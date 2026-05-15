import { useSyncExternalStore } from 'react';

export type AppAppearanceMode = 'light' | 'auto' | 'dark';

const STORAGE_KEY = 'asmusic-appearance-mode-v1';

const listeners = new Set<() => void>();

function readAppearanceMode(): AppAppearanceMode {
  try {
    if (typeof localStorage === 'undefined') return 'auto';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
    return 'auto';
  } catch {
    return 'auto';
  }
}

function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onAppearanceStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onAppearanceStorage);
    }
  };
}

function onAppearanceStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitAppearanceChanged(): void {
  listeners.forEach((l) => l());
}

export function getAppAppearanceMode(): AppAppearanceMode {
  return readAppearanceMode();
}

export function setAppAppearanceMode(next: AppAppearanceMode): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  emitAppearanceChanged();
}

export function useAppAppearanceMode(): AppAppearanceMode {
  return useSyncExternalStore(subscribeAppearance, readAppearanceMode, readAppearanceMode);
}
