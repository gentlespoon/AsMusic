import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { formatDuration } from "@asmusic/core";
import {
  usePlayerActions,
  usePlayerShell,
  usePlayerTransportState,
} from "@ui/contexts/PlayerContext";
import { useWaveformProgressBarEnabled } from "@ui/preferences/waveformProgressBarPreference";
import { useServerTranscodeEnabled } from "@ui/preferences/serverTranscodePreference";
import { formatPlaybackFormatLabel } from "@ui/player/formatPlaybackFormatLabel";
import { useOfflineReadyForItem } from "@ui/player/useOfflineReadyForItem";
import { WaveformScrubBar } from "./WaveformScrubBar";
import { useWaveformPeaks } from "./useWaveformPeaks";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerFullScreenProgressBar() {
  const state = usePlayerTransportState();
  const { fullPlayerOpen } = usePlayerShell();
  const { seek } = usePlayerActions();
  const item = state.currentItem;
  const busy = Boolean(item);
  const waveformEnabled = useWaveformProgressBarEnabled();
  const serverTranscodeEnabled = useServerTranscodeEnabled();
  const offlineReady = useOfflineReadyForItem(item);
  const wantWaveform = Boolean(
    waveformEnabled &&
      item &&
      (state.playingFromLocalFile || offlineReady),
  );

  const waveform = useWaveformPeaks(item, wantWaveform);
  const showWaveform = wantWaveform && waveform.status === "ready";

  const [scrub, setScrub] = useState<number | null>(null);
  const displayPos = scrub ?? state.positionSeconds;
  const duration =
    state.durationSeconds > 0
      ? state.durationSeconds
      : (item?.durationSeconds ?? 0);

  const waveformPeaks = waveform.status === "ready" ? waveform.peaks : [];

  const formatLabel = item
    ? formatPlaybackFormatLabel(item.suffix, serverTranscodeEnabled)
    : null;
  const formatBitrateCaption =
    item &&
    [formatLabel, item.bitRate != null ? String(item.bitRate) : null]
      .filter(Boolean)
      .join(" · ");

  useEffect(() => {
    if (!fullPlayerOpen) setScrub(null);
  }, [fullPlayerOpen]);

  const timeRow = (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        mt: showWaveform ? 0.25 : -0.5,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatClock(displayPos)}
      </Typography>

      {formatBitrateCaption ? (
        <Typography variant="caption" color="text.secondary">
          {formatBitrateCaption}
        </Typography>
      ) : null}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {duration > 0
          ? formatClock(duration)
          : item?.durationSeconds
            ? formatDuration(item.durationSeconds)
            : "—"}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 480, mt: 2 }}>
      {showWaveform ? (
        <WaveformScrubBar
          peaks={waveformPeaks}
          duration={duration}
          position={duration > 0 ? Math.min(displayPos, duration) : 0}
          isPlaying={state.isPlaying}
          disabled={!busy || duration <= 0}
          onScrubChange={setScrub}
          onScrubCommit={(next) => {
            setScrub(null);
            void seek(next);
          }}
          onScrubCancel={() => setScrub(null)}
        />
      ) : (
        <Slider
          size="small"
          disabled={!busy || duration <= 0}
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.5}
          value={duration > 0 ? Math.min(displayPos, duration) : 0}
          onChange={(_, v) => setScrub(Array.isArray(v) ? v[0]! : v)}
          onChangeCommitted={(_, v) => {
            const next = Array.isArray(v) ? v[0]! : v;
            setScrub(null);
            void seek(next);
          }}
          valueLabelDisplay="off"
        />
      )}
      {timeRow}
    </Box>
  );
}
