import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Child } from 'subsonic-api';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  allCachedSongsSorted,
  filterPlaylistEntries,
  mergePlaylistEntryWithCachedSongs,
  playlistEditDiff,
  playlistEntriesFromGetPlaylistResponse,
  type SubsonicAPI,
} from '@asmusic/core';
import { useT } from '@asmusic/i18n';
import { PageCloseButton } from '../../../../shared/PageCloseButton';
import { songMatchesQuery } from '../../../../shared/songSearch';
import { libraryFlexFillSx } from '../../../../shared/LibraryVirtuosoFill';

export function PlaylistEditorView({
  playlistId,
  playlistName,
  cachedSongs,
  api,
  onBack,
  onSave,
}: {
  playlistId: string;
  playlistName: string;
  cachedSongs: Child[];
  api: SubsonicAPI;
  onBack: () => void;
  onSave: (diff: { songIdsToAdd: string[]; songIndexesToRemove: number[] }) => Promise<void>;
}) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState<Child[]>([]);
  const [originalEntryIds, setOriginalEntryIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await api.getPlaylist({ id: playlistId });
        if (cancelled) return;
        if (res.status !== 'ok' || !res.playlist) {
          throw new Error('Could not load playlist');
        }
        const entries = filterPlaylistEntries(playlistEntriesFromGetPlaylistResponse(res.playlist));
        const ids = entries.map((e) => String(e.id));
        const allSongs =
          cachedSongs.length > 0 ? allCachedSongsSorted(cachedSongs) : entries.map((e) => mergePlaylistEntryWithCachedSongs(e, cachedSongs));
        const idSet = new Set(ids);
        setSongs(allSongs);
        setOriginalEntryIds(ids);
        setSelectedIds(idSet);
        setOriginalIds(new Set(ids));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('library.playlist.editor.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, playlistId, cachedSongs]);

  const filteredSongs = useMemo(
    () => songs.filter((s) => songMatchesQuery(s, search)),
    [songs, search]
  );

  const hasChanges = useMemo(() => {
    if (selectedIds.size !== originalIds.size) return true;
    for (const id of selectedIds) {
      if (!originalIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, originalIds]);

  const toggleSelection = useCallback((songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onBack();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const diff = playlistEditDiff({ originalEntryIds, selectedSongIds: selectedIds });
      await onSave(diff);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('library.playlist.editor.saveError'));
    } finally {
      setSaving(false);
    }
  }, [hasChanges, originalEntryIds, selectedIds, onSave, onBack]);

  return (
    <Box
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, mb: 2, alignItems: 'center' }}>
        <PageCloseButton edge="start" onClick={onBack} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          {t('library.playlist.editor.editTitle', { name: playlistName })}
        </Typography>
        <Button variant="contained" size="small" disabled={!hasChanges || saving} onClick={() => void handleSave()}>
          {saving ? t('common.saving') : t('library.playlist.editor.done')}
        </Button>
      </Stack>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            {t('library.playlist.editor.loadingSongs')}
          </Typography>
        </Stack>
      )}
      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('library.playlist.editor.filter')}
        aria-label={t('library.playlist.editor.filterAria')}
        fullWidth
        size="small"
        sx={{ flexShrink: 0, mb: 2 }}
        disabled={loading}
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!loading && songs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('library.playlist.editor.emptyCache')}
          </Typography>
        )}
        {filteredSongs.map((song) => {
          const id = String(song.id);
          const checked = selectedIds.has(id);
          return (
            <ListItem key={id} disablePadding divider>
              <ListItemButton onClick={() => toggleSelection(id)} sx={{ py: 0.75 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText
                  primary={song.title ?? id}
                  secondary={[song.artist, song.album].filter(Boolean).join(' · ') || undefined}
                  slotProps={{
                    primary: { variant: 'body2', noWrap: true },
                    secondary: { variant: 'caption', noWrap: true },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </Box>
    </Box>
  );
}
