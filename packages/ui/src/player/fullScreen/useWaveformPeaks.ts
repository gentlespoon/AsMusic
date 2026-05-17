import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { offlineLookupScopes, type OfflinePlaybackSource } from "@asmusic/core";
import type { PlayerQueueItem } from "../core/types";
import { useHost } from "../../host/HostContext";

const BAR_COUNT = 96;
const peaksCache = new Map<string, number[]>();

function trackWaveformKey(item: PlayerQueueItem): string {
  return `${item.serverId}\t${item.libraryId}\t${item.trackId}`;
}

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

async function decodeWaveformPeaks(
  fetchUrl: string,
  barCount: number,
): Promise<number[]> {
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Waveform fetch failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    if (channel.length === 0) {
      return Array.from({ length: barCount }, () => 0.2);
    }
    const samplesPerBar = Math.max(1, Math.floor(channel.length / barCount));
    const peaks: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, channel.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]!);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / top);
  } finally {
    await ctx.close();
  }
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

  useEffect(() => {
    if (!enabled || !item) {
      setState({ status: "idle" });
      return;
    }

    const cacheKey = trackWaveformKey(item);
    const cached = peaksCache.get(cacheKey);
    if (cached) {
      setState({ status: "ready", peaks: cached });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
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
              BAR_COUNT,
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
        if (cancelled) return;

        const peaks =
          nativePeaks ??
          (fetchUrl
            ? await decodeWaveformPeaks(fetchUrl, BAR_COUNT)
            : (() => {
                throw new Error("No local playback source for waveform");
              })());
        if (cancelled) return;

        peaksCache.set(cacheKey, peaks);
        setState({ status: "ready", peaks });
      } catch {
        if (!cancelled) setState({ status: "error" });
      } finally {
        revoke?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    item?.serverId,
    item?.libraryId,
    item?.trackId,
    item?.serverUrl,
    item?.username,
    host.offlineMedia,
  ]);

  return state;
}
