import { Menu, MenuItem } from "@mui/material";
import type { useT } from "@asmusic/i18n";

export function SongItemQueueMenu({
  anchorEl,
  onClose,
  onPlayNext,
  onAppendToQueue,
  t,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  t: ReturnType<typeof useT>;
}) {
  if (!onPlayNext && !onAppendToQueue) {
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
    </Menu>
  );
}
