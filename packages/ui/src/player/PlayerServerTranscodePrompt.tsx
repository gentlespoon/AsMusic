import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useT } from '@asmusic/i18n';
import { useEffect, useState } from 'react';
import {
  usePlayerActions,
  usePlayerServerTranscodePrompt,
} from '@ui/contexts/PlayerContext';

export function PlayerServerTranscodePrompt() {
  const t = useT();
  const prompt = usePlayerServerTranscodePrompt();
  const { enableServerTranscodeAndRetry, dismissServerTranscodePrompt } =
    usePlayerActions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prompt) {
      setOpen(true);
      setBusy(false);
    } else {
      setOpen(false);
    }
  }, [prompt]);

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
    dismissServerTranscodePrompt();
  };

  const handleEnable = () => {
    setBusy(true);
    void enableServerTranscodeAndRetry().finally(() => {
      setBusy(false);
      setOpen(false);
    });
  };

  const title = prompt?.title.trim() || t('player.playback.thisTrack');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('player.playback.enableServerTranscodeTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('player.playback.enableServerTranscodeBody', { title })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          {t('player.playback.enableServerTranscodeNotNow')}
        </Button>
        <Button variant="contained" onClick={handleEnable} disabled={busy}>
          {t('player.playback.enableServerTranscodeEnable')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
