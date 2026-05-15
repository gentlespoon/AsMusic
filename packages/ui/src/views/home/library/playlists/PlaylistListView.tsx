import { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import type { PlaylistCatalogRow } from '../../../../contexts/LibraryBrowseCacheContext';
import { libraryFlexFillSx } from '../../../../shared/LibraryVirtuosoFill';
import { PlaylistSingleLibraryRequiredDialog } from './PlaylistSingleLibraryRequiredDialog';
import { playlistMatchesQuery } from './playlistListFilter';
import { PlaylistListViewCreateDialog } from './PlaylistListViewCreateDialog';
import { PlaylistListViewDeleteDialog } from './PlaylistListViewDeleteDialog';
import { PlaylistListViewList } from './PlaylistListViewList';
import { PlaylistListViewStatus } from './PlaylistListViewStatus';
import { PlaylistListViewToolbar } from './PlaylistListViewToolbar';

export function PlaylistListView({
  rows,
  multiLibrary,
  initialReady,
  syncing,
  canCreatePlaylist,
  onPlaylistOpen,
  onCreatePlaylist,
  onDeletePlaylist,
}: {
  rows: PlaylistCatalogRow[];
  multiLibrary: boolean;
  initialReady: boolean;
  syncing: boolean;
  canCreatePlaylist: boolean;
  onPlaylistOpen: (row: PlaylistCatalogRow) => void;
  onCreatePlaylist: (name: string) => Promise<void>;
  onDeletePlaylist: (row: PlaylistCatalogRow) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [singleLibraryRequiredOpen, setSingleLibraryRequiredOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlaylistCatalogRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredRows = useMemo(
    () => rows.filter((r) => playlistMatchesQuery(r, search)),
    [rows, search]
  );

  const queryTrimmed = search.trim();
  const showList = initialReady && filteredRows.length > 0;

  const handleCreateClick = () => {
    if (!canCreatePlaylist) {
      setSingleLibraryRequiredOpen(true);
      return;
    }
    setCreateError(null);
    setNewName('');
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
      await onCreatePlaylist(name);
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
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PlaylistListViewToolbar
        search={search}
        onSearchChange={setSearch}
        onCreateClick={handleCreateClick}
      />

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

      <PlaylistSingleLibraryRequiredDialog
        open={singleLibraryRequiredOpen}
        onClose={() => setSingleLibraryRequiredOpen(false)}
        multiLibrary={multiLibrary}
      />

      <PlaylistListViewCreateDialog
        open={createOpen}
        name={newName}
        busy={createBusy}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onNameChange={setNewName}
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
