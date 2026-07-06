import Snackbar from '@mui/material/Snackbar';
import { useT } from '@asmusic/i18n';
import { useEffect, useState } from 'react';
import { usePlayerToast } from '@ui/contexts/PlayerContext';
import { DisabledLibraryToastContent } from '@ui/shared/DisabledLibraryToastContent';

export function PlayerPlaybackToast() {
  const t = useT();
  const toast = usePlayerToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [disabledLibrary, setDisabledLibrary] = useState<{
    serverName: string;
    libraryName: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (toast.messageKey === 'player.playback.skippedLibraryDisabled') {
      setMessage(null);
      setDisabledLibrary({
        serverName: toast.params.serverName,
        libraryName: toast.params.libraryName,
      });
    } else {
      setDisabledLibrary(null);
      const title = toast.params.title.trim() || t('player.playback.thisTrack');
      setMessage(
        t('player.playback.skippedOnFailure', {
          title,
          error: toast.params.error,
        })
      );
    }
    setOpen(true);
  }, [toast, t]);

  return (
    <Snackbar
      key={toast?.id}
      open={open}
      autoHideDuration={4000}
      onClose={() => setOpen(false)}
      message={
        disabledLibrary ? (
          <DisabledLibraryToastContent
            serverName={disabledLibrary.serverName}
            libraryName={disabledLibrary.libraryName}
            titleKey="player.playback.skippedLibraryDisabledTitle"
          />
        ) : (
          message
        )
      }
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
}
