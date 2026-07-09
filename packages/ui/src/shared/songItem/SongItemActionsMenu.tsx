import { ListItemText, Menu, MenuItem } from "@mui/material";
import type { useT } from "@asmusic/i18n";

export function SongItemActionsMenu({
  anchorEl,
  onClose,
  onPlayNext,
  onAppendToQueue,
  onViewArtist,
  onViewAlbum,
  onDownload,
  onRemoveDownload,
  isStarred,
  onToggleStar,
  t,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  onViewArtist?: () => void;
  onViewAlbum?: () => void;
  onDownload?: () => void;
  onRemoveDownload?: () => void;
  isStarred?: boolean;
  onToggleStar?: () => void | Promise<void>;
  t: ReturnType<typeof useT>;
}) {
  if (
    !onPlayNext &&
    !onAppendToQueue &&
    !onViewArtist &&
    !onViewAlbum &&
    !onDownload &&
    !onRemoveDownload &&
    !onToggleStar
  ) {
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
      {onViewArtist ? (
        <MenuItem
          onClick={() => {
            onViewArtist();
            onClose();
          }}
        >
          {t("library.action.viewArtist")}
        </MenuItem>
      ) : null}
      {onViewAlbum ? (
        <MenuItem
          onClick={() => {
            onViewAlbum();
            onClose();
          }}
        >
          {t("library.action.viewAlbum")}
        </MenuItem>
      ) : null}
      {onToggleStar ? (
        <MenuItem
          onClick={() => {
            void Promise.resolve(onToggleStar());
            onClose();
          }}
        >
          {isStarred ? t("player.favorite.remove") : t("player.favorite.add")}
        </MenuItem>
      ) : null}
      {onDownload ? (
        <MenuItem
          onClick={() => {
            onDownload();
            onClose();
          }}
        >
          {t("library.action.download")}
        </MenuItem>
      ) : null}
      {onRemoveDownload ? (
        <MenuItem
          onClick={() => {
            onRemoveDownload();
            onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemText>{t("library.action.removeDownload")}</ListItemText>
        </MenuItem>
      ) : null}
    </Menu>
  );
}
