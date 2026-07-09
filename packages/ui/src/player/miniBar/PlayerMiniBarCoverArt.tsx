import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import { CoverArtThumb } from "@ui/shared/CoverArtThumb";
import { CoverArtPlaceholder } from "@ui/shared/CoverArtPlaceholder";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { usePlayerCoverArt } from "@ui/player/shared/usePlayerCoverArt";

const COVER_SIZE = 40;

export type PlayerMiniBarCoverArtProps = {
  item: PlayerQueueItem | null;
  api: SubsonicAPI | null;
};

export function PlayerMiniBarCoverArt({ item, api }: PlayerMiniBarCoverArtProps) {
  const cover = usePlayerCoverArt(item, api);

  return (
    <Box
      sx={{
        width: COVER_SIZE,
        height: COVER_SIZE,
        borderRadius: 1,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {cover.coverArtId && cover.sources ? (
        <CoverArtThumb
          key={item?.rowId}
          api={api ?? undefined}
          sources={cover.sources}
          coverArtId={cover.coverArtId}
          fallbackCoverArtId={cover.fallbackCoverArtId}
          artworkCacheKey={cover.artworkCacheKey}
          artworkCacheBump={cover.artworkCacheBump}
          loadImmediately
          size={COVER_SIZE}
          label=""
          sx={{ width: COVER_SIZE, height: COVER_SIZE }}
        />
      ) : (
        <CoverArtPlaceholder sx={{ width: COVER_SIZE, height: COVER_SIZE }} />
      )}
    </Box>
  );
}
