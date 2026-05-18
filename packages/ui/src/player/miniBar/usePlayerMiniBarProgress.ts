import { useWaveformProgressBarEnabled } from "../../preferences/waveformProgressBarPreference";
import { useOfflineReadyForItem } from "../useOfflineReadyForItem";
import { useWaveformPeaks } from "../fullScreen/useWaveformPeaks";
import type { PlayerQueueItem, PlayerViewState } from "../core/types";

export function usePlayerMiniBarProgress(
  state: PlayerViewState,
  item: PlayerQueueItem | null,
) {
  const busy = Boolean(item);
  const waveformEnabled = useWaveformProgressBarEnabled();
  const offlineReady = useOfflineReadyForItem(item);
  const wantWaveform = Boolean(
    busy &&
      waveformEnabled &&
      item &&
      (state.playingFromLocalFile || offlineReady),
  );
  const waveform = useWaveformPeaks(item, wantWaveform);
  const useWaveform = wantWaveform && waveform.status === "ready";
  const waveformPeaks = waveform.status === "ready" ? waveform.peaks : [];

  const duration =
    state.durationSeconds > 0
      ? state.durationSeconds
      : (item?.durationSeconds ?? 0);
  const playedFraction =
    duration > 0
      ? Math.min(1, Math.max(0, state.positionSeconds / duration))
      : 0;

  return {
    busy,
    useWaveform,
    waveformPeaks,
    playedFraction,
    durationSeconds: duration > 0 ? duration : undefined,
    isPlaying: state.isPlaying,
    progressPercent: playedFraction * 100,
  };
}
