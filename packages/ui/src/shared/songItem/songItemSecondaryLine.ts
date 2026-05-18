import type { Child } from "subsonic-api";
import { formatDuration } from "@asmusic/core";

export function songItemSecondaryLine(
  track: Child,
  includeAlbumInSecondary: boolean,
): string {
  const durationSuffix =
    track.duration != null && track.duration > 0
      ? ` · ${formatDuration(track.duration)}`
      : "";

  if (includeAlbumInSecondary) {
    const meta =
      [track.artist, track.album].filter(Boolean).join(" · ") || "—";
    return `${meta}${durationSuffix}`;
  }

  return `${track.artist ?? "—"}${durationSuffix}`;
}
