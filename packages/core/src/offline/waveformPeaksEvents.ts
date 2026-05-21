type WaveformPeaksListener = (cacheKey: string) => void;

const offlineMediaReadyListeners = new Set<WaveformPeaksListener>();
const waveformPeaksReadyListeners = new Set<WaveformPeaksListener>();

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
