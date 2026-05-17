import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'asmusic-waveform-progress-bar-v1';

const listeners = new Set<() => void>();

function readWaveformProgressBarEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function subscribeWaveformProgressBar(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onWaveformProgressBarStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onWaveformProgressBarStorage);
    }
  };
}

function onWaveformProgressBarStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l());
  }
}

function emitWaveformProgressBarChanged(): void {
  listeners.forEach((l) => l());
}

export function getWaveformProgressBarEnabled(): boolean {
  return readWaveformProgressBarEnabled();
}

export function setWaveformProgressBarEnabled(next: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  emitWaveformProgressBarChanged();
}

export function useWaveformProgressBarEnabled(): boolean {
  return useSyncExternalStore(
    subscribeWaveformProgressBar,
    readWaveformProgressBarEnabled,
    readWaveformProgressBarEnabled,
  );
}
