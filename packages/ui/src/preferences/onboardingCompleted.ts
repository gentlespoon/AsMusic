import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-onboarding-completed-v1';

const listeners = new Set<() => void>();

function readOnboardingCompleted(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function onStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

export function getOnboardingCompleted(): boolean {
  return readOnboardingCompleted();
}

export function setOnboardingCompleted(completed: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (completed) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  emit();
}

export function useOnboardingCompleted(): boolean {
  return useSyncExternalStore(subscribe, readOnboardingCompleted, readOnboardingCompleted);
}
