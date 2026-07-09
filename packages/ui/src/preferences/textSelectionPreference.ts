import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-text-selection-enabled-v1';

const listeners = new Set<() => void>();

function readTextSelectionEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeTextSelection(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onTextSelectionStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onTextSelectionStorage);
    }
  };
}

function onTextSelectionStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitTextSelectionChanged(): void {
  listeners.forEach((l) => l());
}

export function getTextSelectionEnabled(): boolean {
  return readTextSelectionEnabled();
}

export function setTextSelectionEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitTextSelectionChanged();
}

export function useTextSelectionEnabled(): boolean {
  return useSyncExternalStore(
    subscribeTextSelection,
    readTextSelectionEnabled,
    readTextSelectionEnabled,
  );
}
