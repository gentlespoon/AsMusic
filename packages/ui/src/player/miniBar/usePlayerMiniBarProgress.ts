import { useMemo } from "react";
import { useWaveformProgressBarEnabled } from "../../preferences/waveformProgressBarPreference";
import {
  WAVEFORM_PLACEHOLDER_PEAKS,
} from "../WaveformProgressBar";
import { useWaveformPeaks } from "../fullScreen/useWaveformPeaks";
import type { PlayerQueueItem, PlayerViewState } from "../core/types";

export function usePlayerMiniBarProgress(
  state: PlayerViewState,
  item: PlayerQueueItem | null,
) {
  const busy = Boolean(item);
  const waveformEnabled = useWaveformProgressBarEnabled();
  const useWaveform = Boolean(
    busy && state.playingFromLocalFile && waveformEnabled,
  );
  const waveform = useWaveformPeaks(item, useWaveform);
  const waveformPeaks = useMemo(() => {
    if (waveform.status === "ready") return waveform.peaks;
    return WAVEFORM_PLACEHOLDER_PEAKS;
  }, [waveform]);

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
    isPlaying: state.isPlaying,
    progressPercent: playedFraction * 100,
  };
}
