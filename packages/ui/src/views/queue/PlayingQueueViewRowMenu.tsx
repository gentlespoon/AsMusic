import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useT } from "@asmusic/i18n";

export type PlayingQueueViewRowMenuAnchor = {
  el: HTMLElement;
  index: number;
};

export type PlayingQueueViewRowMenuProps = {
  anchor: PlayingQueueViewRowMenuAnchor | null;
  onClose: () => void;
  onPlayNext: (index: number) => void;
  onAddToQueue: (index: number) => void;
  onRemove: (index: number) => void;
};

export function PlayingQueueViewRowMenu({
  anchor,
  onClose,
  onPlayNext,
  onAddToQueue,
  onRemove,
}: PlayingQueueViewRowMenuProps) {
  const t = useT();

  return (
    <Menu anchorEl={anchor?.el} open={Boolean(anchor)} onClose={onClose}>
      <MenuItem
        onClick={() => {
          if (anchor) onPlayNext(anchor.index);
          onClose();
        }}
      >
        {t("player.action.playNext")}
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (anchor) onAddToQueue(anchor.index);
          onClose();
        }}
      >
        {t("player.action.addToQueue")}
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (anchor) void onRemove(anchor.index);
          onClose();
        }}
      >
        {t("player.action.removeFromQueue")}
      </MenuItem>
    </Menu>
  );
}
