import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import type { SubsonicAPI } from '@asmusic/core';
import type { PlayerQueueItem } from '../core/types';
import { CoverArtThumb } from '../../shared/CoverArtThumb';
import { useHost } from '../../host/HostContext';
import {
  playerQueueItemArtworkCacheKey,
  persistPlayerCachedArtwork,
  resolvePlayerCachedArtwork,
} from './resolvePlayerCachedArtwork';

export type PlayerCoverArtBeltProps = {
  slots: PlayerQueueItem[];
  activeIndex: number;
  dragPx: number;
  dragging: boolean;
  coverSizePx: number;
  getApiForServer: (serverId: string) => Promise<SubsonicAPI | null>;
};

export function PlayerCoverArtBelt({
  slots,
  activeIndex,
  dragPx,
  dragging,
  coverSizePx,
  getApiForServer,
}: PlayerCoverArtBeltProps) {
  const host = useHost();
  const serverIds = useMemo(
    () => [...new Set(slots.map((s) => s.serverId))],
    [slots],
  );
  const [apisByServer, setApisByServer] = useState<Record<string, SubsonicAPI>>({});

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
    const api = apisByServer[slot.serverId];
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {slot.coverArtId ? (
          <CoverArtThumb
            api={api}
            coverArtId={slot.coverArtId}
            resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, slot)}
            persistCachedArtwork={persistPlayerCachedArtwork(host.libraryCache, slot)}
            artworkCacheKey={playerQueueItemArtworkCacheKey(slot)}
            size={coverSizePx}
            label=""
            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : null}
      </Box>
    );
  }

  const slotPercent = 100 / slots.length;

  return (
    <Box sx={{ overflow: 'hidden', width: '100%', height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          width: `${slots.length * 100}%`,
          height: '100%',
          transform: `translateX(calc(-${activeIndex * 100}% / ${slots.length} + ${dragPx}px))`,
          transition: dragging ? 'none' : 'transform 0.22s ease-out',
          willChange: 'transform',
        }}
      >
        {slots.map((slot) => {
          const api = apisByServer[slot.serverId];
          return (
            <Box
              key={slot.rowId}
              sx={{
                flex: `0 0 ${slotPercent}%`,
                width: `${slotPercent}%`,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              {slot.coverArtId ? (
                <CoverArtThumb
                  api={api}
                  coverArtId={slot.coverArtId}
                  resolveCachedArtwork={resolvePlayerCachedArtwork(host.libraryCache, slot)}
            persistCachedArtwork={persistPlayerCachedArtwork(host.libraryCache, slot)}
                  artworkCacheKey={playerQueueItemArtworkCacheKey(slot)}
                  size={coverSizePx}
                  label=""
                  sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
