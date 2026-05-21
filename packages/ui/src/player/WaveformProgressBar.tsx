import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import { useSmoothPlayedFraction } from "./useSmoothPlayedFraction";

export const WAVEFORM_PLACEHOLDER_PEAKS = Array.from(
  { length: 96 },
  (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.42)),
);

export type WaveformProgressBarProps = {
  peaks: number[];
  /** Played portion of the track, 0–1. */
  playedFraction: number;
  isPlaying: boolean;
  /** Track length; enables frame-by-frame extrapolation between transport ticks. */
  durationSeconds?: number;
  /** When false, follows playedFraction immediately (e.g. while scrubbing). */
  smoothProgress?: boolean;
  variant?: "default" | "miniBar";
  sx?: SxProps<Theme>;
};

const rootSx = {
  position: "relative",
  width: "100%",
  height: "100%",
} satisfies SxProps<Theme>;

const barsRowSx = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: "100%",
  px: 0.25,
} satisfies SxProps<Theme>;

const playedOverlaySx = (clipRightPct: number): SxProps<Theme> => ({
  ...barsRowSx,
  position: "absolute",
  inset: 0,
  clipPath: `inset(0 ${clipRightPct}% 0 0)`,
  willChange: "clip-path",
});

function barSx(color: string, heightPct: number): SxProps<Theme> {
  return {
    flex: 1,
    height: `${heightPct}%`,
    borderRadius: 1,
    bgcolor: color,
  };
}

function WaveformBars({ peaks, color }: { peaks: number[]; color: string }) {
  return (
    <>
      {peaks.map((peak, i) => (
        <Box key={i} sx={barSx(color, 10 + peak * 90)} />
      ))}
    </>
  );
}

export function WaveformProgressBar({
  peaks,
  playedFraction,
  isPlaying,
  durationSeconds,
  smoothProgress = true,
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
  const fraction = useSmoothPlayedFraction(
    Math.min(1, Math.max(0, playedFraction)),
    { isPlaying, smooth: smoothProgress, durationSeconds },
  );

  return (
    <Box
      aria-hidden
      sx={[
        rootSx,
        { opacity: isPlaying ? 1 : 0.5 },
        ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ]}
    >
      <Box sx={barsRowSx}>
        <WaveformBars peaks={peaks} color={unplayedColor} />
      </Box>
      <Box sx={playedOverlaySx((1 - fraction) * 100)}>
        <WaveformBars peaks={peaks} color={playedColor} />
      </Box>
    </Box>
  );
}
