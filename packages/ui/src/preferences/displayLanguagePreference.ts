import { SUPPORTED_LOCALES, type AppLocale } from '@asmusic/i18n';
import { useSyncExternalStore } from 'react';

/** Follow device / browser language, or pin a shipped catalog. */
export type DisplayLanguagePreference = 'system' | AppLocale;

const STORAGE_KEY = 'asmusic-display-language-v1';

const listeners = new Set<() => void>();

function isAppLocale(raw: string): raw is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw);
}

function readDisplayLanguagePreference(): DisplayLanguagePreference {
  try {
    if (typeof localStorage === 'undefined') return 'system';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '' || raw === 'system') return 'system';
    if (isAppLocale(raw)) return raw;
    return 'system';
  } catch {
    return 'system';
  }
}

function subscribeDisplayLanguage(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onDisplayLanguageStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onDisplayLanguageStorage);
    }
  };
}

function onDisplayLanguageStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitDisplayLanguageChanged(): void {
  listeners.forEach((l) => l());
}

export function getDisplayLanguagePreference(): DisplayLanguagePreference {
  return readDisplayLanguagePreference();
}

export function setDisplayLanguagePreference(next: DisplayLanguagePreference): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  emitDisplayLanguageChanged();
}

export function useDisplayLanguagePreference(): DisplayLanguagePreference {
  return useSyncExternalStore(
    subscribeDisplayLanguage,
    readDisplayLanguagePreference,
    readDisplayLanguagePreference
  );
}
