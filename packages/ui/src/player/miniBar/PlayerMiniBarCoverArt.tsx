import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import { CoverArtThumb } from "../../shared/CoverArtThumb";
import { useHost } from "../../host/HostContext";
import type { PlayerQueueItem } from "../core/types";
import { usePlayerArtworkCacheKey } from "../shared/usePlayerArtworkCacheKey";
import { usePlayerCoverArtCacheBump } from "../shared/usePlayerCoverArtCacheBump";
import {
  persistPlayerCachedArtwork,
  resolvePlayerArtworkLocalFile,
  resolvePlayerCachedArtwork,
} from "../shared/resolvePlayerCachedArtwork";

const COVER_SIZE = 40;

export type PlayerMiniBarCoverArtProps = {
  item: PlayerQueueItem | null;
  api: SubsonicAPI | null;
};

export function PlayerMiniBarCoverArt({ item, api }: PlayerMiniBarCoverArtProps) {
  const host = useHost();
  const artworkCacheBump = usePlayerCoverArtCacheBump(item);
  const artworkCacheKey = usePlayerArtworkCacheKey(item);

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
          key={item.rowId}
          api={api ?? undefined}
          coverArtId={item.coverArtId}
          resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, item)}
          resolveArtworkLocalFile={resolvePlayerArtworkLocalFile(host.libraryCache, item)}
          persistCachedArtwork={persistPlayerCachedArtwork(host.libraryCache, item)}
          artworkCacheKey={artworkCacheKey}
          artworkCacheBump={artworkCacheBump}
          size={COVER_SIZE}
          label=""
          sx={{ width: COVER_SIZE, height: COVER_SIZE }}
        />
      ) : (
        <Box sx={{ width: "100%", height: "100%", bgcolor: "action.hover" }} aria-hidden />
      )}
    </Box>
  );
}
