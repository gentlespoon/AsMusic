import IconButton from "@mui/material/IconButton";
import QueueMusic from "@mui/icons-material/QueueMusic";
import { useT } from "@asmusic/i18n";
import { useMatch, useNavigate } from "react-router-dom";
import {
  usePlayerActions,
  usePlayerShell,
} from "@ui/contexts/PlayerContext";
import { PLAYING_QUEUE_PATH } from "@ui/views/queue/PlayingQueueView";

export function PlayerMiniBarQueueButton() {
  const t = useT();
  const navigate = useNavigate();
  const { fullPlayerOpen } = usePlayerShell();
  const { closeFullPlayer } = usePlayerActions();
  const onQueueRoute = Boolean(
    useMatch({ path: PLAYING_QUEUE_PATH, end: true }),
  );

  const queueLabel = onQueueRoute
    ? t("player.action.openQueueCurrent")
    : t("player.action.openQueue");

  return (
    <IconButton
      aria-label={queueLabel}
      aria-pressed={onQueueRoute}
      size="small"
      color={onQueueRoute ? "primary" : "default"}
      onClick={() => {
        if (onQueueRoute) {
          navigate(-1);
          return;
        }
        if (fullPlayerOpen) {
          closeFullPlayer();
        }
        navigate(PLAYING_QUEUE_PATH);
      }}
      sx={{ flexShrink: 0 }}
    >
      <QueueMusic fontSize="small" />
    </IconButton>
  );
}
