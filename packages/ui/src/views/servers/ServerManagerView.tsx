import { useState } from 'react';
import { useT } from '@asmusic/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import LibraryMusic from '@mui/icons-material/LibraryMusic';
import { getApiBase } from '@asmusic/core';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { SettingsSectionHeader } from '@ui/views/settings/SettingsTypography';
import { useServerAndLibrary } from '@ui/contexts';

export type ServerManagerViewProps = {
  /** Omit page chrome (title bar close, cross-links) when shown inside Settings tabs */
  embedded?: boolean;
};

export function ServerManagerView({ embedded = false }: ServerManagerViewProps) {
  const t = useT();
  const navigate = useNavigate();
  const { servers, addServer, updateServer, removeServer } = useServerAndLibrary();
  const [serverUrl, setServerUrl] = useState(getApiBase());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editUser, setEditUser] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addServer(serverUrl, username, password);
    setLoading(false);
    if (result.ok) {
      setPassword('');
      setUsername('');
    } else {
      setError(result.error ?? t('servers.error.addFailed'));
    }
  }

  function openEdit(s: { id: string; serverUrl: string; username: string }) {
    setEditingId(s.id);
    setEditUrl(s.serverUrl);
    setEditUser(s.username);
    setEditPassword('');
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setEditError(null);
    setEditLoading(true);
    const result = await updateServer(
      editingId,
      editUrl,
      editUser,
      editPassword.length > 0 ? editPassword : undefined
    );
    setEditLoading(false);
    if (result.ok) {
      setEditOpen(false);
      setEditingId(null);
    } else {
      setEditError(result.error ?? t('servers.error.updateFailed'));
    }
  }

  return (
    <Box
      sx={
        embedded
          ? undefined
          : {
              minHeight:
                'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
            }
      }
    >
      <Container maxWidth={embedded ? false : 'sm'} sx={{ py: embedded ? 0 : 3, flex: 1, px: embedded ? 0 : undefined }}>
        {!embedded && (
          <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              {t('servers.manager.title')}
            </Typography>
            <PageCloseButton edge="end" onClick={() => navigate('/')} />
          </Stack>
        )}

        <SettingsSectionHeader sx={{ mb: 2 }}>
          {t('servers.manager.savedCount', { count: servers.length })}
        </SettingsSectionHeader>
        {servers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('servers.manager.empty')}
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <List dense disablePadding>
              {servers.map((s) => (
                <ListItem key={s.id} divider>
                  <ListItemText
                    primary={s.serverUrl}
                    secondary={s.username}
                    slotProps={{ primary: { sx: { wordBreak: 'break-all' } } }}
                  />
                  <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                    <Tooltip title={t('servers.manager.editServer')}>
                      <IconButton size="small" edge="end" aria-label={t('servers.manager.editServer')} onClick={() => openEdit(s)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('servers.manager.removeServer')}>
                      <IconButton
                        size="small"
                        edge="end"
                        color="error"
                        aria-label={t('servers.manager.removeServer')}
                        onClick={() => void removeServer(s.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {!embedded && (
          <Tooltip title={t('servers.manager.chooseLibraries')}>
            <IconButton
              color="primary"
              aria-label={t('servers.manager.chooseLibraries')}
              sx={{ mt: 2, alignSelf: 'flex-start' }}
              onClick={() => navigate('/settings/servers-libraries?tab=libraries')}
            >
              <LibraryMusic />
            </IconButton>
          </Tooltip>
        )}

       
        <SettingsSectionHeader sx={{ my: 2 }}>{t('servers.manager.newServer')}</SettingsSectionHeader>

        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <SettingsSectionHeader sx={{ mb: 1.5 }}>{t('servers.manager.addServer')}</SettingsSectionHeader>
          <Stack component="form" spacing={1.5} onSubmit={handleAdd}>
            <TextField
              label={t('servers.manager.serverUrl')}
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={t('servers.manager.serverUrlPlaceholder')}
              required
              autoComplete="url"
              fullWidth
              size="small"
            />
            <TextField
              label={t('servers.manager.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              fullWidth
              size="small"
            />
            <TextField
              label={t('servers.manager.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              fullWidth
              size="small"
            />
            {error && (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            )}
            <Button type="submit" variant="contained" disabled={loading} size="small" sx={{ alignSelf: 'flex-start' }}>
              {loading ? t('common.saving') : t('servers.manager.addServer')}
            </Button>
          </Stack>
        </Paper>

      </Container>

      <Dialog open={editOpen} onClose={() => !editLoading && setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('servers.manager.editServer')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label={t('servers.manager.serverUrl')}
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField label={t('servers.manager.username')} value={editUser} onChange={(e) => setEditUser(e.target.value)} fullWidth size="small" />
            <TextField
              label={t('servers.manager.newPassword')}
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              fullWidth
              size="small"
              helperText={t('servers.manager.passwordKeep')}
            />
            {editError && (
              <Alert severity="error" role="alert">
                {editError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleSaveEdit()} variant="contained" disabled={editLoading}>
            {editLoading ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
