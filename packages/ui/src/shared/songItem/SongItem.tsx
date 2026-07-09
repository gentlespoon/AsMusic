import { useState, type MouseEvent } from "react";
import { useT } from "@asmusic/i18n";
import { SongItemActions } from "./SongItemActions";
import { SongItemActionsMenu } from "./SongItemActionsMenu";
import { SongItemDownloadedIndicator } from "./SongItemDownloadedIndicator";
import { SongItemMain } from "./SongItemMain";
import { SongItemRow } from "./SongItemRow";
import { songItemSecondaryLine } from "./songItemSecondaryLine";
import { useSongItemOfflineActions } from "./useSongItemOfflineActions";
import type { SongItemProps } from "./types";

export type { SongItemProps } from "./types";

export function SongItem({
  track,
  coverArtId,
  fallbackCoverArtId,
  api,
  resolveCachedArtwork,
  resolveArtworkLocalFile,
  persistCachedArtwork,
  artworkCacheBump,
  artworkCacheKey,
  includeAlbumInSecondary,
  secondaryContent,
  offlineScope,
  onRemoveDownload: onRemoveDownloadOverride,
  onClick,
  onPlayNext,
  onAppendToQueue,
  onViewArtist,
  onViewAlbum,
  isStarred,
  onToggleStar,
  isDownloaded: isDownloadedOverride,
  unavailable = false,
}: SongItemProps) {
  const t = useT();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const offlineActions = useSongItemOfflineActions(
    offlineScope
      ? {
          serverId: offlineScope.serverId,
          libraryId: offlineScope.libraryId,
          trackId: String(track.id),
          trackTitle: track.title,
        }
      : null,
  );
  const menuOnDownload = offlineActions.onDownload;
  const menuOnRemoveDownload =
    onRemoveDownloadOverride ?? offlineActions.onRemoveDownload;

  const showStarInMenu = Boolean(onToggleStar) && isStarred != null;
  const showOverflowMenu = Boolean(
    onPlayNext ||
      onAppendToQueue ||
      onViewArtist ||
      onViewAlbum ||
      menuOnDownload ||
      menuOnRemoveDownload ||
      showStarInMenu,
  );
  const showDownloadIndicator =
    isDownloadedOverride != null || offlineActions.showDownloadIndicator;
  const isDownloaded = isDownloadedOverride ?? offlineActions.isDownloaded;
  const hasTrailing = showDownloadIndicator || showOverflowMenu;

  const secondary =
    secondaryContent ??
    songItemSecondaryLine(track, includeAlbumInSecondary);
  const noWrapSecondary = secondaryContent == null;

  const stopRowClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const main = (
    <SongItemMain
      track={track}
      secondary={secondary}
      noWrapSecondary={noWrapSecondary}
      api={api}
      coverArtId={coverArtId}
      fallbackCoverArtId={fallbackCoverArtId}
      resolveCachedArtwork={resolveCachedArtwork}
      resolveArtworkLocalFile={resolveArtworkLocalFile}
      persistCachedArtwork={persistCachedArtwork}
      artworkCacheBump={artworkCacheBump}
      artworkCacheKey={artworkCacheKey}
    />
  );

  const indicator = showDownloadIndicator ? (
    <SongItemDownloadedIndicator isDownloaded={isDownloaded} t={t} />
  ) : null;

  const actions = showOverflowMenu ? (
    <SongItemActions
      onOpenOverflowMenu={(e) => setMenuAnchor(e.currentTarget)}
      stopRowClick={stopRowClick}
      t={t}
    />
  ) : null;

  return (
    <>
      <SongItemRow
        main={main}
        indicator={indicator}
        actions={actions}
        onClick={onClick}
        hasTrailing={hasTrailing}
        unavailable={unavailable}
      />
      {showOverflowMenu ? (
        <SongItemActionsMenu
          anchorEl={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          onPlayNext={onPlayNext}
          onAppendToQueue={onAppendToQueue}
          onViewArtist={onViewArtist}
          onViewAlbum={onViewAlbum}
          onDownload={menuOnDownload}
          onRemoveDownload={menuOnRemoveDownload}
          isStarred={showStarInMenu ? isStarred : undefined}
          onToggleStar={showStarInMenu ? onToggleStar : undefined}
          t={t}
        />
      ) : null}
    </>
  );
}
