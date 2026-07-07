import { useState } from 'react';
import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import MoreVert from '@mui/icons-material/MoreVert';
import { useI18n, useT } from '@asmusic/i18n';
import {
  useLibraryBrowseCache,
  type PlaylistCatalogRow,
} from '@ui/contexts/LibraryBrowseCacheContext';

export function PlaylistListViewRow({
  row,
  multiLibrary,
  onOpen,
  onDeleteClick,
}: {
  row: PlaylistCatalogRow;
  multiLibrary: boolean;
  onOpen: (row: PlaylistCatalogRow) => void;
  onDeleteClick: (row: PlaylistCatalogRow) => void;
}) {
  const t = useT();
  const { format } = useI18n();
  const { serverDisplayName } = useLibraryBrowseCache();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const count = row.playlist.songCount;
  const songCountLabel = format.count(count, {
    one: t('word.song'),
    other: t('word.songs'),
  });
  const secondary =
    row.kind === 'local'
      ? `${songCountLabel} · ${t('library.playlist.onDevice')}`
      : multiLibrary
        ? `${songCountLabel} · ${serverDisplayName(row.serverId)}`
        : songCountLabel;

  return (
    <ListItem divider disablePadding sx={{ alignItems: 'center' }}>
      <ListItemButton
        onClick={() => onOpen(row)}
        sx={{ flex: 1, minWidth: 0, py: 0.75, px: 0, alignItems: 'flex-start' }}
      >
        <ListItemText
          primary={row.playlist.name}
          secondary={secondary}
          sx={{ flex: 1, minWidth: 0, my: 0 }}
          slotProps={{
            primary: { variant: 'body2', noWrap: true },
            secondary: { variant: 'caption', noWrap: true },
          }}
        />
      </ListItemButton>
      <Box sx={{ display: 'flex', flexShrink: 0, alignSelf: 'center', pr: 0.5 }}>
        <Tooltip title={t('library.playlist.actions')}>
          <IconButton
            size="small"
            edge="end"
            aria-label={t('library.playlist.actions')}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDeleteClick(row);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemText>{t('library.playlist.delete')}</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </ListItem>
  );
}
