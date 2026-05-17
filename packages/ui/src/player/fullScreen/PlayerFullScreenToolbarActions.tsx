import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import PlaylistAddOutlined from "@mui/icons-material/PlaylistAddOutlined";
import Star from "@mui/icons-material/Star";
import StarBorder from "@mui/icons-material/StarBorder";
import { useT } from "@asmusic/i18n";
import type { PlayerFullScreenTrackActions } from "./usePlayerFullScreenTrackActions";

export type PlayerFullScreenToolbarActionsProps = {
  actions: PlayerFullScreenTrackActions;
  onTrackInfo: () => void;
};

export function PlayerFullScreenToolbarActions({
  actions,
  onTrackInfo,
}: PlayerFullScreenToolbarActionsProps) {
  const t = useT();
  const {
    isStarred,
    starBusy,
    toggleStarred,
    addToPlaylistBusy,
    canAddToPlaylist,
    playlistsForCurrentTrack,
    setAddToPlaylistOpen,
    clearAddToPlaylistError,
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
            disabled={starBusy}
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
      <IconButton
        color="inherit"
        onClick={onTrackInfo}
        aria-label={t("player.action.trackInfo")}
      >
        <InfoOutlined />
      </IconButton>
    </>
  );
}
