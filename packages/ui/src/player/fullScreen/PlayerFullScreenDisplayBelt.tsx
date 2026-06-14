import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import type { PlayerQueueItem } from "../core/types";
import { CoverArtThumb } from "../../shared/CoverArtThumb";
import { useHost } from "../../host/HostContext";
import {
  playerQueueItemArtworkCacheKey,
  resolvePlayerCachedArtwork,
} from "../shared/resolvePlayerCachedArtwork";
import { PlayerFullScreenTrackInfoSlot } from "./PlayerFullScreenTrackInfoSlot";

const COVER_MAX_PX = 360;

export type PlayerFullScreenDisplayBeltProps = {
  slots: PlayerQueueItem[];
  activeIndex: number;
  dragPx: number;
  dragging: boolean;
  coverSizePx: number;
  getApiForServer: (serverId: string) => Promise<SubsonicAPI | null>;
  onCopyName: (text: string) => void;
  onOpenAlbum: (item: PlayerQueueItem) => void;
  onOpenArtist: (item: PlayerQueueItem) => void;
};

function DisplaySlot({
  item,
  coverSizePx,
  api,
  resolveCachedArtwork,
  artworkCacheKey,
  onCopyName,
  onOpenAlbum,
  onOpenArtist,
}: {
  item: PlayerQueueItem;
  coverSizePx: number;
  api: SubsonicAPI | undefined;
  resolveCachedArtwork: ReturnType<typeof resolvePlayerCachedArtwork>;
  artworkCacheKey: string;
  onCopyName: (text: string) => void;
  onOpenAlbum: (item: PlayerQueueItem) => void;
  onOpenArtist: (item: PlayerQueueItem) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <PlayerFullScreenTrackInfoSlot
        item={item}
        beltGesturePassthrough
        onCopyName={onCopyName}
        onOpenAlbum={onOpenAlbum}
        onOpenArtist={onOpenArtist}
      />
      <Box
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
        {item.coverArtId ? (
          <CoverArtThumb
            api={api}
            coverArtId={item.coverArtId}
            resolveCachedArtwork={resolveCachedArtwork}
            artworkCacheKey={artworkCacheKey}
            size={coverSizePx}
            label=""
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

export function PlayerFullScreenDisplayBelt({
  slots,
  activeIndex,
  dragPx,
  dragging,
  coverSizePx,
  getApiForServer,
  onCopyName,
  onOpenAlbum,
  onOpenArtist,
}: PlayerFullScreenDisplayBeltProps) {
  const host = useHost();
  const serverIds = useMemo(
    () => [...new Set(slots.map((s) => s.serverId))],
    [slots],
  );
  const [apisByServer, setApisByServer] = useState<Record<string, SubsonicAPI>>(
    {},
  );

  useEffect(() => {
    if (slots.length === 0) return;
    let cancelled = false;
    void Promise.all(
      serverIds.map(async (serverId) => {
        const api = await getApiForServer(serverId);
        return [serverId, api] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, SubsonicAPI> = {};
      for (const [serverId, api] of entries) {
        if (api) next[serverId] = api;
      }
      setApisByServer(next);
    });
    return () => {
      cancelled = true;
    };
  }, [getApiForServer, serverIds, slots.length]);

  if (slots.length === 0) {
    return null;
  }

  if (slots.length === 1) {
    const slot = slots[0]!;
    return (
      <DisplaySlot
        item={slot}
        coverSizePx={coverSizePx}
        api={apisByServer[slot.serverId]}
        resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, slot)}
        artworkCacheKey={playerQueueItemArtworkCacheKey(slot)}
        onCopyName={onCopyName}
        onOpenAlbum={onOpenAlbum}
        onOpenArtist={onOpenArtist}
      />
    );
  }

  const slotPercent = 100 / slots.length;

  return (
    <Box sx={{ overflow: "hidden", width: "100%", minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          width: `${slots.length * 100}%`,
          transform: `translateX(calc(-${activeIndex * 100}% / ${slots.length} + ${dragPx}px))`,
          transition: dragging ? "none" : "transform 0.22s ease-out",
          willChange: "transform",
        }}
      >
        {slots.map((slot) => (
          <Box
            key={slot.rowId}
            sx={{
              flex: `0 0 ${slotPercent}%`,
              width: `${slotPercent}%`,
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <DisplaySlot
              item={slot}
              coverSizePx={coverSizePx}
              api={apisByServer[slot.serverId]}
              resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, slot)}
              artworkCacheKey={playerQueueItemArtworkCacheKey(slot)}
              onCopyName={onCopyName}
              onOpenAlbum={onOpenAlbum}
              onOpenArtist={onOpenArtist}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
