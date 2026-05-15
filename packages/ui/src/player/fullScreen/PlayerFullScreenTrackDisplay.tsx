import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
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
import { useLongPress } from "./useLongPress";
import { usePlayerLibraryNavigation } from "./usePlayerLibraryNavigation";

const libraryLinkSx = {
  border: 0,
  p: 0,
  m: 0,
  background: "none",
  font: "inherit",
  cursor: "pointer",
  color: "text.secondary",
  textAlign: "center" as const,
  width: "100%",
  "&:hover": { textDecoration: "underline" },
};

const copyableTextSx = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

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
  const coverRef = useRef<HTMLDivElement | null>(null);
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

  const coverBeltInteractive = beltSlots.slots.length > 1;

  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const measure = () => setCoverWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [item?.rowId]);

  useEffect(() => {
    if (!beltDragging) {
      setBeltDragPx(0);
    }
  }, [item?.rowId, beltDragging]);

  const clampBeltDrag = useCallback(
    (dragPx: number) =>
      clampPlayerBeltDragPx(
        dragPx,
        beltSlots.slots.length,
        beltSlots.activeIndex,
        coverWidth,
      ),
    [beltSlots.activeIndex, beltSlots.slots.length, coverWidth],
  );

  const coverGestures = usePlayerCoverBeltGestures({
    enabled: coverBeltInteractive,
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

  const coverSizePx = Math.max(1, Math.round(coverWidth || COVER_MAX_PX));

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

  const titleLongPress = useLongPress({
    disabled: !item?.title?.trim(),
    onLongPress: () => {
      if (item?.title) void copyName(item.title);
    },
  });

  const albumLongPress = useLongPress({
    disabled: !item?.album?.trim(),
    onLongPress: () => {
      if (item?.album) void copyName(item.album);
    },
  });

  const artistLongPress = useLongPress({
    disabled: !item?.artist?.trim(),
    onLongPress: () => {
      if (item?.artist) void copyName(item.artist);
    },
  });

  if (!item) return null;

  const emDash = t("common.emDash");
  const albumLabel = item.album?.trim() || emDash;
  const artistLabel = item.artist?.trim() || emDash;
  const canOpenAlbum = Boolean(item.album?.trim());
  const canOpenArtist = Boolean(item.artist?.trim());

  return (
    <>
      <Typography
        variant="h6"
        component="h2"
        align="center"
        sx={{ fontWeight: 700, px: 1, width: "100%", ...copyableTextSx }}
        {...titleLongPress.longPressPointerProps}
      >
        {item.title}
      </Typography>
      {canOpenAlbum ? (
        <Typography
          variant="body2"
          component="button"
          type="button"
          aria-label={t("player.action.openAlbum", { name: albumLabel })}
          onClick={() => {
            if (albumLongPress.consumeLongPress()) return;
            openAlbum(item);
          }}
          sx={{ ...libraryLinkSx, ...copyableTextSx, mt: 0.5 }}
          {...albumLongPress.longPressPointerProps}
        >
          {albumLabel}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 0.5, ...copyableTextSx }}
          {...albumLongPress.longPressPointerProps}
        >
          {albumLabel}
        </Typography>
      )}
      {canOpenArtist ? (
        <Typography
          variant="body2"
          component="button"
          type="button"
          aria-label={t("player.action.openArtist", { name: artistLabel })}
          onClick={() => {
            if (artistLongPress.consumeLongPress()) return;
            openArtist(item);
          }}
          sx={{ ...libraryLinkSx, ...copyableTextSx }}
          {...artistLongPress.longPressPointerProps}
        >
          {artistLabel}
        </Typography>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={copyableTextSx}
          {...artistLongPress.longPressPointerProps}
        >
          {artistLabel}
        </Typography>
      )}

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
          ...(coverBeltInteractive
            ? { touchAction: "none", userSelect: "none", cursor: "default" }
            : {}),
        }}
        {...(coverBeltInteractive
          ? {
              role: "group",
              "aria-label": t("player.gestureZone.label"),
              onPointerDown: coverGestures.onPointerDown,
              onPointerMove: coverGestures.onPointerMove,
              onPointerUp: coverGestures.onPointerUp,
              onPointerCancel: coverGestures.onPointerCancel,
            }
          : {})}
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
