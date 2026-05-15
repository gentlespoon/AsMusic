import Box from "@mui/material/Box";
import { useT } from "@asmusic/i18n";
import type { SubsonicAPI } from "@asmusic/core";
import type { PlayerQueueItem } from "../core/types";
import type { PlayerMiniBarBeltGestures } from "./usePlayerMiniBarBeltGestures";
import { PlayerMiniBarCoverArt } from "./PlayerMiniBarCoverArt";
import { PlayerMiniBarTrackBelt } from "./PlayerMiniBarTrackBelt";
import { PlayerMiniBarTrackInfo } from "./PlayerMiniBarTrackInfo";

export type PlayerMiniBarGestureZoneProps = {
  swipeGestures: boolean;
  item: PlayerQueueItem | null;
  api: SubsonicAPI | null;
  belt: PlayerMiniBarBeltGestures;
};

export function PlayerMiniBarGestureZone({
  swipeGestures,
  item,
  api,
  belt,
}: PlayerMiniBarGestureZoneProps) {
  const t = useT();
  const gestureZoneLabel = t("player.gestureZone.label");

  return (
    <Box
      ref={belt.gestureZoneRef}
      sx={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        py: 0.25,
        ...(swipeGestures
          ? {
              touchAction: "none",
              userSelect: "none",
              cursor: "default",
            }
          : {}),
      }}
      {...(swipeGestures
        ? {
            role: "group",
            "aria-label": gestureZoneLabel,
            onPointerDown: belt.gestures.onPointerDown,
            onPointerMove: belt.gestures.onPointerMove,
            onPointerUp: belt.gestures.onPointerUp,
            onPointerCancel: belt.gestures.onPointerCancel,
            onClickCapture: belt.suppressClickAfterGesture,
          }
        : {})}
    >
      <PlayerMiniBarCoverArt item={item} api={api} />
      <Box
        ref={swipeGestures ? belt.trackAreaRef : undefined}
        sx={{ flex: 1, minWidth: 0 }}
      >
        {swipeGestures ? (
          <PlayerMiniBarTrackBelt
            slots={belt.beltSlots.slots}
            activeIndex={belt.beltSlots.activeIndex}
            dragPx={belt.beltDragPx}
            dragging={belt.beltDragging}
            emptyTitle={t("player.empty.title")}
            emptySubtitle={t("player.empty.pickSong")}
            emptyMetadata={t("common.emDash")}
          />
        ) : (
          <PlayerMiniBarTrackInfo item={item} />
        )}
      </Box>
    </Box>
  );
}
