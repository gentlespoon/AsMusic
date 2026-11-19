import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useT } from "@asmusic/i18n";
import { Virtuoso, type ListRange, type VirtuosoHandle } from "react-virtuoso";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { VirtuosoMuiList } from "@ui/shared/virtuosoMuiList";
import type { PlayerViewState } from "@ui/player/core/types";
import { PlayingQueueViewRow } from "./PlayingQueueViewRow";
import {
  PLAYING_QUEUE_ROW_HEIGHT,
  PLAYING_QUEUE_WINDOW,
  nextPlayingQueueWindowStart,
  playingQueueWindowStart,
} from "./playingQueueWindow";

export type PlayingQueueViewListProps = {
  state: PlayerViewState;
  onPlayIndex: (index: number) => void;
  onOpenRowMenu: (anchor: HTMLElement, index: number) => void;
};

export function PlayingQueueViewList({
  state,
  onPlayIndex,
  onOpenRowMenu,
}: PlayingQueueViewListProps) {
  const t = useT();
  const queue = state.queue;
  const currentIndex = state.currentIndex;
  const fillRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [start, setStart] = useState(() =>
    playingQueueWindowStart(currentIndex ?? 0, queue.length),
  );
  const startRef = useRef(start);
  const lengthRef = useRef(queue.length);
  lengthRef.current = queue.length;
  const anchorRef = useRef<{ index: number; align: "start" | "center" | "end" } | null>(
    null,
  );
  const skipInitialScroll = useRef(true);
  const initialLocalIndex = useRef(
    Math.max(0, (currentIndex ?? 0) - playingQueueWindowStart(currentIndex ?? 0, queue.length)),
  );

  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const apply = () => {
      const next = el.clientHeight;
      setHeight((prev) => (prev === next ? prev : next));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [queue.length === 0]);

  const maxStart =
    queue.length <= PLAYING_QUEUE_WINDOW ? 0 : queue.length - PLAYING_QUEUE_WINDOW;
  if (start > maxStart) {
    setStart(maxStart);
  }
  const visibleStart = Math.min(start, maxStart);
  startRef.current = visibleStart;

  const windowItems = useMemo(
    () => queue.slice(visibleStart, visibleStart + PLAYING_QUEUE_WINDOW),
    [queue, visibleStart],
  );

  useLayoutEffect(() => {
    if (skipInitialScroll.current) {
      skipInitialScroll.current = false;
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchorRef.current = null;
    const local = anchor.index - visibleStart;
    virtuosoRef.current?.scrollToIndex({
      index: Math.max(0, Math.min(local, windowItems.length - 1)),
      align: anchor.align,
      behavior: "auto",
    });
  }, [visibleStart, windowItems.length]);

  const onRangeChanged = useCallback((range: ListRange) => {
    const next = nextPlayingQueueWindowStart({
      start: startRef.current,
      length: lengthRef.current,
      rangeStart: range.startIndex,
      rangeEnd: range.endIndex,
    });
    if (!next) return;
    anchorRef.current = { index: next.anchorIndex, align: next.align };
    setStart(next.start);
  }, []);

  const prevIndex = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevIndex.current;
    prevIndex.current = currentIndex;
    if (currentIndex == null || prev === null || prev === currentIndex) return;
    const startNow = startRef.current;
    const end = startNow + Math.min(PLAYING_QUEUE_WINDOW, lengthRef.current);
    if (currentIndex >= startNow && currentIndex < end) {
      virtuosoRef.current?.scrollToIndex({
        index: currentIndex - startNow,
        align: "center",
        behavior: "auto",
      });
      return;
    }
    anchorRef.current = { index: currentIndex, align: "center" };
    setStart(playingQueueWindowStart(currentIndex, lengthRef.current));
  }, [currentIndex]);

  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        display: "flex",
        flexDirection: "column",
        pb: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {queue.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 4, textAlign: "center" }}
        >
          {t("queue.empty")}
        </Typography>
      ) : (
        <Box ref={fillRef} sx={{ ...libraryFlexFillSx, position: "relative" }}>
          {height > 0 && (
            <Virtuoso
              ref={virtuosoRef}
              style={{ height, width: "100%" }}
              data={windowItems}
              fixedItemHeight={PLAYING_QUEUE_ROW_HEIGHT}
              initialTopMostItemIndex={initialLocalIndex.current}
              rangeChanged={onRangeChanged}
              components={{ List: VirtuosoMuiList }}
              computeItemKey={(_index, item) => item.rowId}
              itemContent={(index, item) => {
                const absoluteIndex = visibleStart + index;
                return (
                  <PlayingQueueViewRow
                    item={item}
                    selected={currentIndex === absoluteIndex}
                    onPlay={() => onPlayIndex(absoluteIndex)}
                    onOpenMenu={(anchor) => onOpenRowMenu(anchor, absoluteIndex)}
                  />
                );
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
