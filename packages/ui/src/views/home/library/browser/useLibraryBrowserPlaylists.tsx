import { useT } from '@asmusic/i18n';
import { useCallback, useState, type JSX } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { Child, SubsonicAPI } from 'subsonic-api';
import { useLibraryBrowseCache, type LibraryBrowseScopeRow, type PlaylistCatalogRow } from '../../../../contexts/LibraryBrowseCacheContext';
import type { LibraryBrowserResolvedPlaylist } from './useLibraryBrowserResolvedScopes';

type PlaylistEditorTarget = {
  serverId: string;
  libraryId: string;
  playlistId: string;
  playlistName: string;
  cachedSongs: Child[];
  api: SubsonicAPI;
};

/**
 * Playlist create, edit, and delete actions for {@link LibraryBrowser}.
 */
export function useLibraryBrowserPlaylists(options: {
  scopesCount: number;
  singleSlice: LibraryBrowseScopeRow | null;
  resolvedPlaylist: LibraryBrowserResolvedPlaylist | null;
  playlistHeaderTitle: string;
  playlistDetailApi: SubsonicAPI | null;
  onAfterPlaylistDeleted: () => void;
}) {
  const {
    scopesCount,
    singleSlice,
    resolvedPlaylist,
    playlistHeaderTitle,
    playlistDetailApi,
    onAfterPlaylistDeleted,
  } = options;
  const { createPlaylist, deletePlaylist, updatePlaylistMembership } = useLibraryBrowseCache();

  const [playlistEditorTarget, setPlaylistEditorTarget] = useState<PlaylistEditorTarget | null>(null);
  const [playlistDetailReloadToken, setPlaylistDetailReloadToken] = useState(0);
  const [playlistDeleteConfirmOpen, setPlaylistDeleteConfirmOpen] = useState(false);
  const [playlistDeletePending, setPlaylistDeletePending] = useState(false);
  const [playlistDeleteError, setPlaylistDeleteError] = useState<string | null>(null);

  const canCreatePlaylist = scopesCount === 1 && singleSlice != null;

  const handleCreatePlaylist = useCallback(
    async (name: string) => {
      if (!singleSlice) throw new Error('Select a single library to create playlists');
      await createPlaylist({
        serverId: singleSlice.serverId,
        libraryId: singleSlice.libraryId,
        name,
      });
    },
    [singleSlice, createPlaylist]
  );

  const handleDeletePlaylistRow = useCallback(
    async (row: PlaylistCatalogRow) => {
      await deletePlaylist({
        serverId: row.serverId,
        libraryId: row.libraryId,
        playlistId: row.playlist.id,
      });
    },
    [deletePlaylist]
  );

  const closePlaylistEditor = useCallback(() => setPlaylistEditorTarget(null), []);

  const openPlaylistEditor = useCallback(() => {
    if (!resolvedPlaylist || !playlistDetailApi) return;
    setPlaylistEditorTarget({
      serverId: resolvedPlaylist.slice.serverId,
      libraryId: resolvedPlaylist.slice.libraryId,
      playlistId: resolvedPlaylist.subsonicPlaylistId,
      playlistName: playlistHeaderTitle,
      cachedSongs: resolvedPlaylist.slice.songs,
      api: playlistDetailApi,
    });
  }, [resolvedPlaylist, playlistDetailApi, playlistHeaderTitle]);

  const savePlaylistEditor = useCallback(
    async (diff: { songIdsToAdd: string[]; songIndexesToRemove: number[] }) => {
      if (!playlistEditorTarget) return;
      await updatePlaylistMembership({
        serverId: playlistEditorTarget.serverId,
        libraryId: playlistEditorTarget.libraryId,
        playlistId: playlistEditorTarget.playlistId,
        songIdsToAdd: diff.songIdsToAdd,
        songIndexesToRemove: diff.songIndexesToRemove,
      });
      setPlaylistDetailReloadToken((n) => n + 1);
    },
    [playlistEditorTarget, updatePlaylistMembership]
  );

  const requestDeletePlaylist = useCallback(() => {
    setPlaylistDeleteError(null);
    setPlaylistDeleteConfirmOpen(true);
  }, []);

  const closeDeletePlaylistDialog = useCallback(() => {
    if (!playlistDeletePending) setPlaylistDeleteConfirmOpen(false);
  }, [playlistDeletePending]);

  const handleDeleteCurrentPlaylist = useCallback(async () => {
    if (!resolvedPlaylist || playlistDeletePending) return;
    setPlaylistDeletePending(true);
    setPlaylistDeleteError(null);
    try {
      await deletePlaylist({
        serverId: resolvedPlaylist.slice.serverId,
        libraryId: resolvedPlaylist.slice.libraryId,
        playlistId: resolvedPlaylist.subsonicPlaylistId,
      });
      setPlaylistDeleteConfirmOpen(false);
      onAfterPlaylistDeleted();
    } catch (e) {
      setPlaylistDeleteError(e instanceof Error ? e.message : 'Could not delete playlist');
    } finally {
      setPlaylistDeletePending(false);
    }
  }, [resolvedPlaylist, playlistDeletePending, deletePlaylist, onAfterPlaylistDeleted]);

  return {
    playlistEditorTarget,
    playlistDetailReloadToken,
    canCreatePlaylist,
    handleCreatePlaylist,
    handleDeletePlaylistRow,
    closePlaylistEditor,
    openPlaylistEditor,
    savePlaylistEditor,
    requestDeletePlaylist,
    deletePlaylistDialogProps: {
      open: playlistDeleteConfirmOpen,
      playlistTitle: playlistHeaderTitle,
      error: playlistDeleteError,
      pending: playlistDeletePending,
      onClose: closeDeletePlaylistDialog,
      onConfirm: handleDeleteCurrentPlaylist,
    },
  };
}

export function LibraryBrowserPlaylistDeleteDialog(props: {
  open: boolean;
  playlistTitle: string;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}): JSX.Element {
  const t = useT();
  const { open, playlistTitle, error, pending, onClose, onConfirm } = props;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('library.playlist.deleteConfirmTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('library.playlist.deleteConfirmBody', { name: playlistTitle })}
        </DialogContentText>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button color="error" variant="contained" disabled={pending} onClick={() => void onConfirm()}>
          {pending ? t('common.deleting') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
