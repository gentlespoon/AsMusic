import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import QueueMusic from "@mui/icons-material/QueueMusic";
import { useT } from "@asmusic/i18n";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import { PlayingQueueViewToolbarActions } from "./PlayingQueueViewToolbarActions";
import type { PlayingQueueViewToolbarActionsProps } from "./PlayingQueueViewToolbarActions";

export type PlayingQueueViewAppBarProps = {
  onBack: () => void;
  toolbar: PlayingQueueViewToolbarActionsProps;
};

export function PlayingQueueViewAppBar({
  onBack,
  toolbar,
}: PlayingQueueViewAppBarProps) {
  const t = useT();

  return (
    <AppBar position="sticky">
      <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
        <PageCloseButton edge="start" onClick={onBack} />
        <QueueMusic
          color="action"
          fontSize="small"
          sx={{ display: { xs: "none", sm: "block" } }}
        />
        <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
          {t("queue.title")}
        </Typography>
        <PlayingQueueViewToolbarActions {...toolbar} />
      </Toolbar>
    </AppBar>
  );
}
