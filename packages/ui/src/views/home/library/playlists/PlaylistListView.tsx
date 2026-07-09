import { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import {
  useLibraryBrowseCache,
  type PlaylistCatalogRow,
} from '@ui/contexts/LibraryBrowseCacheContext';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { playlistMatchesQuery } from './playlistListFilter';
import {
  PlaylistListViewCreateDialog,
  type CreatePlaylistType,
} from './PlaylistListViewCreateDialog';
import { PlaylistListViewDeleteDialog } from './PlaylistListViewDeleteDialog';
import { PlaylistListViewList } from './PlaylistListViewList';
import { PlaylistListViewStatus } from './PlaylistListViewStatus';
import { PlaylistListViewToolbar } from './PlaylistListViewToolbar';
import type { CreatePlaylistRequest } from '@ui/views/home/library/browser/useLibraryBrowserPlaylists';

export type ServerCreateOption = {
  serverId: string;
  serverUrl: string;
  username: string;
};

export function PlaylistListView({
  rows,
  multiLibrary,
  initialReady,
  canCreateServerPlaylist,
  canCreateLocalPlaylist,
  multiServer,
  serversToCreateOn,
  onPlaylistOpen,
  onCreatePlaylist,
  onDeletePlaylist,
}: {
  rows: PlaylistCatalogRow[];
  multiLibrary: boolean;
  initialReady: boolean;
  canCreateServerPlaylist: boolean;
  canCreateLocalPlaylist: boolean;
  multiServer: boolean;
  serversToCreateOn: ServerCreateOption[];
  onPlaylistOpen: (row: PlaylistCatalogRow) => void;
  onCreatePlaylist: (request: CreatePlaylistRequest) => Promise<void>;
  onDeletePlaylist: (row: PlaylistCatalogRow) => Promise<void>;
}) {
  const { serverDisplayName } = useLibraryBrowseCache();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createType, setCreateType] = useState<CreatePlaylistType>(
    multiLibrary ? 'local' : 'server'
  );
  const [selectedServerId, setSelectedServerId] = useState<string>(
    serversToCreateOn[0]?.serverId ?? ''
  );
  const [pendingDelete, setPendingDelete] = useState<PlaylistCatalogRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreateAny = canCreateServerPlaylist || canCreateLocalPlaylist;

  const filteredRows = useMemo(
    () => rows.filter((r) => playlistMatchesQuery(r, search)),
    [rows, search]
  );

  const queryTrimmed = search.trim();
  const showList = initialReady && filteredRows.length > 0;

  const handleCreateClick = () => {
    if (!canCreateAny) return;
    setCreateError(null);
    setNewName('');
    setCreateType(multiLibrary ? 'local' : canCreateServerPlaylist ? 'server' : 'local');
    setSelectedServerId(serversToCreateOn[0]?.serverId ?? '');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError('Playlist name cannot be empty.');
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      if (createType === 'local') {
        await onCreatePlaylist({ kind: 'local', name });
      } else {
        const serverId = multiServer ? selectedServerId : serversToCreateOn[0]?.serverId;
        if (!serverId) throw new Error('Select a server for the playlist');
        await onCreatePlaylist({
          kind: 'server',
          name,
          serverId,
        });
      }
      setCreateOpen(false);
      setNewName('');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create playlist');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDeleteClick = (row: PlaylistCatalogRow) => {
    setDeleteError(null);
    setPendingDelete(row);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDeletePlaylist(pendingDelete);
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete playlist');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Box
      role="tabpanel"
      id="library-panel-playlists"
      aria-labelledby="library-tab-playlists"
      sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <PlaylistListViewToolbar search={search} onSearchChange={setSearch} onCreateClick={handleCreateClick} />

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        <PlaylistListViewStatus
          initialReady={initialReady}
          rowCount={rows.length}
          filteredCount={filteredRows.length}
          queryTrimmed={queryTrimmed}
        />
        {showList && (
          <PlaylistListViewList
            rows={filteredRows}
            multiLibrary={multiLibrary}
            search={search}
            onPlaylistOpen={onPlaylistOpen}
            onDeleteClick={handleDeleteClick}
          />
        )}
      </Box>

      <PlaylistListViewCreateDialog
        open={createOpen}
        name={newName}
        busy={createBusy}
        error={createError}
        createType={createType}
        selectedServerId={selectedServerId}
        multiServer={multiServer}
        canCreateServer={canCreateServerPlaylist}
        canCreateLocal={canCreateLocalPlaylist}
        serversToCreateOn={serversToCreateOn}
        serverDisplayName={serverDisplayName}
        onClose={() => setCreateOpen(false)}
        onNameChange={setNewName}
        onCreateTypeChange={setCreateType}
        onServerChange={setSelectedServerId}
        onSubmit={() => void handleCreate()}
      />

      <PlaylistListViewDeleteDialog
        open={pendingDelete != null}
        playlistName={pendingDelete?.playlist.name}
        busy={deleteBusy}
        error={deleteError}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </Box>
  );
}
