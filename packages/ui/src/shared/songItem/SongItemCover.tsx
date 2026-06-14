import type { LibraryArtworkCacheRow, SubsonicAPI } from "@asmusic/core";
import { Box, ListItemAvatar } from "@mui/material";
import { CoverArtThumb } from "../CoverArtThumb";
import type { PersistCachedArtwork } from "../libraryArtworkCacheAccess";
import { COVER_SIZE } from "./constants";

export function SongItemCover({
  api,
  coverArtId,
  resolveCachedArtwork,
  persistCachedArtwork,
  artworkCacheBump,
  artworkCacheKey,
}: {
  api: SubsonicAPI | null;
  coverArtId?: string;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkCacheBump: number;
  artworkCacheKey?: string;
}) {
  const coverSx = {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 1,
    overflow: "hidden",
  } as const;

  return (
    <ListItemAvatar sx={{ minWidth: 48 }}>
      {coverArtId ? (
        <CoverArtThumb
          api={api ?? undefined}
          coverArtId={coverArtId}
          resolveCachedArtwork={resolveCachedArtwork}
          persistCachedArtwork={persistCachedArtwork}
          artworkCacheBump={artworkCacheBump}
          artworkCacheKey={artworkCacheKey}
          size={48}
          label=""
          sx={coverSx}
        />
      ) : (
        <Box sx={{ ...coverSx, bgcolor: "action.hover" }} aria-hidden />
      )}
    </ListItemAvatar>
  );
}
