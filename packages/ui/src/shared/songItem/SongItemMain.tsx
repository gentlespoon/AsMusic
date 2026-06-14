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
  persistCachedArtwork,
  artworkCacheBump,
  artworkCacheKey,
}: SongItemMainProps) {
  return (
    <>
      <SongItemCover
        api={api}
        coverArtId={coverArtId}
        resolveCachedArtwork={resolveCachedArtwork}
        persistCachedArtwork={persistCachedArtwork}
        artworkCacheBump={artworkCacheBump}
        artworkCacheKey={artworkCacheKey}
      />
      <SongItemText
        title={track.title ?? "—"}
        secondary={secondary}
        noWrapSecondary={noWrapSecondary}
      />
    </>
  );
}
