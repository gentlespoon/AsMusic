import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useT } from '@asmusic/i18n';

export function PlaylistListViewCreateDialog({
  open,
  name,
  busy,
  error,
  onClose,
  onNameChange,
  onSubmit,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{t('library.playlist.createDialogTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('library.playlist.createDialogHint')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label={t('library.playlist.nameLabel')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
        />
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
        <Button variant="contained" onClick={onSubmit} disabled={busy}>
          {busy ? t('common.creating') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
