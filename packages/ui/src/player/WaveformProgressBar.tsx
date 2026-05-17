import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";

export const WAVEFORM_PLACEHOLDER_PEAKS = Array.from(
  { length: 96 },
  (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.42)),
);

export type WaveformProgressBarProps = {
  peaks: number[];
  /** Played portion of the track, 0–1. */
  playedFraction: number;
  isPlaying: boolean;
  variant?: "default" | "miniBar";
  sx?: SxProps<Theme>;
};

export function WaveformProgressBar({
  peaks,
  playedFraction,
  isPlaying,
  variant = "default",
  sx,
}: WaveformProgressBarProps) {
  const theme = useTheme();
  const isMiniBar = variant === "miniBar";
  const playedColor = isMiniBar
    ? alpha(theme.palette.text.primary, 0.2)
    : theme.palette.primary.main;
  const unplayedColor = alpha(
    theme.palette.text.primary,
    isMiniBar ? 0.1 : 0.2,
  );
  const fraction = Math.min(1, Math.max(0, playedFraction));

  return (
    <Box
      aria-hidden
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "1px",
        width: "100%",
        height: "100%",
        px: 0.25,
        opacity: isPlaying ? 1 : 0.5,
        ...sx,
      }}
    >
      {peaks.map((peak, i) => {
        const barCenter = (i + 0.5) / peaks.length;
        const played = barCenter <= fraction;
        const heightPct = 18 + peak * 74;
        return (
          <Box
            key={i}
            sx={{
              flex: 1,
              minWidth: 2,
              maxWidth: 6,
              height: `${heightPct}%`,
              borderRadius: 1,
              bgcolor: played ? playedColor : unplayedColor,
            }}
          />
        );
      })}
    </Box>
  );
}
