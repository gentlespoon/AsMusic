import type { LibraryArtworkCacheRow, SubsonicAPI } from "@asmusic/core";
import { ListItemAvatar } from "@mui/material";
import { CoverArtThumb } from "@ui/shared/CoverArtThumb";
import { CoverArtPlaceholder } from "@ui/shared/CoverArtPlaceholder";
import type { PersistCachedArtwork } from "@ui/shared/libraryArtworkCacheAccess";
import { COVER_SIZE } from "./constants";

export function SongItemCover({
  api,
  coverArtId,
  fallbackCoverArtId,
  resolveCachedArtwork,
  resolveArtworkLocalFile,
  persistCachedArtwork,
  artworkCacheBump,
  artworkCacheKey,
}: {
  api: SubsonicAPI | null;
  coverArtId?: string;
  fallbackCoverArtId?: string;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
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
          fallbackCoverArtId={fallbackCoverArtId}
          resolveCachedArtwork={resolveCachedArtwork}
          resolveArtworkLocalFile={resolveArtworkLocalFile}
          persistCachedArtwork={persistCachedArtwork}
          artworkCacheBump={artworkCacheBump}
          artworkCacheKey={artworkCacheKey}
          size={48}
          label=""
          sx={coverSx}
        />
      ) : (
        <CoverArtPlaceholder sx={coverSx} />
      )}
    </ListItemAvatar>
  );
}
