import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useT } from '@asmusic/i18n';

export function PlaylistListViewDeleteDialog({
  open,
  playlistName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  playlistName: string | undefined;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{t('library.playlist.deleteConfirmTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('library.playlist.deleteConfirmBody', {
            name: playlistName ?? t('library.playlist.deleteFallbackName'),
          })}
        </DialogContentText>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>
          {busy ? t('common.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
