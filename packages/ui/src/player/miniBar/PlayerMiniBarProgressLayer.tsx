import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { WaveformProgressBar } from "@ui/player/WaveformProgressBar";

export type PlayerMiniBarProgressLayerProps = {
  busy: boolean;
  useWaveform: boolean;
  waveformPeaks: number[];
  playedFraction: number;
  durationSeconds?: number;
  isPlaying: boolean;
  progressPercent: number;
};

export function PlayerMiniBarProgressLayer({
  busy,
  useWaveform,
  waveformPeaks,
  playedFraction,
  durationSeconds,
  isPlaying,
  progressPercent,
}: PlayerMiniBarProgressLayerProps) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {busy ? (
        useWaveform ? (
          <WaveformProgressBar
            variant="miniBar"
            peaks={waveformPeaks}
            playedFraction={playedFraction}
            durationSeconds={durationSeconds}
            isPlaying={isPlaying}
            sx={{
              position: "absolute",
              inset: 0,
              px: 0,
            }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progressPercent}%`,
              bgcolor: (theme) => alpha(theme.palette.text.primary, 0.1),
              opacity: isPlaying ? 1 : 0.5,
            }}
          />
        )
      ) : null}
    </Box>
  );
}
