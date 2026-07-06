import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { PlayerFullScreenToolbarActions } from "./PlayerFullScreenToolbarActions";
import type { PlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";

export type PlayerFullScreenAppBarProps = {
  onClose: () => void;
  item: PlayerQueueItem | null;
  actions: PlayerFullScreenTrackActions;
  onTrackInfo: () => void;
};

export function PlayerFullScreenAppBar({
  onClose,
  item,
  actions,
  onTrackInfo,
}: PlayerFullScreenAppBarProps) {
  return (
    <AppBar position="sticky">
      <Toolbar variant="dense" sx={{ gap: 0.5 }}>
        <PageCloseButton edge="start" onClick={onClose} />
        <Box sx={{ flexGrow: 1 }} />
        {item ? (
          <PlayerFullScreenToolbarActions
            actions={actions}
            onTrackInfo={onTrackInfo}
          />
        ) : null}
      </Toolbar>
    </AppBar>
  );
}
