import { useState, type MouseEvent } from "react";
import { useT } from "@asmusic/i18n";
import { SongItemActions } from "./SongItemActions";
import { SongItemMain } from "./SongItemMain";
import { SongItemQueueMenu } from "./SongItemQueueMenu";
import { SongItemRow } from "./SongItemRow";
import { songItemSecondaryLine } from "./songItemSecondaryLine";
import type { SongItemProps } from "./types";

export type { SongItemProps } from "./types";

export function SongItem({
  track,
  coverArtId,
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
  isStarred,
  onToggleStar,
  unavailable = false,
}: SongItemProps) {
  const t = useT();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [starBusy, setStarBusy] = useState(false);

  const showQueueMenu = Boolean(onPlayNext || onAppendToQueue);
  const showStar = Boolean(onToggleStar) && isStarred != null;
  const showDelete = Boolean(showRemoveButton && onRemove);
  const showActionsMenu = showQueueMenu || showDelete;
  const hasActions = showStar || showActionsMenu;

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
      starBusy={starBusy}
      onStarClick={() => {
        if (!onToggleStar) return;
        setStarBusy(true);
        void Promise.resolve(onToggleStar()).finally(() => setStarBusy(false));
      }}
      showDelete={showDelete}
      showQueueMenu={showQueueMenu}
      onOpenQueueMenu={(e) => setMenuAnchor(e.currentTarget)}
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
      {showActionsMenu ? (
        <SongItemQueueMenu
          anchorEl={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          onPlayNext={onPlayNext}
          onAppendToQueue={onAppendToQueue}
          onRemove={showDelete ? onRemove : undefined}
          t={t}
        />
      ) : null}
    </>
  );
}
