import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import { Virtuoso } from "react-virtuoso";
import {
  LibraryVirtuosoFill,
  libraryFlexFillSx,
} from "@ui/shared/LibraryVirtuosoFill";
import { VirtuosoMuiList } from "@ui/shared/virtuosoMuiList";
import type { PlayerViewState } from "@ui/player/core/types";
import { PlayingQueueViewRow } from "./PlayingQueueViewRow";
import type { usePlayingQueueScroll } from "./usePlayingQueueScroll";

export type PlayingQueueViewListProps = {
  state: PlayerViewState;
  scroll: Pick<
    ReturnType<typeof usePlayingQueueScroll>,
    "virtuosoRef" | "currentScrollIndex" | "handleRangeChanged"
  >;
  onPlayIndex: (index: number) => void;
  onOpenRowMenu: (anchor: HTMLElement, index: number) => void;
};

export function PlayingQueueViewList({
  state,
  scroll,
  onPlayIndex,
  onOpenRowMenu,
}: PlayingQueueViewListProps) {
  const t = useT();

  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        display: "flex",
        flexDirection: "column",
        pb: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {state.queue.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 4, textAlign: "center" }}
        >
          {t("queue.empty")}
        </Typography>
      ) : (
        <LibraryVirtuosoFill>
          <Virtuoso
            ref={scroll.virtuosoRef}
            style={{ height: "100%", width: "100%", minHeight: 0 }}
            totalCount={state.queue.length}
            initialTopMostItemIndex={scroll.currentScrollIndex ?? 0}
            rangeChanged={scroll.handleRangeChanged}
            components={{ List: VirtuosoMuiList }}
            computeItemKey={(index) => state.queue[index]?.rowId ?? index}
            increaseViewportBy={{ top: 120, bottom: 200 }}
            itemContent={(index) => {
              const item = state.queue[index];
              if (!item) return null;
              return (
                <PlayingQueueViewRow
                  item={item}
                  selected={state.currentIndex === index}
                  onPlay={() => onPlayIndex(index)}
                  onOpenMenu={(anchor) => onOpenRowMenu(anchor, index)}
                />
              );
            }}
          />
        </LibraryVirtuosoFill>
      )}
    </Box>
  );
}
