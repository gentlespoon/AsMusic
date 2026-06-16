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
import {
  localPlaylistRefFromKey,
  localPlaylistTrackRefFromChild,
} from '@asmusic/core';
import {
  useLibraryBrowseCache,
  type LibraryBrowseScopeRow,
  type PlaylistCatalogRow,
} from '../../../../contexts/LibraryBrowseCacheContext';
import type { SongListEntry } from '../catalog/SongListView';
import type { LibraryBrowserResolvedPlaylist } from './useLibraryBrowserResolvedScopes';

type ServerPlaylistEditorTarget = {
  kind: 'server';
  serverId: string;
  libraryId: string;
  playlistId: string;
  playlistName: string;
  cachedSongs: Child[];
  api: SubsonicAPI;
};

type LocalPlaylistEditorTarget = {
  kind: 'local';
  playlistId: string;
  playlistName: string;
  songEntries: SongListEntry[];
};

export type PlaylistEditorTarget = ServerPlaylistEditorTarget | LocalPlaylistEditorTarget;

export type CreatePlaylistRequest =
  | { kind: 'server'; name: string; serverId: string; libraryId: string }
  | { kind: 'local'; name: string };

/**
 * Playlist create, edit, and delete actions for {@link LibraryBrowser}.
 */
export function useLibraryBrowserPlaylists(options: {
  scopesToLoad: LibraryBrowseScopeRow[];
  singleSlice: LibraryBrowseScopeRow | null;
  songEntries: SongListEntry[];
  resolvedPlaylist: LibraryBrowserResolvedPlaylist | null;
  playlistHeaderTitle: string;
  playlistDetailApi: SubsonicAPI | null;
  onAfterPlaylistDeleted: () => void;
}) {
  const {
    scopesToLoad,
    singleSlice,
    songEntries,
    resolvedPlaylist,
    playlistHeaderTitle,
    playlistDetailApi,
    onAfterPlaylistDeleted,
  } = options;
  const {
    createPlaylist,
    deletePlaylist,
    updatePlaylistMembership,
    createLocalPlaylist,
    deleteLocalPlaylist,
    updateLocalPlaylistMembership,
    canCreateServerPlaylist,
    canCreateLocalPlaylist,
  } = useLibraryBrowseCache();

  const [playlistEditorTarget, setPlaylistEditorTarget] = useState<PlaylistEditorTarget | null>(null);
  const [playlistDetailReloadToken, setPlaylistDetailReloadToken] = useState(0);
  const [playlistDeleteConfirmOpen, setPlaylistDeleteConfirmOpen] = useState(false);
  const [playlistDeletePending, setPlaylistDeletePending] = useState(false);
  const [playlistDeleteError, setPlaylistDeleteError] = useState<string | null>(null);

  const handleCreatePlaylist = useCallback(
    async (request: CreatePlaylistRequest) => {
      if (request.kind === 'local') {
        await createLocalPlaylist(request.name);
        return;
      }
      await createPlaylist({
        serverId: request.serverId,
        libraryId: request.libraryId,
        name: request.name,
      });
    },
    [createLocalPlaylist, createPlaylist]
  );

  const handleDeletePlaylistRow = useCallback(
    async (row: PlaylistCatalogRow) => {
      if (row.kind === 'local') {
        await deleteLocalPlaylist(row.playlist.id);
        return;
      }
      await deletePlaylist({
        serverId: row.serverId,
        libraryId: row.libraryId,
        playlistId: row.playlist.id,
      });
    },
    [deleteLocalPlaylist, deletePlaylist]
  );

  const closePlaylistEditor = useCallback(() => setPlaylistEditorTarget(null), []);

  const openPlaylistEditor = useCallback(() => {
    if (!resolvedPlaylist) return;
    if (resolvedPlaylist.kind === 'local') {
      setPlaylistEditorTarget({
        kind: 'local',
        playlistId: resolvedPlaylist.localId,
        playlistName: playlistHeaderTitle,
        songEntries,
      });
      return;
    }
    if (!playlistDetailApi) return;
    setPlaylistEditorTarget({
      kind: 'server',
      serverId: resolvedPlaylist.slice.serverId,
      libraryId: resolvedPlaylist.slice.libraryId,
      playlistId: resolvedPlaylist.subsonicPlaylistId,
      playlistName: playlistHeaderTitle,
      cachedSongs: resolvedPlaylist.slice.songs,
      api: playlistDetailApi,
    });
  }, [resolvedPlaylist, playlistDetailApi, playlistHeaderTitle, songEntries]);

  const savePlaylistEditor = useCallback(
    async (diff: { songIdsToAdd: string[]; songIndexesToRemove: number[] }) => {
      if (!playlistEditorTarget) return;
      if (playlistEditorTarget.kind === 'local') {
        await updateLocalPlaylistMembership({
          playlistId: playlistEditorTarget.playlistId,
          songIdsToAdd: diff.songIdsToAdd,
          songIndexesToRemove: diff.songIndexesToRemove,
          resolveRefForNewId: (compositeKey) => {
            const parsed = localPlaylistRefFromKey(compositeKey);
            if (!parsed) return null;
            const entry = songEntries.find(
              (e) =>
                e.artworkScope.serverKey === parsed.serverKey &&
                e.artworkScope.libraryId === parsed.libraryId &&
                String(e.song.id) === parsed.trackId
            );
            if (!entry) return parsed;
            return localPlaylistTrackRefFromChild(entry.artworkScope, entry.song);
          },
        });
      } else {
        await updatePlaylistMembership({
          serverId: playlistEditorTarget.serverId,
          libraryId: playlistEditorTarget.libraryId,
          playlistId: playlistEditorTarget.playlistId,
          songIdsToAdd: diff.songIdsToAdd,
          songIndexesToRemove: diff.songIndexesToRemove,
        });
      }
      setPlaylistDetailReloadToken((n) => n + 1);
    },
    [playlistEditorTarget, updateLocalPlaylistMembership, updatePlaylistMembership, songEntries]
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
      if (resolvedPlaylist.kind === 'local') {
        await deleteLocalPlaylist(resolvedPlaylist.localId);
      } else {
        await deletePlaylist({
          serverId: resolvedPlaylist.slice.serverId,
          libraryId: resolvedPlaylist.slice.libraryId,
          playlistId: resolvedPlaylist.subsonicPlaylistId,
        });
      }
      setPlaylistDeleteConfirmOpen(false);
      onAfterPlaylistDeleted();
    } catch (e) {
      setPlaylistDeleteError(e instanceof Error ? e.message : 'Could not delete playlist');
    } finally {
      setPlaylistDeletePending(false);
    }
  }, [resolvedPlaylist, playlistDeletePending, deleteLocalPlaylist, deletePlaylist, onAfterPlaylistDeleted]);

  return {
    playlistEditorTarget,
    playlistDetailReloadToken,
    canCreateServerPlaylist,
    canCreateLocalPlaylist,
    scopesToLoad,
    singleSlice,
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
