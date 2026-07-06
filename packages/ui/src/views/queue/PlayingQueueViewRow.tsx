import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MoreVert from "@mui/icons-material/MoreVert";
import { useT } from "@asmusic/i18n";
import type { PlayerQueueItem } from "@ui/player/core/types";

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
    <ListItem divider disablePadding sx={{ alignItems: "center" }}>
      <ListItemButton
        selected={selected}
        onClick={onPlay}
        sx={{
          flex: 1,
          minWidth: 0,
          py: 1,
          alignItems: "flex-start",
        }}
      >
        <ListItemText
          primary={item.title}
          secondary={item.artist ?? "—"}
          sx={{ flex: 1, minWidth: 0, my: 0 }}
          slotProps={{
            primary: { variant: "body2", noWrap: true },
            secondary: { variant: "caption", noWrap: true },
          }}
        />
      </ListItemButton>
      <Box sx={{ display: "flex", flexShrink: 0, alignSelf: "center", pr: 0.5 }}>
        <IconButton
          aria-label={t("queue.action.rowActions")}
          size="small"
          edge="end"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenMenu(e.currentTarget);
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>
    </ListItem>
  );
}
