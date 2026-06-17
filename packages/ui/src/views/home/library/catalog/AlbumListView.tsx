import { useT } from '@asmusic/i18n';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { AlbumID3 } from 'subsonic-api';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ViewList from '@mui/icons-material/ViewList';
import ViewModule from '@mui/icons-material/ViewModule';
import { Virtuoso, VirtuosoGrid, type VirtuosoGridHandle, type VirtuosoHandle } from 'react-virtuoso';
import type { GridItemProps, GridListProps } from 'react-virtuoso';
import type { LibraryArtworkCacheRow, LibraryCacheScope, SubsonicAPI } from '@asmusic/core';
import { CoverArtThumb } from '../../../../shared/CoverArtThumb';
import type { PersistCachedArtwork } from '../../../../shared/libraryArtworkCacheAccess';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '../../../../shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '../../../../shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '../../../../shared/useLibraryVirtuosoScroller';
import { VirtuosoMuiList } from '../../../../shared/virtuosoMuiList';
import { setAlbumDisplayMode, useAlbumDisplayMode, type AlbumDisplayMode } from '../../../../preferences/albumDisplayMode';

export type AlbumCatalogRow = {
  album: AlbumID3;
  serverId: string;
  artworkScope: LibraryCacheScope;
};

function albumMatchesQuery(album: AlbumID3, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [album.name, album.artist, album.displayArtist, album.genre]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function rowKey(row: AlbumCatalogRow): string {
  return `${row.artworkScope.serverKey}|${row.artworkScope.libraryId}|${row.album.id}`;
}

const AlbumGridVirtuosoList = forwardRef<HTMLDivElement, GridListProps>(function AlbumGridVirtuosoList(props, ref) {
  return (
    <Box
      ref={ref}
      {...props}
      role="list"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))',
        gap: 2,
        m: 0,
        p: 0,
      }}
    />
  );
});

const AlbumGridVirtuosoItem = forwardRef<HTMLDivElement, GridItemProps>(function AlbumGridVirtuosoItem(props, ref) {
  return <Box ref={ref} {...props} role="listitem" sx={{ minWidth: 0, minHeight: 268 }} />;
});

export function AlbumListView({
  rows,
  apiForServer,
  initialReady,
  syncing,
  resolveCachedArtworkForScope,
  persistCachedArtworkForScope,
  artworkVersionKey,
  getArtworkCacheBump,
  onAlbumOpen,
}: {
  rows: AlbumCatalogRow[];
  apiForServer: (serverId: string) => SubsonicAPI | null;
  initialReady: boolean;
  syncing: boolean;
  resolveCachedArtworkForScope: (
    scope: LibraryCacheScope,
    coverArtId: string
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtworkForScope: (scope: LibraryCacheScope) => PersistCachedArtwork;
  artworkVersionKey: (coverArtId: string, scope: LibraryCacheScope) => string;
  getArtworkCacheBump: (coverArtId: string, scope: LibraryCacheScope) => number;
  onAlbumOpen: (row: AlbumCatalogRow) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState('');
  const displayMode = useAlbumDisplayMode();

  const filteredRows = useMemo(
    () => rows.filter((r) => albumMatchesQuery(r.album, search)),
    [rows, search]
  );

  const virtualRows = filteredRows;

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration('lb:albums');
  const virtuosoScroller = useLibraryVirtuosoScroller(scrollRef);
  const listVirtuosoRef = useRef<VirtuosoHandle>(null);
  const gridVirtuosoRef = useRef<VirtuosoGridHandle>(null);

  useEffect(() => {
    listVirtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
    gridVirtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [search]);

  useEffect(() => {
    listVirtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
    gridVirtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [displayMode]);

  const gridComponents = useMemo(
    () => ({
      ...virtuosoScroller,
      List: AlbumGridVirtuosoList,
      Item: AlbumGridVirtuosoItem,
    }),
    [virtuosoScroller]
  );

  return (
    <Box
      role="tabpanel"
      id="library-panel-0"
      aria-labelledby="library-tab-0"
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, mb: 2, alignItems: 'flex-start' }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.album.search')}
          aria-label={t('library.album.search')}
          fullWidth
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={displayMode}
          onChange={(_, next: AlbumDisplayMode | null) => {
            if (next != null) setAlbumDisplayMode(next);
          }}
          aria-label={t('library.album.ariaDisplayMode')}
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="grid" aria-label={t('library.album.ariaGrid')}>
            <ViewModule fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list" aria-label={t('library.album.ariaList')}>
            <ViewList fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
        {!initialReady && (
          <Typography variant="body2" color="text.secondary">
            {t('library.cache.loading')}
          </Typography>
        )}
        {initialReady && rows.length === 0 && !syncing && (
          <Typography variant="body2" color="text.secondary">
            {t('library.songs.empty')}
          </Typography>
        )}
        {initialReady && rows.length > 0 && filteredRows.length === 0 && queryTrimmed.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.album.noAlbumsMatch')}
          </Typography>
        )}
        {initialReady && virtualRows.length > 0 && displayMode === 'grid' && (
          <LibraryVirtuosoFill>
            <VirtuosoGrid
            ref={gridVirtuosoRef}
            style={{ height: '100%', width: '100%', minHeight: 0 }}
            data={virtualRows}
            components={gridComponents}
            computeItemKey={(_, row) => rowKey(row)}
            itemContent={(_, row) => {
              const api = apiForServer(row.serverId);
              const { album } = row;
              const bumpKey = album.coverArt ? artworkVersionKey(album.coverArt, row.artworkScope) : '';
              return (
                <Card
                  elevation={0}
                  sx={{
                    bgcolor: 'transparent',
                    border: 'none',
                    height: '100%',
                    '& .MuiCardActionArea-root': { borderRadius: 1 },
                  }}
                >
                  <CardActionArea onClick={() => onAlbumOpen(row)} sx={{ display: 'block', textAlign: 'left' }}>
                    <CoverArtThumb
                      api={api}
                      coverArtId={album.coverArt}
                      resolveCachedArtwork={(id) => resolveCachedArtworkForScope(row.artworkScope, id)}
                      persistCachedArtwork={persistCachedArtworkForScope(row.artworkScope)}
                      artworkCacheBump={album.coverArt ? getArtworkCacheBump(album.coverArt, row.artworkScope) : 0}
                      artworkCacheKey={album.coverArt ? bumpKey : undefined}
                      size={200}
                      label={album.name}
                      sx={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 1,
                      }}
                    />
                    <CardContent sx={{ px: 0.5, pt: 1, pb: 0.5, '&:last-child': { pb: 0.5 } }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.25,
                        }}
                      >
                        {album.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.25, display: 'block' }}>
                        {album.artist ?? album.displayArtist ?? '—'}
                        {album.songCount > 0 ? ` · ${album.songCount} tracks` : ''}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            }}
          />
          </LibraryVirtuosoFill>
        )}
        {initialReady && virtualRows.length > 0 && displayMode === 'list' && (
          <LibraryVirtuosoFill>
            <Virtuoso
            ref={listVirtuosoRef}
            style={{ height: '100%', width: '100%', minHeight: 0 }}
            data={virtualRows}
            components={{ ...virtuosoScroller, List: VirtuosoMuiList }}
            computeItemKey={(_, row) => rowKey(row)}
            itemContent={(_, row) => {
              const api = apiForServer(row.serverId);
              const { album } = row;
              const bumpKey = album.coverArt ? artworkVersionKey(album.coverArt, row.artworkScope) : '';
              return (
                <ListItemButton divider onClick={() => onAlbumOpen(row)} sx={{ py: 0.75, px: 0 }}>
                  <ListItemAvatar sx={{ minWidth: 48 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: 'hidden' }}>
                      <CoverArtThumb
                        api={api}
                        coverArtId={album.coverArt}
                        resolveCachedArtwork={(id) => resolveCachedArtworkForScope(row.artworkScope, id)}
                      persistCachedArtwork={persistCachedArtworkForScope(row.artworkScope)}
                        artworkCacheBump={album.coverArt ? getArtworkCacheBump(album.coverArt, row.artworkScope) : 0}
                        artworkCacheKey={album.coverArt ? bumpKey : undefined}
                        size={48}
                        label=""
                        sx={{ width: 40, height: 40 }}
                      />
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={album.name ?? '—'}
                    secondary={
                      <>
                        {album.artist ?? album.displayArtist ?? '—'}
                        {album.songCount > 0 ? ` · ${album.songCount} tracks` : ''}
                      </>
                    }
                    slotProps={{
                      primary: { variant: 'body2', noWrap: true },
                      secondary: { variant: 'caption', noWrap: true },
                    }}
                  />
                </ListItemButton>
              );
            }}
          />
          </LibraryVirtuosoFill>
        )}
      </Box>
    </Box>
  );
}
