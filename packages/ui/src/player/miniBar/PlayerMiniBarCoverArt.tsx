import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import { CoverArtThumb } from "../../shared/CoverArtThumb";
import { useHost } from "../../host/HostContext";
import type { PlayerQueueItem } from "../core/types";
import {
  playerQueueItemArtworkCacheKey,
  resolvePlayerCachedArtwork,
} from "../shared/resolvePlayerCachedArtwork";

const COVER_SIZE = 40;

export type PlayerMiniBarCoverArtProps = {
  item: PlayerQueueItem | null;
  api: SubsonicAPI | null;
};

export function PlayerMiniBarCoverArt({ item, api }: PlayerMiniBarCoverArtProps) {
  const host = useHost();

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
      {item?.coverArtId ? (
        <CoverArtThumb
          api={api ?? undefined}
          coverArtId={item.coverArtId}
          resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, item)}
          artworkCacheKey={playerQueueItemArtworkCacheKey(item)}
          size={COVER_SIZE}
          label=""
          sx={{ width: COVER_SIZE, height: COVER_SIZE }}
        />
      ) : null}
    </Box>
  );
}
