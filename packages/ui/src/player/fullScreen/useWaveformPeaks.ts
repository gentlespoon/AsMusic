import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  decodeWaveformPeaks,
  emitWaveformPeaksReady,
  offlineLookupScopes,
  subscribeWaveformPeaksReady,
  WAVEFORM_BAR_COUNT,
  type OfflinePlaybackSource,
} from "@asmusic/core";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { useHost } from "@ui/host/HostContext";
import { peaksCache } from "@ui/player/waveformPeaksCache";
import { trackWaveformCacheKey } from "@ui/player/trackWaveformCacheKey";

export { trackWaveformCacheKey };

/** WebView-safe URL for reading local audio bytes (blob/http on web; capacitor:// on iOS). */
function resolveWaveformFetchUrl(local: OfflinePlaybackSource): string {
  if (local.localFilePath) {
    return Capacitor.convertFileSrc(local.localFilePath);
  }
  const url = local.url;
  if (!url) {
    throw new Error("No local playback source for waveform");
  }
  if (
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  if (url.startsWith("file:")) {
    return Capacitor.convertFileSrc(decodeURIComponent(new URL(url).pathname));
  }
  return url;
}

export type WaveformPeaksState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; peaks: number[] }
  | { status: "error" };

export function useWaveformPeaks(
  item: PlayerQueueItem | null,
  enabled: boolean,
): WaveformPeaksState {
  const host = useHost();
  const [state, setState] = useState<WaveformPeaksState>({ status: "idle" });
  const [loadGeneration, setLoadGeneration] = useState(0);

  const loadPeaks = useCallback(async () => {
    if (!item) return;

    const cacheKey = trackWaveformCacheKey(item);
    const cached = peaksCache.get(cacheKey);
    if (cached) {
      setState({ status: "ready", peaks: cached });
      return;
    }

    setState({ status: "loading" });

    let revoke: (() => void) | undefined;
    try {
      const scopes = offlineLookupScopes(
        item.serverUrl,
        item.username,
        item.libraryId,
      );
      const getNativePeaks = host.offlineMedia.getWaveformPeaks;
      let fetchUrl: string | null = null;
      let nativePeaks: number[] | null = null;
      for (const scope of scopes) {
        if (getNativePeaks) {
          const peaks = await getNativePeaks(
            { scope, trackId: item.trackId },
            WAVEFORM_BAR_COUNT,
          );
          if (peaks && peaks.length > 0) {
            nativePeaks = peaks;
            break;
          }
        }
        const local = await host.offlineMedia.getReadyPlaybackSource({
          scope,
          trackId: item.trackId,
        });
        if (!local) continue;
        revoke = local.revoke;
        fetchUrl = resolveWaveformFetchUrl(local);
        break;
      }

      const peaks =
        nativePeaks ??
        (fetchUrl
          ? await decodeWaveformPeaks(fetchUrl, WAVEFORM_BAR_COUNT)
          : (() => {
              throw new Error("No local playback source for waveform");
            })());

      peaksCache.set(cacheKey, peaks);
      emitWaveformPeaksReady(cacheKey);
      setState({ status: "ready", peaks });
    } catch {
      setState({ status: "error" });
    } finally {
      revoke?.();
    }
  }, [item, host.offlineMedia]);

  useEffect(() => {
    if (!enabled || !item) {
      setState({ status: "idle" });
      return;
    }

    const cacheKey = trackWaveformCacheKey(item);
    const cached = peaksCache.get(cacheKey);
    if (cached) {
      setState({ status: "ready", peaks: cached });
      return;
    }

    void loadPeaks();
  }, [
    enabled,
    item?.serverUrl,
    item?.username,
    item?.libraryId,
    item?.trackId,
    item?.serverId,
    loadGeneration,
    loadPeaks,
  ]);

  useEffect(() => {
    if (!enabled || !item) return;

    const cacheKey = trackWaveformCacheKey(item);
    return subscribeWaveformPeaksReady((key) => {
      if (key !== cacheKey) return;
      const cached = peaksCache.get(cacheKey);
      if (cached) {
        setState({ status: "ready", peaks: cached });
        return;
      }
      setLoadGeneration((g) => g + 1);
    });
  }, [enabled, item?.serverUrl, item?.username, item?.libraryId, item?.trackId]);

  return state;
}
