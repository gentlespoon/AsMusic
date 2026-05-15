import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-haptic-feedback-v1';

const listeners = new Set<() => void>();

function readHapticFeedbackEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function subscribeHaptic(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onHapticStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onHapticStorage);
    }
  };
}

function onHapticStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitHapticChanged(): void {
  listeners.forEach((l) => l());
}

export function getHapticFeedbackEnabled(): boolean {
  return readHapticFeedbackEnabled();
}

export function setHapticFeedbackEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitHapticChanged();
}

export function useHapticFeedbackEnabled(): boolean {
  return useSyncExternalStore(subscribeHaptic, readHapticFeedbackEnabled, readHapticFeedbackEnabled);
}
