import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import { useI18n, useT } from '@asmusic/i18n';
import {
  useLibraryBrowseCache,
  type PlaylistCatalogRow,
} from '../../../../contexts/LibraryBrowseCacheContext';

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
  const { libraryDisplayName } = useLibraryBrowseCache();

  const count = row.playlist.songCount;
  const songCountLabel = format.count(count, {
    one: t('word.song'),
    other: t('word.songs'),
  });
  const secondary = multiLibrary
    ? `${songCountLabel} · ${libraryDisplayName(row.serverId, row.libraryId)}`
    : songCountLabel;

  return (
    <ListItem
      disablePadding
      divider
      secondaryAction={
        <Tooltip title={t('library.playlist.delete')}>
          <IconButton
            size="small"
            edge="end"
            aria-label={t('library.playlist.deleteAria', { name: row.playlist.name })}
            onClick={() => onDeleteClick(row)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemButton onClick={() => onOpen(row)} sx={{ py: 0.75, px: 0 }}>
        <ListItemText
          primary={row.playlist.name}
          secondary={secondary}
          slotProps={{
            primary: { variant: 'body2', noWrap: true },
            secondary: { variant: 'caption', noWrap: true },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}
