import { useCallback, useEffect, useMemo, useState } from "react";
import {
  libraryCacheScope,
  offlineMediaKeyId,
  subscribeOfflineMediaReady,
  type LibraryCacheScope,
} from "@asmusic/core";
import { useOfflineDownload } from "@ui/contexts/OfflineDownloadContext";
import { useServerAndLibrary } from "@ui/contexts/ServerAndLibraryContext";
import { useHost } from "@ui/host/HostContext";

export type SongItemOfflineScope = {
  serverId: string;
  libraryId: string;
};

export function useSongItemOfflineActions(
  opts: (SongItemOfflineScope & { trackId: string; trackTitle?: string }) | null,
): {
  onDownload?: () => void;
  onRemoveDownload?: () => void;
  isDownloaded: boolean;
  showDownloadIndicator: boolean;
} {
  const host = useHost();
  const { servers, getStreamUrl } = useServerAndLibrary();
  const { enqueueTrackDownload } = useOfflineDownload();
  const [isReady, setIsReady] = useState(false);
  const [isWriting, setIsWriting] = useState(false);

  const offlineEnabled = host.offlineMedia.backend !== "noop";

  const scope = useMemo((): LibraryCacheScope | null => {
    if (!opts) return null;
    const server = servers.find((s) => s.id === opts.serverId);
    if (!server) return null;
    return libraryCacheScope(server.serverUrl, server.username, opts.libraryId);
  }, [opts, servers]);

  const cacheKey =
    scope && opts ? offlineMediaKeyId({ scope, trackId: opts.trackId }) : null;

  useEffect(() => {
    if (!scope || !opts || !offlineEnabled) {
      setIsReady(false);
      setIsWriting(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      const st = await host.offlineMedia.getStatus({
        scope,
        trackId: opts.trackId,
      });
      if (cancelled) return;
      setIsReady(st.status === "ready");
      setIsWriting(st.status === "writing");
    };

    void check();

    if (!cacheKey) return () => {
      cancelled = true;
    };

    const unsub = subscribeOfflineMediaReady((key) => {
      if (key === cacheKey) void check();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [cacheKey, host.offlineMedia, offlineEnabled, opts, scope]);

  const onDownload = useCallback(() => {
    if (!opts) return;
    enqueueTrackDownload({
      serverId: opts.serverId,
      libraryId: opts.libraryId,
      trackTitle: opts.trackTitle?.trim() || opts.trackId,
      trackId: opts.trackId,
    });
  }, [enqueueTrackDownload, opts]);

  const onRemoveDownload = useCallback(() => {
    if (!scope || !opts) return;
    void host.offlineMedia.delete({ scope, trackId: opts.trackId });
  }, [host.offlineMedia, opts, scope]);

  if (!opts || !scope || !offlineEnabled) {
    return {
      isDownloaded: false,
      showDownloadIndicator: false,
    };
  }

  const canDownload =
    !isReady && !isWriting && Boolean(getStreamUrl(opts.serverId, opts.trackId));

  return {
    onDownload: canDownload ? onDownload : undefined,
    onRemoveDownload: isReady ? onRemoveDownload : undefined,
    isDownloaded: isReady,
    showDownloadIndicator: true,
  };
}
