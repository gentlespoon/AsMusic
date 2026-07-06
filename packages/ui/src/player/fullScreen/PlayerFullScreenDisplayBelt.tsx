import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import type { SubsonicAPI } from "@asmusic/core";
import type { PlayerQueueItem } from "@ui/player/core/types";
import { CoverArtThumb } from "@ui/shared/CoverArtThumb";
import type { PersistCachedArtwork } from "@ui/shared/libraryArtworkCacheAccess";
import { useHost } from "@ui/host/HostContext";
import {
  persistPlayerCachedArtwork,
  resolvePlayerArtworkLocalFile,
  resolvePlayerCachedArtwork,
} from "@ui/player/shared/resolvePlayerCachedArtwork";
import { usePlayerCoverArtCacheBump } from "@ui/player/shared/usePlayerCoverArtCacheBump";
import { usePlayerArtworkCacheKey } from "@ui/player/shared/usePlayerArtworkCacheKey";
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
  resolveArtworkLocalFile,
  persistCachedArtwork,
  artworkCacheKey,
  artworkCacheBump,
  onCopyName,
  onOpenAlbum,
  onOpenArtist,
}: {
  item: PlayerQueueItem;
  coverSizePx: number;
  api: SubsonicAPI | undefined;
  resolveCachedArtwork: ReturnType<typeof resolvePlayerCachedArtwork>;
  resolveArtworkLocalFile?: ReturnType<typeof resolvePlayerArtworkLocalFile>;
  persistCachedArtwork: PersistCachedArtwork;
  artworkCacheKey?: string;
  artworkCacheBump: number;
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
            resolveArtworkLocalFile={resolveArtworkLocalFile}
            persistCachedArtwork={persistCachedArtwork}
            artworkCacheKey={artworkCacheKey}
            artworkCacheBump={artworkCacheBump}
            size={coverSizePx}
            label=""
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function DisplaySlotWithBump({
  item,
  coverSizePx,
  api,
  onCopyName,
  onOpenAlbum,
  onOpenArtist,
}: {
  item: PlayerQueueItem;
  coverSizePx: number;
  api: SubsonicAPI | undefined;
  onCopyName: (text: string) => void;
  onOpenAlbum: (item: PlayerQueueItem) => void;
  onOpenArtist: (item: PlayerQueueItem) => void;
}) {
  const host = useHost();
  const artworkCacheBump = usePlayerCoverArtCacheBump(item);
  const artworkCacheKey = usePlayerArtworkCacheKey(item);

  return (
    <DisplaySlot
      item={item}
      coverSizePx={coverSizePx}
      api={api}
      resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, item)}
      resolveArtworkLocalFile={resolvePlayerArtworkLocalFile(host.libraryCache, item)}
      persistCachedArtwork={persistPlayerCachedArtwork(host.libraryCache, item)}
      artworkCacheKey={artworkCacheKey}
      artworkCacheBump={artworkCacheBump}
      onCopyName={onCopyName}
      onOpenAlbum={onOpenAlbum}
      onOpenArtist={onOpenArtist}
    />
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
      <DisplaySlotWithBump
        item={slot}
        coverSizePx={coverSizePx}
        api={apisByServer[slot.serverId]}
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
            <DisplaySlotWithBump
              item={slot}
              coverSizePx={coverSizePx}
              api={apisByServer[slot.serverId]}
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
