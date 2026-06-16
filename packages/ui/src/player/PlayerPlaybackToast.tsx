import Snackbar from '@mui/material/Snackbar';
import { useT } from '@asmusic/i18n';
import { useEffect, useState } from 'react';
import { usePlayerToast } from '../contexts/PlayerContext';

export function PlayerPlaybackToast() {
  const t = useT();
  const toast = usePlayerToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!toast) return;
    const title = toast.params.title.trim() || t('player.playback.thisTrack');
    setMessage(
      t('player.playback.skippedOnFailure', {
        title,
        error: toast.params.error,
      })
    );
    setOpen(true);
  }, [toast, t]);

  return (
    <Snackbar
      key={toast?.id}
      open={open}
      autoHideDuration={4000}
      onClose={() => setOpen(false)}
      message={message}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
}
