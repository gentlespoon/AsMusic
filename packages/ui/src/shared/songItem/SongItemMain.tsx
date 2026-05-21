import type { SongItemMainProps } from "./types";
import { SongItemCover } from "./SongItemCover";
import { SongItemText } from "./SongItemText";

export function SongItemMain({
  track,
  secondary,
  noWrapSecondary,
  api,
  coverArtId,
  resolveCachedArtwork,
  artworkCacheBump,
}: SongItemMainProps) {
  return (
    <>
      <SongItemCover
        api={api}
        coverArtId={coverArtId}
        resolveCachedArtwork={resolveCachedArtwork}
        artworkCacheBump={artworkCacheBump}
      />
      <SongItemText
        title={track.title ?? "—"}
        secondary={secondary}
        noWrapSecondary={noWrapSecondary}
      />
    </>
  );
}
