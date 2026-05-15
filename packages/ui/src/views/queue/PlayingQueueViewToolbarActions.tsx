import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Delete from "@mui/icons-material/Delete";
import Repeat from "@mui/icons-material/Repeat";
import RepeatOne from "@mui/icons-material/RepeatOne";
import Shuffle from "@mui/icons-material/Shuffle";
import { useT } from "@asmusic/i18n";
import Box from "@mui/material/Box";

export type PlayingQueueViewToolbarActionsProps = {
  queueLength: number;
  loopQueue: boolean;
  loopOne: boolean;
  onShuffle: () => void;
  onToggleLoopQueue: () => void;
  onToggleLoopOne: () => void;
  onClearClick: () => void;
};

export function PlayingQueueViewToolbarActions({
  queueLength,
  loopQueue,
  loopOne,
  onShuffle,
  onToggleLoopQueue,
  onToggleLoopOne,
  onClearClick,
}: PlayingQueueViewToolbarActionsProps) {
  const t = useT();

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        px: 1,
        py: 0.75,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
      }}
    >
      <ToggleButtonGroup exclusive sx={{ gap: 1.5 }}>
        <Tooltip title={t("queue.action.shuffle")}>
          <IconButton
            aria-label={t("queue.action.shuffle")}
            size="small"
            disabled={queueLength <= 1}
            onClick={onShuffle}
          >
            <Shuffle fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("queue.action.loopQueue")}>
          <IconButton
            aria-label={t("queue.action.loopQueue")}
            size="small"
            color={loopQueue ? "primary" : "default"}
            onClick={onToggleLoopQueue}
          >
            <Repeat fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("queue.action.loopCurrent")}>
          <IconButton
            aria-label={t("queue.action.loopCurrent")}
            size="small"
            color={loopOne ? "primary" : "default"}
            onClick={onToggleLoopOne}
          >
            <RepeatOne fontSize="small" />
          </IconButton>
        </Tooltip>
      </ToggleButtonGroup>
      <Box sx={{ width: 28 }} />
      <Tooltip title={t("queue.action.clearUpcoming")}>
        <IconButton
          aria-label={t("queue.action.clearExceptCurrent")}
          size="small"
          color="error"
          disabled={queueLength <= 1}
          onClick={onClearClick}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
