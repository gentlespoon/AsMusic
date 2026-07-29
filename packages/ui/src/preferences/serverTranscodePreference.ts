import { useSyncExternalStore } from 'react';
import {
  OFFLINE_MEDIA_DEFAULT_VARIANT,
  OFFLINE_MEDIA_STREAM_VARIANT,
} from '@asmusic/core';

const STORAGE_KEY = 'asmusic-server-transcode-v1';

const listeners = new Set<() => void>();

function readServerTranscodeEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function subscribeServerTranscode(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onServerTranscodeStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onServerTranscodeStorage);
    }
  };
}

function onServerTranscodeStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitServerTranscodeChanged(): void {
  listeners.forEach((l) => l());
}

export function getServerTranscodeEnabled(): boolean {
  return readServerTranscodeEnabled();
}

export function setServerTranscodeEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitServerTranscodeChanged();
}

export function useServerTranscodeEnabled(): boolean {
  return useSyncExternalStore(
    subscribeServerTranscode,
    readServerTranscodeEnabled,
    readServerTranscodeEnabled,
  );
}

/** Offline blob variant matching current stream format preference. */
export function offlineMediaVariantForCurrentStream(): string {
  return getServerTranscodeEnabled()
    ? OFFLINE_MEDIA_STREAM_VARIANT
    : OFFLINE_MEDIA_DEFAULT_VARIANT;
}
