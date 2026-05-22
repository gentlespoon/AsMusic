import type { MouseEvent } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import MoreVert from "@mui/icons-material/MoreVert";
import Star from "@mui/icons-material/Star";
import StarBorder from "@mui/icons-material/StarBorder";
import type { useT } from "@asmusic/i18n";

export function SongItemActions({
  showStar,
  isStarred,
  starBusy,
  onStarClick,
  showDelete,
  showQueueMenu,
  onOpenQueueMenu,
  stopRowClick,
  t,
}: {
  showStar: boolean;
  isStarred?: boolean;
  starBusy: boolean;
  onStarClick: () => void;
  showDelete: boolean;
  showQueueMenu: boolean;
  onOpenQueueMenu: (e: MouseEvent<HTMLElement>) => void;
  stopRowClick: (e: MouseEvent<HTMLElement>) => void;
  t: ReturnType<typeof useT>;
}) {
  const showActionsMenu = showQueueMenu || showDelete;

  if (!showStar && !showActionsMenu) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        gap: 0.25,
        alignSelf: "center",
        pr: 0.5,
      }}
    >
      {showStar ? (
        <Tooltip
          title={
            isStarred ? t("player.favorite.remove") : t("player.favorite.add")
          }
        >
          <span>
            <IconButton
              edge="end"
              size="small"
              aria-label={
                isStarred
                  ? t("player.favorite.remove")
                  : t("player.favorite.add")
              }
              aria-pressed={isStarred}
              disabled={starBusy}
              onClick={(e) => {
                stopRowClick(e);
                onStarClick();
              }}
            >
              {isStarred ? (
                <Star fontSize="small" color="warning" />
              ) : (
                <StarBorder fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      {showActionsMenu ? (
        <IconButton
          edge="end"
          size="small"
          aria-label={t("player.action.songActions")}
          onClick={(e) => {
            stopRowClick(e);
            onOpenQueueMenu(e);
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
}
