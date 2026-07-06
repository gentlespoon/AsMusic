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
import type { LibraryBrowseScopeRow } from '@ui/contexts/LibraryBrowseCacheContext';
import type { CreatePlaylistRequest } from '@ui/views/home/library/browser/useLibraryBrowserPlaylists';

export type CreatePlaylistType = CreatePlaylistRequest['kind'];

export function PlaylistListViewCreateDialog({
  open,
  name,
  busy,
  error,
  createType,
  selectedServerScope,
  multiLibrary,
  canCreateServer,
  canCreateLocal,
  scopesToLoad,
  libraryDisplayName,
  onClose,
  onNameChange,
  onCreateTypeChange,
  onServerScopeChange,
  onSubmit,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  createType: CreatePlaylistType;
  selectedServerScope: LibraryBrowseScopeRow | null;
  multiLibrary: boolean;
  canCreateServer: boolean;
  canCreateLocal: boolean;
  scopesToLoad: LibraryBrowseScopeRow[];
  libraryDisplayName: (serverId: string, libraryId: string) => string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onCreateTypeChange: (value: CreatePlaylistType) => void;
  onServerScopeChange: (scope: LibraryBrowseScopeRow) => void;
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
          {createType === 'server' && multiLibrary && !canCreateServer && (
            <FormHelperText>{t('library.playlist.createServerPickLibraryHint')}</FormHelperText>
          )}
          {createType === 'local' && (
            <FormHelperText>{t('library.playlist.createTypeLocalHint')}</FormHelperText>
          )}
        </FormControl>
        {createType === 'server' && multiLibrary && scopesToLoad.length > 1 && (
          <TextField
            select
            fullWidth
            size="small"
            label={t('library.playlist.createLibraryLabel')}
            value={selectedServerScope ? `${selectedServerScope.serverId}|${selectedServerScope.libraryId}` : ''}
            onChange={(e) => {
              const [serverId, libraryId] = e.target.value.split('|');
              const scope = scopesToLoad.find((s) => s.serverId === serverId && s.libraryId === libraryId);
              if (scope) onServerScopeChange(scope);
            }}
            disabled={busy}
            sx={{ mb: 2 }}
          >
            {scopesToLoad.map((scope) => (
              <MenuItem key={`${scope.serverId}|${scope.libraryId}`} value={`${scope.serverId}|${scope.libraryId}`}>
                {libraryDisplayName(scope.serverId, scope.libraryId)}
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
