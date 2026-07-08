import { useI18n, useT } from '@asmusic/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArtistID3 } from 'subsonic-api';
import { Box, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { LibraryCacheScope } from '@asmusic/core';
import { useLibraryScrollRestoration } from '@ui/shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '@ui/shared/useLibraryVirtuosoScroller';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '@ui/shared/LibraryVirtuosoFill';
import { VirtuosoMuiList } from '@ui/shared/virtuosoMuiList';

export type ArtistCatalogRow = {
  artist: ArtistID3;
  serverId: string;
  artworkScope: LibraryCacheScope;
  rowKey: string;
};

type ArtistListVirtuosoRow =
  | { type: 'header'; letter: string; key: string }
  | { type: 'artist'; row: ArtistCatalogRow; key: string };

function artistSectionLetter(name: string | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '#';
  const head = trimmed[0]!.toUpperCase();
  return /^[A-Z]$/.test(head) ? head : '#';
}

function artistMatchesQuery(artist: ArtistID3, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (artist.name?.trim() ?? '').toLowerCase().includes(q);
}

function buildArtistListVirtuosoRows(filteredRows: ArtistCatalogRow[]): ArtistListVirtuosoRow[] {
  const byLetter = new Map<string, ArtistCatalogRow[]>();
  for (const row of filteredRows) {
    const letter = artistSectionLetter(row.artist.name);
    const list = byLetter.get(letter) ?? [];
    list.push(row);
    byLetter.set(letter, list);
  }
  const sections = [...byLetter.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const out: ArtistListVirtuosoRow[] = [];
  for (const [letter, list] of sections) {
    const sorted = [...list].sort((a, b) =>
      (a.artist.name ?? '').localeCompare(b.artist.name ?? '', undefined, { sensitivity: 'base' })
    );
    out.push({ type: 'header', letter, key: `lb-artists-h:${letter}` });
    for (const row of sorted) {
      out.push({ type: 'artist', row, key: row.rowKey });
    }
  }
  return out;
}

export function ArtistListView({
  rows,
  initialReady,
  onArtistOpen,
}: {
  rows: ArtistCatalogRow[];
  initialReady: boolean;
  onArtistOpen: (row: ArtistCatalogRow) => void;
}) {
  const t = useT();
  const { format } = useI18n();
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(
    () => rows.filter((r) => artistMatchesQuery(r.artist, search)),
    [rows, search]
  );

  const virtualRows = useMemo(() => buildArtistListVirtuosoRows(filteredRows), [filteredRows]);

  const artistRowCount = useMemo(
    () => virtualRows.filter((r): r is Extract<ArtistListVirtuosoRow, { type: 'artist' }> => r.type === 'artist').length,
    [virtualRows]
  );

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration('lb:artists');
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [search]);

  return (
    <Box
      role="tabpanel"
      id="library-panel-1"
      aria-labelledby="library-tab-1"
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('library.artist.search')}
        aria-label={t('library.artist.filter')}
        fullWidth
        size="small"
        sx={{ flexShrink: 0, mb: 2 }}
      />

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {!initialReady && (
          <Typography variant="body2" color="text.secondary">
            {t('library.cache.loading')}
          </Typography>
        )}
        {initialReady && rows.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('library.artist.noArtistsUntilSync')}
          </Typography>
        )}
        {initialReady && rows.length > 0 && filteredRows.length === 0 && queryTrimmed.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.artist.noArtistsMatch')}
          </Typography>
        )}
        {initialReady && artistRowCount > 0 && (
          <LibraryVirtuosoFill>
            <Virtuoso
              key={`lb-artists:${queryTrimmed}:${artistRowCount}`}
              ref={virtuosoRef}
              style={{ height: '100%', width: '100%', minHeight: 0 }}
              data={virtualRows}
              components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
              computeItemKey={(_index, item) => item.key}
              itemContent={(_index, item) =>
                item.type === 'header' ? (
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ letterSpacing: '0.06em', display: 'block', mb: 0.5, px: 0, pt: 1 }}
                  >
                    {item.letter}
                  </Typography>
                ) : (
                  <ListItemButton
                    divider
                    onClick={() => onArtistOpen(item.row)}
                    sx={{ py: 0.75, px: 0 }}
                  >
                    <ListItemText
                      primary={item.row.artist.name?.trim() || '—'}
                      secondary={t('library.artist.albumCount', {
                        count: format.number(item.row.artist.albumCount ?? 0),
                      })}
                      slotProps={{
                        primary: { variant: 'body2', noWrap: true },
                        secondary: { variant: 'caption', noWrap: true },
                      }}
                    />
                  </ListItemButton>
                )
              }
            />
          </LibraryVirtuosoFill>
        )}
      </Box>
    </Box>
  );
}
