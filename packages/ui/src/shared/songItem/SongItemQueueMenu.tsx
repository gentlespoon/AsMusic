import { ListItemText, Menu, MenuItem } from "@mui/material";
import type { useT } from "@asmusic/i18n";

export function SongItemQueueMenu({
  anchorEl,
  onClose,
  onPlayNext,
  onAppendToQueue,
  onRemove,
  t,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  onRemove?: () => void;
  t: ReturnType<typeof useT>;
}) {
  if (!onPlayNext && !onAppendToQueue && !onRemove) {
    return null;
  }

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {onPlayNext ? (
        <MenuItem
          onClick={() => {
            onPlayNext();
            onClose();
          }}
        >
          {t("player.action.playNext")}
        </MenuItem>
      ) : null}
      {onAppendToQueue ? (
        <MenuItem
          onClick={() => {
            onAppendToQueue();
            onClose();
          }}
        >
          {t("player.action.addToQueue")}
        </MenuItem>
      ) : null}
      {onRemove ? (
        <MenuItem
          onClick={() => {
            onRemove();
            onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemText>{t("player.offline.removeDownload")}</ListItemText>
        </MenuItem>
      ) : null}
    </Menu>
  );
}
