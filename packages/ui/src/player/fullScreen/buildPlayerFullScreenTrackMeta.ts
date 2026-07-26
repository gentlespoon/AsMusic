import { formatDuration } from "@asmusic/core";
import type { I18nContextValue } from "@asmusic/i18n";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { formatPlaybackFormatLabel } from "@ui/player/formatPlaybackFormatLabel";

export type PlayerFullScreenTrackMetaRow = {
  label: string;
  value: string;
};

export function buildPlayerFullScreenTrackMeta(
  item: PlayerQueueItem | null,
  t: I18nContextValue["t"],
  serverTranscodeEnabled: boolean,
): PlayerFullScreenTrackMetaRow[] {
  if (!item) return [];

  const emDash = t("common.emDash");
  const formatLabel =
    formatPlaybackFormatLabel(item.suffix, serverTranscodeEnabled) ?? emDash;
  return [
    { label: t("player.meta.title"), value: item.title },
    { label: t("player.meta.artist"), value: item.artist ?? emDash },
    { label: t("player.meta.album"), value: item.album ?? emDash },
    {
      label: t("player.meta.format"),
      value: formatLabel,
    },
    {
      label: t("player.meta.bitrate"),
      value: item.bitRate != null ? String(item.bitRate) : emDash,
    },
    {
      label: t("player.meta.duration"),
      value:
        item.durationSeconds != null
          ? formatDuration(item.durationSeconds)
          : emDash,
    },
    { label: t("player.meta.trackId"), value: item.trackId },
  ];
}
