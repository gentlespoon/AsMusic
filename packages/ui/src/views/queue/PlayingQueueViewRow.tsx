import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MoreVert from "@mui/icons-material/MoreVert";
import { useT } from "@asmusic/i18n";
import type { PlayerQueueItem } from "../../player/core/types";

export type PlayingQueueViewRowProps = {
  item: PlayerQueueItem;
  selected: boolean;
  onPlay: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
};

export function PlayingQueueViewRow({
  item,
  selected,
  onPlay,
  onOpenMenu,
}: PlayingQueueViewRowProps) {
  const t = useT();

  return (
    <ListItemButton
      divider
      selected={selected}
      onClick={onPlay}
      sx={{
        py: 1,
        alignItems: "flex-start",
        pr: 5,
        position: "relative",
      }}
    >
      <ListItemText
        primary={item.title}
        secondary={item.artist ?? "—"}
        slotProps={{
          primary: { variant: "body2", noWrap: true },
          secondary: { variant: "caption", noWrap: true },
        }}
      />
      <IconButton
        aria-label={t("queue.action.rowActions")}
        size="small"
        edge="end"
        sx={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu(e.currentTarget);
        }}
      >
        <MoreVert fontSize="small" />
      </IconButton>
    </ListItemButton>
  );
}
