type WaveformPeaksListener = (cacheKey: string) => void;

const offlineMediaReadyListeners = new Set<WaveformPeaksListener>();
const waveformPeaksReadyListeners = new Set<WaveformPeaksListener>();
const offlineMediaDiscardedListeners = new Set<WaveformPeaksListener>();

export function emitOfflineMediaReady(cacheKey: string): void {
  for (const listener of offlineMediaReadyListeners) {
    listener(cacheKey);
  }
}

export function emitWaveformPeaksReady(cacheKey: string): void {
  for (const listener of waveformPeaksReadyListeners) {
    listener(cacheKey);
  }
}

export function subscribeOfflineMediaReady(listener: WaveformPeaksListener): () => void {
  offlineMediaReadyListeners.add(listener);
  return () => offlineMediaReadyListeners.delete(listener);
}

export function subscribeWaveformPeaksReady(listener: WaveformPeaksListener): () => void {
  waveformPeaksReadyListeners.add(listener);
  return () => waveformPeaksReadyListeners.delete(listener);
}

/** A stored copy was deleted because it was not playable audio (for example a server error page). */
export function emitOfflineMediaDiscarded(cacheKey: string): void {
  for (const listener of offlineMediaDiscardedListeners) {
    listener(cacheKey);
  }
}

export function subscribeOfflineMediaDiscarded(listener: WaveformPeaksListener): () => void {
  offlineMediaDiscardedListeners.add(listener);
  return () => offlineMediaDiscardedListeners.delete(listener);
}
