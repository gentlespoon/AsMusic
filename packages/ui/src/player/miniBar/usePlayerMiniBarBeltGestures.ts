import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHost } from "../../host/HostContext";
import { playImpactIfEnabled } from "../../haptics/playImpactIfEnabled";
import {
  usePlayerActions,
  usePlayerTransportState,
} from "../../contexts/PlayerContext";
import {
  clampPlayerBeltDragPx,
  resolvePlayerBeltSlots,
} from "../shared/resolvePlayerBeltSlots";
import { usePlayerMiniBarLegacyGestures } from "./usePlayerMiniBarLegacyGestures";

export type PlayerMiniBarBeltGestures = ReturnType<
  typeof usePlayerMiniBarBeltGestures
>;

export function usePlayerMiniBarBeltGestures(swipeGestures: boolean) {
  const state = usePlayerTransportState();
  const {
    togglePlayPause,
    toggleFullPlayer,
    skipNext,
    skipPrevious,
    seek,
  } = usePlayerActions();
  const host = useHost();
  const item = state.currentItem;
  const busy = Boolean(item);

  const gestureZoneRef = useRef<HTMLDivElement | null>(null);
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const [gestureZoneWidth, setGestureZoneWidth] = useState(0);
  const [trackAreaWidth, setTrackAreaWidth] = useState(0);
  const [beltDragPx, setBeltDragPx] = useState(0);
  const [beltDragging, setBeltDragging] = useState(false);
  const lastGestureCommitAtRef = useRef(0);

  const beltSlots = useMemo(
    () =>
      resolvePlayerBeltSlots(
        state.queue,
        state.currentIndex,
        item,
        state.hasNext,
        state.hasPrevious,
      ),
    [
      state.queue,
      state.currentIndex,
      item,
      state.hasNext,
      state.hasPrevious,
    ],
  );

  useEffect(() => {
    const el = gestureZoneRef.current;
    if (!el || !swipeGestures) return;
    const measure = () => setGestureZoneWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [swipeGestures]);

  useEffect(() => {
    const el = trackAreaRef.current;
    if (!el || !swipeGestures) return;
    const measure = () => setTrackAreaWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [swipeGestures]);

  useEffect(() => {
    if (!beltDragging) {
      setBeltDragPx(0);
    }
  }, [item?.rowId, beltDragging]);

  const markGestureCommit = () => {
    lastGestureCommitAtRef.current = performance.now();
  };

  const clampBeltDrag = useCallback(
    (dragPx: number) =>
      clampPlayerBeltDragPx(
        dragPx,
        beltSlots.slots.length,
        beltSlots.activeIndex,
        trackAreaWidth,
      ),
    [beltSlots.activeIndex, beltSlots.slots.length, trackAreaWidth],
  );

  const gestures = usePlayerMiniBarLegacyGestures({
    enabled: swipeGestures,
    busy,
    durationSeconds: state.durationSeconds,
    positionSeconds: state.positionSeconds,
    hasNext: state.hasNext,
    hasPrevious: state.hasPrevious,
    zoneWidthPx: gestureZoneWidth > 0 ? gestureZoneWidth : 320,
    togglePlayPause,
    skipNext,
    skipPrevious,
    openFullPlayer: toggleFullPlayer,
    seek,
    onGestureCommit: markGestureCommit,
    onCarouselDrag: (deltaPx) => {
      setBeltDragging(true);
      setBeltDragPx(clampBeltDrag(deltaPx));
    },
    onCarouselDragEnd: () => {
      setBeltDragging(false);
      setBeltDragPx(0);
    },
    playImpact: () => playImpactIfEnabled(host),
  });

  const suppressClickAfterGesture = (e: React.MouseEvent) => {
    if (performance.now() - lastGestureCommitAtRef.current < 450) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    gestureZoneRef,
    trackAreaRef,
    beltSlots,
    beltDragPx,
    beltDragging,
    gestures,
    suppressClickAfterGesture,
  };
}
