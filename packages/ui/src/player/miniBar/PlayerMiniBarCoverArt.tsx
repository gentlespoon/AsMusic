import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import { CoverArtThumb } from "../../shared/CoverArtThumb";
import type { PlayerQueueItem } from "../core/types";

const COVER_SIZE = 40;

export type PlayerMiniBarCoverArtProps = {
  item: PlayerQueueItem | null;
  api: SubsonicAPI | null;
};

export function PlayerMiniBarCoverArt({ item, api }: PlayerMiniBarCoverArtProps) {
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
      {item && api ? (
        <CoverArtThumb
          api={api}
          coverArtId={item.coverArtId}
          size={COVER_SIZE}
          label=""
          sx={{ width: COVER_SIZE, height: COVER_SIZE }}
        />
      ) : null}
    </Box>
  );
}
