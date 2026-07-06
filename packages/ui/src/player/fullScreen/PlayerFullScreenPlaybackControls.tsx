import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Forward10 from "@mui/icons-material/Forward10";
import Pause from "@mui/icons-material/Pause";
import PlayArrow from "@mui/icons-material/PlayArrow";
import Replay10 from "@mui/icons-material/Replay10";
import SkipNext from "@mui/icons-material/SkipNext";
import SkipPrevious from "@mui/icons-material/SkipPrevious";
import { useT } from "@asmusic/i18n";
import {
  usePlayerActions,
  usePlayerTransportState,
} from "@ui/contexts/PlayerContext";

export function PlayerFullScreenPlaybackControls() {
  const t = useT();
  const state = usePlayerTransportState();
  const { togglePlayPause, seekBy, skipNext, skipPrevious } =
    usePlayerActions();
  const busy = Boolean(state.currentItem);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        mt: 2,
        flexWrap: "wrap",
      }}
    >
      <IconButton
        aria-label={t("player.action.rewind10")}
        disabled={!busy}
        onClick={() => void seekBy(-10)}
      >
        <Replay10 sx={{ fontSize: 32 }} />
      </IconButton>
      <IconButton
        aria-label={t("player.action.previous")}
        disabled={!busy}
        onClick={() => void skipPrevious()}
      >
        <SkipPrevious sx={{ fontSize: 44 }} />
      </IconButton>
      <IconButton
        aria-label={
          state.isPlaying ? t("player.action.pause") : t("player.action.play")
        }
        disabled={!busy}
        color="primary"
        sx={{ p: 1.5 }}
        onClick={() => void togglePlayPause()}
      >
        {state.isPlaying ? (
          <Pause sx={{ fontSize: 56 }} />
        ) : (
          <PlayArrow sx={{ fontSize: 56 }} />
        )}
      </IconButton>
      <IconButton
        aria-label={t("player.action.next")}
        disabled={!busy || !state.hasNext}
        onClick={() => void skipNext()}
      >
        <SkipNext sx={{ fontSize: 44 }} />
      </IconButton>
      <IconButton
        aria-label={t("player.action.forward10")}
        disabled={!busy}
        onClick={() => void seekBy(10)}
      >
        <Forward10 sx={{ fontSize: 32 }} />
      </IconButton>
    </Box>
  );
}
