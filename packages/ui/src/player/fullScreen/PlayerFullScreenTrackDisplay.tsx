import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import { useT } from "@asmusic/i18n";
import {
  usePlayerActions,
  usePlayerTransportState,
} from "../../contexts/PlayerContext";
import { useServerAndLibrary } from "../../contexts/ServerAndLibraryContext";
import { playImpactIfEnabled } from "../../haptics/playImpactIfEnabled";
import { useHost } from "../../host/HostContext";
import { copyTextToClipboard } from "../../utils/copyToClipboard";
import { PlayerCoverArtBelt } from "../shared/PlayerCoverArtBelt";
import {
  clampPlayerBeltDragPx,
  resolvePlayerBeltSlots,
} from "../shared/resolvePlayerBeltSlots";
import { usePlayerCoverBeltGestures } from "../shared/usePlayerCoverBeltGestures";
import { PlayerFullScreenDisplayBelt } from "./PlayerFullScreenDisplayBelt";
import { PlayerFullScreenTrackInfoSlot } from "./PlayerFullScreenTrackInfoSlot";
import { usePlayerLibraryNavigation } from "./usePlayerLibraryNavigation";

const COVER_MAX_PX = 360;

export function PlayerFullScreenTrackDisplay() {
  const t = useT();
  const host = useHost();
  const state = usePlayerTransportState();
  const item = state.currentItem;
  const { skipNext, skipPrevious } = usePlayerActions();
  const { openAlbum, openArtist } = usePlayerLibraryNavigation();
  const { getApiForServer } = useServerAndLibrary();
  const [toast, setToast] = useState<string | null>(null);
  const beltZoneRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const [beltZoneWidth, setBeltZoneWidth] = useState(0);
  const [coverWidth, setCoverWidth] = useState(0);
  const [beltDragPx, setBeltDragPx] = useState(0);
  const [beltDragging, setBeltDragging] = useState(false);

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

  const beltInteractive = beltSlots.slots.length > 1;

  useEffect(() => {
    const el = beltInteractive ? beltZoneRef.current : coverRef.current;
    if (!el) return;
    const measure = () => setBeltZoneWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [beltInteractive, item?.rowId]);

  useEffect(() => {
    if (beltInteractive) return;
    const el = coverRef.current;
    if (!el) return;
    const measure = () => setCoverWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [beltInteractive, item?.rowId]);

  useEffect(() => {
    if (!beltDragging) {
      setBeltDragPx(0);
    }
  }, [item?.rowId, beltDragging]);

  const slotWidthPx = beltInteractive ? beltZoneWidth : coverWidth;

  const clampBeltDrag = useCallback(
    (dragPx: number) =>
      clampPlayerBeltDragPx(
        dragPx,
        beltSlots.slots.length,
        beltSlots.activeIndex,
        slotWidthPx,
      ),
    [beltSlots.activeIndex, beltSlots.slots.length, slotWidthPx],
  );

  const beltGestures = usePlayerCoverBeltGestures({
    enabled: beltInteractive,
    hasNext: state.hasNext,
    hasPrevious: state.hasPrevious,
    onDrag: (deltaPx) => {
      setBeltDragging(true);
      setBeltDragPx(clampBeltDrag(deltaPx));
    },
    onDragEnd: () => {
      setBeltDragging(false);
      setBeltDragPx(0);
    },
    skipNext,
    skipPrevious,
    playImpact: () => playImpactIfEnabled(host),
  });

  const coverSizePx = Math.max(
    1,
    Math.round(
      (beltInteractive ? Math.min(beltZoneWidth, COVER_MAX_PX) : coverWidth) ||
        COVER_MAX_PX,
    ),
  );

  const copyName = useCallback(
    async (text: string) => {
      const value = text.trim();
      const emDash = t("common.emDash");
      if (!value || value === emDash) return;
      const ok = await copyTextToClipboard(value, host);
      if (ok) {
        playImpactIfEnabled(host);
        setToast(t("player.copied", { value }));
      } else {
        setToast(t("player.copyFailed"));
      }
    },
    [host, t],
  );

  if (!item) return null;

  if (beltInteractive) {
    return (
      <>
        <Box
          ref={beltZoneRef}
          sx={{
            width: "100%",
            touchAction: "none",
            userSelect: "none",
            cursor: "default",
          }}
          role="group"
          aria-label={t("player.gestureZone.label")}
          onPointerDown={beltGestures.onPointerDown}
          onPointerMove={beltGestures.onPointerMove}
          onPointerUp={beltGestures.onPointerUp}
          onPointerCancel={beltGestures.onPointerCancel}
        >
          <PlayerFullScreenDisplayBelt
            slots={beltSlots.slots}
            activeIndex={beltSlots.activeIndex}
            dragPx={beltDragPx}
            dragging={beltDragging}
            coverSizePx={coverSizePx}
            getApiForServer={getApiForServer}
            onCopyName={(text) => void copyName(text)}
            onOpenAlbum={openAlbum}
            onOpenArtist={openArtist}
          />
        </Box>

        <Snackbar
          open={toast != null}
          autoHideDuration={2000}
          onClose={() => setToast(null)}
          message={toast}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
      </>
    );
  }

  return (
    <>
      <PlayerFullScreenTrackInfoSlot
        item={item}
        onCopyName={(text) => void copyName(text)}
        onOpenAlbum={openAlbum}
        onOpenArtist={openArtist}
      />

      <Box
        ref={coverRef}
        sx={{
          width: "100%",
          maxWidth: COVER_MAX_PX,
          mt: 2,
          aspectRatio: "1",
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "action.hover",
        }}
      >
        <PlayerCoverArtBelt
          slots={beltSlots.slots}
          activeIndex={beltSlots.activeIndex}
          dragPx={beltDragPx}
          dragging={beltDragging}
          coverSizePx={coverSizePx}
          getApiForServer={getApiForServer}
        />
      </Box>

      <Snackbar
        open={toast != null}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
