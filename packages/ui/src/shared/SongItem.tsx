import { useState, type MouseEvent, type ReactNode } from 'react';
import type { Child } from 'subsonic-api';
import {
  Box,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import MoreVert from '@mui/icons-material/MoreVert';
import Star from '@mui/icons-material/Star';
import StarBorder from '@mui/icons-material/StarBorder';
import { useT } from '@asmusic/i18n';
import { formatDuration, type LibraryArtworkCacheRow, type SubsonicAPI } from '@asmusic/core';
import { CoverArtThumb } from './CoverArtThumb';

export function SongItem({
  track,
  coverArtId,
  api,
  resolveCachedArtwork,
  artworkCacheBump,
  includeAlbumInSecondary,
  secondaryContent,
  showRemoveButton,
  onRemove,
  onClick,
  onPlayNext,
  onAppendToQueue,
  isStarred,
  onToggleStar,
}: {
  track: Child;
  coverArtId?: string;
  /** When null (e.g. server removed), cover art falls back to a placeholder. */
  api: SubsonicAPI | null;
  resolveCachedArtwork: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  artworkCacheBump: number;
  /** When false (e.g. album track list), secondary line omits album title. */
  includeAlbumInSecondary: boolean;
  /** When set, replaces the default artist/album/duration secondary line. */
  secondaryContent?: ReactNode;
  /** When true and `onRemove` is set, shows a trash action (offline downloads, etc.). */
  showRemoveButton?: boolean;
  onRemove?: () => void;
  /** Primary tap: play this track immediately after the current item (queue-preserving). */
  onClick?: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  /** When set with `onToggleStar`, shows a favorites control. */
  isStarred?: boolean;
  onToggleStar?: () => void | Promise<void>;
}) {
  const t = useT();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [starBusy, setStarBusy] = useState(false);
  const showQueueMenu = Boolean(onPlayNext || onAppendToQueue);
  const showStar = Boolean(onToggleStar) && isStarred != null;

  const secondary =
    secondaryContent ??
    (includeAlbumInSecondary ? (
      <>
        {[track.artist, track.album].filter(Boolean).join(' · ') || '—'}
        {track.duration != null && track.duration > 0 ? ` · ${formatDuration(track.duration)}` : ''}
      </>
    ) : (
      <>
        {track.artist ?? '—'}
        {track.duration != null && track.duration > 0 ? ` · ${formatDuration(track.duration)}` : ''}
      </>
    ));

  const row = (
    <>
      <ListItemAvatar sx={{ minWidth: 48 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: 'hidden' }}>
          {api ? (
            <CoverArtThumb
              api={api}
              coverArtId={coverArtId}
              resolveCachedArtwork={resolveCachedArtwork}
              artworkCacheBump={artworkCacheBump}
              size={48}
              label=""
              sx={{ width: 40, height: 40 }}
            />
          ) : (
            <Box sx={{ width: 40, height: 40, bgcolor: 'action.hover' }} aria-hidden />
          )}
        </Box>
      </ListItemAvatar>
      <ListItemText
        primary={track.title ?? '—'}
        secondary={secondary}
        sx={{ minWidth: 0 }}
        slotProps={{
          primary: { variant: 'body2', noWrap: true },
          secondary: { variant: 'caption', noWrap: secondaryContent == null },
        }}
      />
    </>
  );

  const openMenu = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const queueMenu = showQueueMenu ? (
    <>
      <IconButton edge="end" aria-label={t('player.action.songActions')} size="small" onClick={openMenu}>
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {onPlayNext ? (
          <MenuItem
            onClick={() => {
              onPlayNext();
              setMenuAnchor(null);
            }}
          >
            {t('player.action.playNext')}
          </MenuItem>
        ) : null}
        {onAppendToQueue ? (
          <MenuItem
            onClick={() => {
              onAppendToQueue();
              setMenuAnchor(null);
            }}
          >
            {t('player.action.addToQueue')}
          </MenuItem>
        ) : null}
      </Menu>
    </>
  ) : undefined;

  const deleteBtn =
    showRemoveButton && onRemove ? (
      <IconButton
        edge="end"
        aria-label={t('player.offline.removeDownload')}
        size="small"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
      >
        <Delete fontSize="small" />
      </IconButton>
    ) : null;

  const starBtn =
    showStar && onToggleStar ? (
      <Tooltip title={isStarred ? t('player.favorite.remove') : t('player.favorite.add')}>
        <span>
          <IconButton
            edge="end"
            size="small"
            aria-label={isStarred ? t('player.favorite.remove') : t('player.favorite.add')}
            aria-pressed={isStarred}
            disabled={starBusy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setStarBusy(true);
              void Promise.resolve(onToggleStar()).finally(() => setStarBusy(false));
            }}
          >
            {isStarred ? <Star fontSize="small" color="warning" /> : <StarBorder fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    ) : null;

  const endActions =
    starBtn || deleteBtn || showQueueMenu ? (
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 0.25, pr: 0.5 }}>
        {starBtn}
        {deleteBtn}
        {showQueueMenu ? queueMenu : null}
      </Box>
    ) : undefined;

  if (onClick && !endActions) {
    return (
      <ListItemButton divider onClick={onClick} sx={{ py: 0.75, px: 0, alignItems: 'flex-start' }}>
        {row}
      </ListItemButton>
    );
  }

  if (endActions) {
    return (
      <ListItem divider disablePadding sx={{ alignItems: 'flex-start', gap: 0.25 }}>
        {onClick ? (
          <ListItemButton onClick={onClick} sx={{ py: 0.75, pr: 0.5, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
            {row}
          </ListItemButton>
        ) : (
          <Box sx={{ py: 0.75, pl: 0, pr: 0.5, flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}>
            {row}
          </Box>
        )}
        {endActions}
      </ListItem>
    );
  }

  return (
    <ListItem divider disablePadding sx={{ py: 0.75, px: 0 }}>
      {row}
    </ListItem>
  );
}
