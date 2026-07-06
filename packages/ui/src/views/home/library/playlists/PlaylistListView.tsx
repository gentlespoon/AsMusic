import { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import {
  useLibraryBrowseCache,
  type LibraryBrowseScopeRow,
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

export function PlaylistListView({
  rows,
  multiLibrary,
  initialReady,
  syncing,
  canCreateServerPlaylist,
  canCreateLocalPlaylist,
  scopesToLoad,
  singleSlice,
  onPlaylistOpen,
  onCreatePlaylist,
  onDeletePlaylist,
}: {
  rows: PlaylistCatalogRow[];
  multiLibrary: boolean;
  initialReady: boolean;
  syncing: boolean;
  canCreateServerPlaylist: boolean;
  canCreateLocalPlaylist: boolean;
  scopesToLoad: LibraryBrowseScopeRow[];
  singleSlice: LibraryBrowseScopeRow | null;
  onPlaylistOpen: (row: PlaylistCatalogRow) => void;
  onCreatePlaylist: (request: CreatePlaylistRequest) => Promise<void>;
  onDeletePlaylist: (row: PlaylistCatalogRow) => Promise<void>;
}) {
  const { libraryDisplayName } = useLibraryBrowseCache();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createType, setCreateType] = useState<CreatePlaylistType>(
    multiLibrary ? 'local' : 'server'
  );
  const [selectedServerScope, setSelectedServerScope] = useState<LibraryBrowseScopeRow | null>(
    singleSlice ?? scopesToLoad[0] ?? null
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
    setSelectedServerScope(singleSlice ?? scopesToLoad[0] ?? null);
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
        const scope = multiLibrary ? selectedServerScope : singleSlice;
        if (!scope) throw new Error('Select a library for the server playlist');
        await onCreatePlaylist({
          kind: 'server',
          name,
          serverId: scope.serverId,
          libraryId: scope.libraryId,
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
          syncing={syncing}
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
        selectedServerScope={selectedServerScope}
        multiLibrary={multiLibrary}
        canCreateServer={canCreateServerPlaylist}
        canCreateLocal={canCreateLocalPlaylist}
        scopesToLoad={scopesToLoad}
        libraryDisplayName={libraryDisplayName}
        onClose={() => setCreateOpen(false)}
        onNameChange={setNewName}
        onCreateTypeChange={setCreateType}
        onServerScopeChange={setSelectedServerScope}
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
