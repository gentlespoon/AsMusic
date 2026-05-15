import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import type { PlayerQueueItem } from "../core/types";

export type PlayerMiniBarTrackInfoProps = {
  item: PlayerQueueItem | null;
};

export function PlayerMiniBarTrackInfo({ item }: PlayerMiniBarTrackInfoProps) {
  const t = useT();

  return (
    <>
      <Typography
        variant="body2"
        noWrap
        sx={{ fontWeight: 600, lineHeight: 1.2 }}
      >
        {item?.title ?? t("player.empty.title")}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: "block", lineHeight: 1.2 }}
      >
        {item
          ? [item.artist, item.album].filter(Boolean).join(" · ") ||
            t("common.emDash")
          : t("player.empty.pickSong")}
      </Typography>
    </>
  );
}
