import IconButton from "@mui/material/IconButton";
import Pause from "@mui/icons-material/Pause";
import PlayArrow from "@mui/icons-material/PlayArrow";
import SkipNext from "@mui/icons-material/SkipNext";
import SkipPrevious from "@mui/icons-material/SkipPrevious";
import { useT } from "@asmusic/i18n";
import {
  usePlayerActions,
  usePlayerTransportState,
} from "../../contexts/PlayerContext";

export function PlayerMiniBarTransportButtons() {
  const t = useT();
  const state = usePlayerTransportState();
  const { togglePlayPause, skipNext, skipPrevious } = usePlayerActions();
  const busy = Boolean(state.currentItem);

  return (
    <>
      <IconButton
        aria-label={t("player.action.previous")}
        size="small"
        onClick={() => void skipPrevious()}
        disabled={!busy}
        sx={{ flexShrink: 0 }}
      >
        <SkipPrevious fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={
          state.isPlaying
            ? t("player.action.pause")
            : t("player.action.play")
        }
        size="medium"
        onClick={() => void togglePlayPause()}
        disabled={!busy}
        color="primary"
        sx={{ flexShrink: 0 }}
      >
        {state.isPlaying ? <Pause /> : <PlayArrow />}
      </IconButton>
      <IconButton
        aria-label={t("player.action.next")}
        size="small"
        onClick={() => void skipNext()}
        disabled={!busy || !state.hasNext}
        sx={{ flexShrink: 0 }}
      >
        <SkipNext fontSize="small" />
      </IconButton>
    </>
  );
}
