import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useT } from '@asmusic/i18n';

/** Explains why server playlist create/edit needs one active library (see root NOTE.md). */
export function PlaylistSingleLibraryRequiredDialog({
  open,
  onClose,
  multiLibrary,
}: {
  open: boolean;
  onClose: () => void;
  multiLibrary: boolean;
}) {
  const t = useT();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('library.playlist.createSingleLibraryTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {multiLibrary
            ? t('library.playlist.createSingleLibraryBodyMulti')
            : t('library.playlist.createSingleLibraryBodyNoServer')}
        </DialogContentText>
        {multiLibrary && (
          <DialogContentText sx={{ mt: 2 }}>
            {t('library.playlist.createSingleLibraryBodyFuture')}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t('common.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
