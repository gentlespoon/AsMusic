import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  decodeWaveformPeaks,
  emitWaveformPeaksReady,
  offlineLookupScopes,
  subscribeOfflineMediaReady,
  subscribeWaveformPeaksReady,
  WAVEFORM_BAR_COUNT,
  type OfflinePlaybackSource,
} from "@asmusic/core";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { useHost } from "@ui/host/HostContext";
import {
  offlineMediaVariantForCurrentStream,
  useServerTranscodeEnabled,
} from "@ui/preferences/serverTranscodePreference";
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

const MAX_PEAK_LOAD_RETRIES = 2;
const PEAK_RETRY_DELAY_MS = 400;

export function useWaveformPeaks(
  item: PlayerQueueItem | null,
  enabled: boolean,
): WaveformPeaksState {
  const host = useHost();
  const serverTranscodeEnabled = useServerTranscodeEnabled();
  const [state, setState] = useState<WaveformPeaksState>({ status: "idle" });
  const [loadGeneration, setLoadGeneration] = useState(0);
  const retryCountRef = useRef(0);
  const cacheKeyRef = useRef<string | null>(null);

  const loadPeaks = useCallback(async () => {
    if (!item) return;

    const cacheKey = trackWaveformCacheKey(item);
    if (cacheKeyRef.current !== cacheKey) {
      cacheKeyRef.current = cacheKey;
      retryCountRef.current = 0;
    }

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
      const variant = offlineMediaVariantForCurrentStream();
      let fetchUrl: string | null = null;
      let nativePeaks: number[] | null = null;
      for (const scope of scopes) {
        if (getNativePeaks) {
          const peaks = await getNativePeaks(
            { scope, trackId: item.trackId, variant },
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
          variant,
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
      retryCountRef.current = 0;
      setState({ status: "ready", peaks });
    } catch {
      if (retryCountRef.current < MAX_PEAK_LOAD_RETRIES) {
        retryCountRef.current += 1;
        window.setTimeout(() => {
          setLoadGeneration((g) => g + 1);
        }, PEAK_RETRY_DELAY_MS);
        return;
      }
      setState({ status: "error" });
    } finally {
      revoke?.();
    }
  }, [item, host.offlineMedia, serverTranscodeEnabled]);

  useEffect(() => {
    if (!enabled || !item) {
      setState({ status: "idle" });
      retryCountRef.current = 0;
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
    serverTranscodeEnabled,
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
  }, [
    enabled,
    item?.serverUrl,
    item?.username,
    item?.libraryId,
    item?.trackId,
    serverTranscodeEnabled,
  ]);

  // Persist-while-streaming / transcode variant: retry peaks once the offline blob is ready.
  useEffect(() => {
    if (!enabled || !item) return;

    const cacheKey = trackWaveformCacheKey(item);
    return subscribeOfflineMediaReady((key) => {
      if (key !== cacheKey) return;
      retryCountRef.current = 0;
      setLoadGeneration((g) => g + 1);
    });
  }, [
    enabled,
    item?.serverUrl,
    item?.username,
    item?.libraryId,
    item?.trackId,
    serverTranscodeEnabled,
  ]);

  return state;
}
