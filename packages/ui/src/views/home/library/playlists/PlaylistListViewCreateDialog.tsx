import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useT } from '@asmusic/i18n';
import type { CreatePlaylistRequest } from '@ui/views/home/library/browser/useLibraryBrowserPlaylists';
import type { ServerCreateOption } from './PlaylistListView';

export type CreatePlaylistType = CreatePlaylistRequest['kind'];

export function PlaylistListViewCreateDialog({
  open,
  name,
  busy,
  error,
  createType,
  selectedServerId,
  multiServer,
  canCreateServer,
  canCreateLocal,
  serversToCreateOn,
  serverDisplayName,
  onClose,
  onNameChange,
  onCreateTypeChange,
  onServerChange,
  onSubmit,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  createType: CreatePlaylistType;
  selectedServerId: string;
  multiServer: boolean;
  canCreateServer: boolean;
  canCreateLocal: boolean;
  serversToCreateOn: ServerCreateOption[];
  serverDisplayName: (serverId: string) => string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onCreateTypeChange: (value: CreatePlaylistType) => void;
  onServerChange: (serverId: string) => void;
  onSubmit: () => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{t('library.playlist.createDialogTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('library.playlist.createDialogHint')}</DialogContentText>
        <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
          <RadioGroup
            value={createType}
            onChange={(e) => onCreateTypeChange(e.target.value as CreatePlaylistType)}
          >
            <FormControlLabel
              value="server"
              control={<Radio size="small" />}
              disabled={!canCreateServer}
              label={t('library.playlist.createTypeServer')}
            />
            <FormControlLabel
              value="local"
              control={<Radio size="small" />}
              disabled={!canCreateLocal}
              label={t('library.playlist.createTypeLocal')}
            />
          </RadioGroup>
          {createType === 'local' && (
            <FormHelperText>{t('library.playlist.createTypeLocalHint')}</FormHelperText>
          )}
        </FormControl>
        {createType === 'server' && multiServer && serversToCreateOn.length > 1 && (
          <TextField
            select
            fullWidth
            size="small"
            label={t('library.playlist.createServerLabel')}
            value={selectedServerId}
            onChange={(e) => onServerChange(e.target.value)}
            disabled={busy}
            sx={{ mb: 2 }}
          >
            {serversToCreateOn.map((server) => (
              <MenuItem key={server.serverId} value={server.serverId}>
                {serverDisplayName(server.serverId)}
              </MenuItem>
            ))}
          </TextField>
        )}
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
