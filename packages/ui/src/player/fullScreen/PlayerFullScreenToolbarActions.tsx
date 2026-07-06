import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import PlaylistAddOutlined from "@mui/icons-material/PlaylistAddOutlined";
import Star from "@mui/icons-material/Star";
import StarBorder from "@mui/icons-material/StarBorder";
import { useT } from "@asmusic/i18n";
import type { PlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";
import Refresh from "@mui/icons-material/Refresh";

export type PlayerFullScreenToolbarActionsProps = {
  actions: PlayerFullScreenTrackActions;
  onTrackInfo: () => void;
};

export function PlayerFullScreenToolbarActions({
  actions,
  onTrackInfo,
}: PlayerFullScreenToolbarActionsProps) {
  const t = useT();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const {
    isStarred,
    toggleStarred,
    addToPlaylistBusy,
    canAddToPlaylist,
    playlistsForCurrentTrack,
    setAddToPlaylistOpen,
    clearAddToPlaylistError,
    canRefreshCoverArt,
    refreshCoverArtBusy,
    refreshCoverArt,
  } = actions;

  return (
    <>
      <Tooltip
        title={
          isStarred ? t("player.favorite.remove") : t("player.favorite.add")
        }
      >
        <span>
          <IconButton
            color="inherit"
            aria-label={
              isStarred ? t("player.favorite.remove") : t("player.favorite.add")
            }
            aria-pressed={isStarred}
            onClick={toggleStarred}
          >
            {isStarred ? <Star /> : <StarBorder />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={
          !canAddToPlaylist
            ? t("library.playlist.editDisabledMulti")
            : t("player.action.addToPlaylist")
        }
      >
        <span>
          <IconButton
            color="inherit"
            aria-label={t("player.action.addToPlaylist")}
            disabled={
              addToPlaylistBusy ||
              !canAddToPlaylist ||
              playlistsForCurrentTrack.length === 0
            }
            onClick={() => {
              clearAddToPlaylistError();
              setAddToPlaylistOpen(true);
            }}
          >
            <PlaylistAddOutlined />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={t("player.action.moreActions")}>
        <span>
          <IconButton
            color="inherit"
            aria-label={t("player.action.moreActions")}
            aria-haspopup="true"
            aria-expanded={Boolean(menuAnchor)}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVert />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={onTrackInfo} sx={{ gap: 1 }}>
          <InfoOutlined />
          <ListItemText>{t("player.action.trackInfo")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!canRefreshCoverArt || refreshCoverArtBusy}
          onClick={() => {
            setMenuAnchor(null);
            refreshCoverArt();
          }}
          sx={{ gap: 1 }}
        >
          <Refresh />
          <ListItemText>{t("player.action.refreshCoverArt")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
