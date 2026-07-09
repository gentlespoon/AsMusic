import type { MouseEvent } from "react";
import { Box, IconButton } from "@mui/material";
import MoreVert from "@mui/icons-material/MoreVert";
import type { useT } from "@asmusic/i18n";

export function SongItemActions({
  onOpenOverflowMenu,
  stopRowClick,
  t,
}: {
  onOpenOverflowMenu: (e: MouseEvent<HTMLElement>) => void;
  stopRowClick: (e: MouseEvent<HTMLElement>) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        alignSelf: "center",
        pr: 0.5,
      }}
    >
      <IconButton
        edge="end"
        size="small"
        aria-label={t("player.action.songActions")}
        onClick={(e) => {
          stopRowClick(e);
          onOpenOverflowMenu(e);
        }}
      >
        <MoreVert fontSize="small" />
      </IconButton>
    </Box>
  );
}
