import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { useLongPress } from "./useLongPress";

const libraryLinkSx = {
  border: 0,
  p: 0,
  m: 0,
  background: "none",
  font: "inherit",
  cursor: "pointer",
  color: "text.secondary",
  textAlign: "center" as const,
  width: "100%",
  "&:hover": { textDecoration: "underline" },
};

const copyableTextSx = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

export type PlayerFullScreenTrackInfoSlotProps = {
  item: PlayerQueueItem;
  onCopyName: (text: string) => void;
  onOpenAlbum: (item: PlayerQueueItem) => void;
  onOpenArtist: (item: PlayerQueueItem) => void;
  /** Let horizontal belt gestures receive pointer moves before long-press capture. */
  beltGesturePassthrough?: boolean;
};

export function PlayerFullScreenTrackInfoSlot({
  item,
  onCopyName,
  onOpenAlbum,
  onOpenArtist,
  beltGesturePassthrough = false,
}: PlayerFullScreenTrackInfoSlotProps) {
  const longPressCapture = !beltGesturePassthrough;
  const t = useT();
  const emDash = t("common.emDash");
  const albumLabel = item.album?.trim() || emDash;
  const artistLabel = item.artist?.trim() || emDash;
  const canOpenAlbum = Boolean(item.album?.trim());
  const canOpenArtist = Boolean(item.artist?.trim());

  const titleLongPress = useLongPress({
    disabled: !item.title?.trim(),
    capturePointer: longPressCapture,
    onLongPress: () => {
      if (item.title) onCopyName(item.title);
    },
  });

  const albumLongPress = useLongPress({
    disabled: !item.album?.trim(),
    capturePointer: longPressCapture,
    onLongPress: () => {
      if (item.album) onCopyName(item.album);
    },
  });

  const artistLongPress = useLongPress({
    disabled: !item.artist?.trim(),
    capturePointer: longPressCapture,
    onLongPress: () => {
      if (item.artist) onCopyName(item.artist);
    },
  });

  return (
    <>
      <Typography
        variant="h6"
        component="h2"
        align="center"
        sx={{ fontWeight: 700, px: 1, width: "100%", ...copyableTextSx }}
        {...titleLongPress.longPressPointerProps}
      >
        {item.title}
      </Typography>
      {canOpenAlbum ? (
        <Typography
          variant="body2"
          component="button"
          type="button"
          aria-label={t("player.action.openAlbum", { name: albumLabel })}
          onClick={() => {
            if (albumLongPress.consumeLongPress()) return;
            onOpenAlbum(item);
          }}
          sx={{ ...libraryLinkSx, ...copyableTextSx, mt: 0.5 }}
          {...albumLongPress.longPressPointerProps}
        >
          {albumLabel}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 0.5, ...copyableTextSx }}
          {...albumLongPress.longPressPointerProps}
        >
          {albumLabel}
        </Typography>
      )}
      {canOpenArtist ? (
        <Typography
          variant="body2"
          component="button"
          type="button"
          aria-label={t("player.action.openArtist", { name: artistLabel })}
          onClick={() => {
            if (artistLongPress.consumeLongPress()) return;
            onOpenArtist(item);
          }}
          sx={{ ...libraryLinkSx, ...copyableTextSx }}
          {...artistLongPress.longPressPointerProps}
        >
          {artistLabel}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={copyableTextSx}
          {...artistLongPress.longPressPointerProps}
        >
          {artistLabel}
        </Typography>
      )}
    </>
  );
}
