import { emitOfflineMediaReady, emitWaveformPeaksReady } from '@asmusic/core';
import { AsmusicNative } from './asmusicNativePlugin';

let installed = false;

/** Bridges iOS native offline / waveform notifications into core event bus (once). */
export function installCapacitorOfflineMediaEventBridge(): void {
  if (installed) return;
  installed = true;
  void AsmusicNative.addListener('offlineMediaReady', ({ cacheKey }) => {
    emitOfflineMediaReady(cacheKey);
  });
  void AsmusicNative.addListener('waveformPeaksReady', ({ cacheKey }) => {
    emitWaveformPeaksReady(cacheKey);
  });
}
