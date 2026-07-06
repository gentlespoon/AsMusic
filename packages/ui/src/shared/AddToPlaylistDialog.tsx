import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useI18n, useT } from '@asmusic/i18n';
import type { PlaylistCatalogRow } from '@ui/contexts/LibraryBrowseCacheContext';

export function AddToPlaylistDialog({
  open,
  playlists,
  loading,
  error,
  onClose,
  onPick,
}: {
  open: boolean;
  playlists: PlaylistCatalogRow[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onPick: (row: PlaylistCatalogRow) => void;
}) {
  const t = useT();
  const { format } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth disableScrollLock>
      <DialogTitle>{t('player.addToPlaylist.dialogTitle')}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            {t('player.addToPlaylist.loading')}
          </Typography>
        )}
        {error && (
          <Typography variant="body2" color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        )}
        {!loading && !error && playlists.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('player.addToPlaylist.empty')}
          </Typography>
        )}
        {!loading && playlists.length > 0 && (
          <List disablePadding>
            {playlists.map((row) => (
              <ListItemButton
                key={row.rowKey}
                divider
                onClick={() => {
                  onPick(row);
                  onClose();
                }}
              >
                <ListItemText
                  primary={row.playlist.name}
                  secondary={
                    row.kind === 'local'
                      ? `${format.count(row.playlist.songCount, {
                          one: t('word.song'),
                          other: t('word.songs'),
                        })} · ${t('library.playlist.onDevice')}`
                      : format.count(row.playlist.songCount, {
                          one: t('word.song'),
                          other: t('word.songs'),
                        })
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
