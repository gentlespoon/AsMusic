import { useT } from "@asmusic/i18n";
import { useCallback, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { WaveformProgressBar } from "@ui/player/WaveformProgressBar";

type WaveformScrubBarProps = {
  peaks: number[];
  duration: number;
  position: number;
  isPlaying: boolean;
  disabled?: boolean;
  onScrubChange: (seconds: number) => void;
  onScrubCommit: (seconds: number) => void;
  onScrubCancel?: () => void;
};

function positionFromClientX(
  clientX: number,
  rect: DOMRect,
  duration: number,
): number {
  if (duration <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return ratio * duration;
}

export function WaveformScrubBar({
  peaks,
  duration,
  position,
  isPlaying,
  disabled = false,
  onScrubChange,
  onScrubCommit,
  onScrubCancel,
}: WaveformScrubBarProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);

  const playedFraction =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = rootRef.current;
      if (!el || duration <= 0) return 0;
      return positionFromClientX(clientX, el.getBoundingClientRect(), duration);
    },
    [duration],
  );

  const pointerProps = disabled
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.button !== 0 || duration <= 0) return;
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          scrubbingRef.current = true;
          setScrubbing(true);
          onScrubChange(seekFromEvent(e.clientX));
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (!scrubbingRef.current || duration <= 0) return;
          onScrubChange(seekFromEvent(e.clientX));
        },
        onPointerUp: (e: React.PointerEvent) => {
          if (!scrubbingRef.current) return;
          scrubbingRef.current = false;
          setScrubbing(false);
          const next = seekFromEvent(e.clientX);
          onScrubCommit(next);
        },
        onPointerCancel: () => {
          if (!scrubbingRef.current) return;
          scrubbingRef.current = false;
          setScrubbing(false);
          onScrubCancel?.();
        },
      };

  return (
    <Box
      ref={rootRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration > 0 ? duration : 0}
      aria-valuenow={duration > 0 ? position : 0}
      aria-disabled={disabled || duration <= 0}
      aria-label={t("player.action.position")}
      sx={{
        width: "100%",
        height: 36,
        touchAction: "none",
        cursor: disabled || duration <= 0 ? "default" : "pointer",
        userSelect: "none",
      }}
      {...pointerProps}
    >
      <WaveformProgressBar
        peaks={peaks}
        playedFraction={playedFraction}
        isPlaying={isPlaying}
        durationSeconds={duration > 0 ? duration : undefined}
        smoothProgress={!scrubbing}
      />
    </Box>
  );
}
