import { useEffect, useState } from "react";
import type { SubsonicAPI } from "@asmusic/core";
import { useServerAndLibrary } from "@ui/contexts/ServerAndLibraryContext";
import type { PlayerQueueItem } from "@ui/player/core/types";

export function usePlayerMiniBarCoverApi(
  item: PlayerQueueItem | null,
): SubsonicAPI | null {
  const { getApiForServer } = useServerAndLibrary();
  const [api, setApi] = useState<SubsonicAPI | null>(null);

  useEffect(() => {
    if (!item) {
      setApi(null);
      return;
    }
    let cancelled = false;
    void getApiForServer(item.serverId).then((a) => {
      if (!cancelled) setApi(a);
    });
    return () => {
      cancelled = true;
    };
  }, [item, getApiForServer]);

  return api;
}
