import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { localPlaylistEditDiff, localPlaylistEntryKey, type LocalPlaylistEntry } from '@asmusic/core';
import { useT } from '@asmusic/i18n';
import { PageCloseButton } from '@ui/shared/PageCloseButton';
import { songMatchesQuery } from '@ui/shared/songSearch';
import { libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import type { SongListEntry } from '@ui/views/home/library/catalog/SongListView';
import { useLibraryBrowseCache } from '@ui/contexts/LibraryBrowseCacheContext';

export function LocalPlaylistEditorView({
  playlistId,
  playlistName,
  songEntries,
  entries,
  onBack,
  onSave,
}: {
  playlistId: string;
  playlistName: string;
  songEntries: SongListEntry[];
  entries: LocalPlaylistEntry[];
  onBack: () => void;
  onSave: (diff: { songIdsToAdd: string[]; songIndexesToRemove: number[] }) => Promise<void>;
}) {
  const t = useT();
  const { libraryDisplayName } = useLibraryBrowseCache();
  const [search, setSearch] = useState('');
  const [originalEntryKeys, setOriginalEntryKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [originalKeys, setOriginalKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const keys = entries.map((e) => localPlaylistEntryKey(e));
    const keySet = new Set(keys);
    setOriginalEntryKeys(keys);
    setSelectedKeys(keySet);
    setOriginalKeys(new Set(keys));
    setLoading(false);
  }, [entries, playlistId]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songEntries;
    return songEntries.filter((e) => songMatchesQuery(e.song, search));
  }, [songEntries, search]);

  const hasChanges = useMemo(() => {
    if (selectedKeys.size !== originalKeys.size) return true;
    for (const key of selectedKeys) {
      if (!originalKeys.has(key)) return true;
    }
    return false;
  }, [selectedKeys, originalKeys]);

  const toggleSelection = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      const diff = localPlaylistEditDiff({ originalEntryKeys, selectedEntryKeys: selectedKeys });
      await onSave(diff);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('library.playlist.editor.saveError'));
    } finally {
      setSaving(false);
    }
  }, [hasChanges, originalEntryKeys, selectedKeys, onSave, onBack, t]);

  return (
    <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        {!loading && songEntries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('library.playlist.editor.emptyCache')}
          </Typography>
        )}
        {filteredEntries.map((entry) => {
          const key = localPlaylistEntryKey({
            serverKey: entry.artworkScope.serverKey,
            libraryId: entry.artworkScope.libraryId,
            trackId: String(entry.song.id),
          });
          const checked = selectedKeys.has(key);
          const song = entry.song;
          const libraryLabel = libraryDisplayName(entry.serverId, entry.artworkScope.libraryId);
          return (
            <ListItem key={key} disablePadding divider>
              <ListItemButton onClick={() => toggleSelection(key)} sx={{ py: 0.75 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText
                  primary={song.title ?? String(song.id)}
                  secondary={[song.artist, song.album, libraryLabel].filter(Boolean).join(' · ') || undefined}
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
