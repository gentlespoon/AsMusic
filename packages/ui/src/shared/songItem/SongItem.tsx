import { useState, type MouseEvent } from "react";
import { useT } from "@asmusic/i18n";
import { SongItemActions } from "./SongItemActions";
import { SongItemActionsMenu } from "./SongItemActionsMenu";
import { SongItemMain } from "./SongItemMain";
import { SongItemRow } from "./SongItemRow";
import { songItemSecondaryLine } from "./songItemSecondaryLine";
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
  showRemoveButton,
  onRemove,
  onClick,
  onPlayNext,
  onAppendToQueue,
  onViewArtist,
  onViewAlbum,
  isStarred,
  onToggleStar,
  unavailable = false,
}: SongItemProps) {
  const t = useT();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const showOverflowMenu = Boolean(
    onPlayNext || onAppendToQueue || onViewArtist || onViewAlbum || (showRemoveButton && onRemove),
  );
  const showStar = Boolean(onToggleStar) && isStarred != null;
  const showDelete = Boolean(showRemoveButton && onRemove);
  const hasActions = showStar || showOverflowMenu;

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

  const actions = hasActions ? (
    <SongItemActions
      showStar={showStar}
      isStarred={isStarred}
      onStarClick={() => {
        if (!onToggleStar) return;
        void Promise.resolve(onToggleStar());
      }}
      showOverflowMenu={showOverflowMenu}
      onOpenOverflowMenu={(e) => setMenuAnchor(e.currentTarget)}
      stopRowClick={stopRowClick}
      t={t}
    />
  ) : null;

  return (
    <>
      <SongItemRow
        main={main}
        actions={actions}
        onClick={onClick}
        hasActions={hasActions}
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
          onRemove={showDelete ? onRemove : undefined}
          t={t}
        />
      ) : null}
    </>
  );
}
