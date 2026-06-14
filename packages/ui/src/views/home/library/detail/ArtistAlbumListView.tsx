import { useI18n, useT } from '@asmusic/i18n';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { AlbumID3 } from 'subsonic-api';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  List,
  ListItem,
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
import { PageCloseButton } from '../../../../shared/PageCloseButton';
import type { GridItemProps, GridListProps } from 'react-virtuoso';
import type { LibraryArtworkCacheRow, SubsonicAPI } from '@asmusic/core';
import { CoverArtThumb } from '../../../../shared/CoverArtThumb';
import type { PersistCachedArtwork } from '../../../../shared/libraryArtworkCacheAccess';
import { LibraryVirtuosoFill, libraryFlexFillSx } from '../../../../shared/LibraryVirtuosoFill';
import { useLibraryScrollRestoration } from '../../../../shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '../../../../shared/useLibraryVirtuosoScroller';
import { VirtuosoMuiList } from '../../../../shared/virtuosoMuiList';
import {
  LibraryAlbumCardCaption,
  LibraryAlbumCardTitle,
  LibraryDetailTitle,
  libraryDetailHeaderStackSx,
} from '../shared/libraryTypography';
import { setAlbumDisplayMode, useAlbumDisplayMode, type AlbumDisplayMode } from '../../../../preferences/albumDisplayMode';
import { useEdgeSwipeBack } from '../../../../shared/useEdgeSwipeBack';

function albumMatchesQuery(album: AlbumID3, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [album.name, album.artist, album.displayArtist, album.genre]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

const ArtistAlbumGridVirtuosoList = forwardRef<HTMLDivElement, GridListProps>(function ArtistAlbumGridVirtuosoList(
  props,
  ref
) {
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

const ArtistAlbumGridVirtuosoItem = forwardRef<HTMLDivElement, GridItemProps>(function ArtistAlbumGridVirtuosoItem(
  props,
  ref
) {
  return <Box ref={ref} {...props} role="listitem" sx={{ minWidth: 0, minHeight: 268 }} />;
});

export function ArtistAlbumListView({
  artistName,
  albums,
  api,
  initialReady,
  syncing,
  resolveCachedArtwork,
  persistCachedArtwork,
  artworkVersionById,
  coverArtCacheBump,
  scrollRestorationKey,
  allSongsTrackCount,
  onAlbumOpen,
  onAllSongsOpen,
  onBack,
}: {
  artistName: string;
  /** Stable id for scroll memory (URL artist id, including encoded multi-library refs). */
  scrollRestorationKey: string;
  /** Total cached tracks for this artist (for the “All songs” row). */
  allSongsTrackCount: number;
  albums: AlbumID3[];
  api: SubsonicAPI;
  initialReady: boolean;
  syncing: boolean;
  resolveCachedArtwork: (coverArtId: string) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkVersionById: Record<string, number>;
  /** When artwork version keys are scoped (multi-library), map cover id to bump. */
  coverArtCacheBump?: (coverArtId: string | undefined) => number;
  onAlbumOpen: (album: AlbumID3) => void;
  onAllSongsOpen: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const { format } = useI18n();
  const bumpFor = coverArtCacheBump ?? ((id: string | undefined) => (id ? artworkVersionById[id] ?? 0 : 0));
  const [search, setSearch] = useState('');
  const displayMode = useAlbumDisplayMode();

  useEffect(() => {
    setSearch('');
  }, [artistName]);

  const filteredAlbums = useMemo(
    () => albums.filter((a) => albumMatchesQuery(a, search)),
    [albums, search]
  );

  const queryTrimmed = search.trim();

  const scrollRef = useLibraryScrollRestoration(`lb:artistAlbums:${scrollRestorationKey}`);
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

  const edgeSwipeBack = useEdgeSwipeBack(onBack);

  const gridComponents = useMemo(
    () => ({
      ...virtuosoScroller,
      List: ArtistAlbumGridVirtuosoList,
      Item: ArtistAlbumGridVirtuosoItem,
    }),
    [virtuosoScroller]
  );

  const allSongsList = allSongsTrackCount > 0 && (
    <List disablePadding sx={{ flexShrink: 0, mb: 0 }}>
      <ListItemButton divider onClick={onAllSongsOpen} sx={{ py: 0.75, px: 0 }}>
        <ListItemAvatar sx={{ minWidth: 48 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-hidden
          >
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
              ♪
            </Typography>
          </Box>
        </ListItemAvatar>
        <ListItemText
          primary={t('library.album.allSongs')}
          secondary={t('library.artist.trackCount', { count: format.number(allSongsTrackCount) })}
          slotProps={{
            primary: { variant: 'body2', noWrap: true },
            secondary: { variant: 'caption', noWrap: true },
          }}
        />
      </ListItemButton>
    </List>
  );

  return (
    <Box
      role="tabpanel"
      id="library-panel-1"
      aria-labelledby="library-tab-1"
      {...edgeSwipeBack}
      sx={{
        ...libraryFlexFillSx,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack sx={libraryDetailHeaderStackSx}>
        <PageCloseButton edge="start" onClick={onBack} sx={{ alignSelf: 'flex-start' }} />
        <LibraryDetailTitle>{artistName}</LibraryDetailTitle>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, mb: 2, alignItems: 'flex-start' }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.album.search')}
          aria-label={t('library.album.filterForArtist')}
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
        {initialReady && albums.length === 0 && !syncing && allSongsTrackCount === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('library.artist.noAlbumsInCache')}
          </Typography>
        )}
        {initialReady && albums.length === 0 && !syncing && allSongsTrackCount > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.artist.noAlbumsUseAllSongs')}
          </Typography>
        )}
        {initialReady && albums.length > 0 && filteredAlbums.length === 0 && queryTrimmed.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.album.noAlbumsMatch')}
          </Typography>
        )}
        {initialReady && displayMode === 'grid' && (
          <>
            {allSongsList}
            {filteredAlbums.length > 0 && (
              <LibraryVirtuosoFill>
                <VirtuosoGrid
                  ref={gridVirtuosoRef}
                  style={{ height: '100%', width: '100%', minHeight: 0 }}
                  data={filteredAlbums}
                components={gridComponents}
                computeItemKey={(_, album) => String(album.id)}
                itemContent={(_, album) => (
                    <Card
                      elevation={0}
                      sx={{
                        bgcolor: 'transparent',
                        border: 'none',
                        height: '100%',
                        '& .MuiCardActionArea-root': { borderRadius: 1 },
                      }}
                    >
                      <CardActionArea onClick={() => onAlbumOpen(album)} sx={{ display: 'block', textAlign: 'left' }}>
                      <CoverArtThumb
                        api={api}
                        coverArtId={album.coverArt}
                        resolveCachedArtwork={resolveCachedArtwork}
                        persistCachedArtwork={persistCachedArtwork}
                        artworkCacheBump={bumpFor(album.coverArt)}
                        size={200}
                        label={album.name}
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: 1,
                        }}
                      />
                      <CardContent sx={{ px: 0.5, pt: 1, pb: 0.5, '&:last-child': { pb: 0.5 } }}>
                        <LibraryAlbumCardTitle>{album.name}</LibraryAlbumCardTitle>
                        <LibraryAlbumCardCaption>
                          {album.artist ?? album.displayArtist ?? '—'}
                          {album.songCount > 0 ? ` · ${album.songCount} tracks` : ''}
                        </LibraryAlbumCardCaption>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                )}
              />
              </LibraryVirtuosoFill>
            )}
          </>
        )}
        {initialReady && displayMode === 'list' && (
          <Box sx={{ ...libraryFlexFillSx, display: 'flex', flexDirection: 'column' }}>
            {allSongsList}
            {filteredAlbums.length > 0 && (
              <LibraryVirtuosoFill>
                <Virtuoso
                  ref={listVirtuosoRef}
                  style={{ height: '100%', width: '100%', minHeight: 0 }}
                  data={filteredAlbums}
                components={{ ...virtuosoScroller, List: VirtuosoMuiList }}
                computeItemKey={(_, album) => String(album.id)}
                itemContent={(_, album) => (
                  <ListItem divider disablePadding sx={{ alignItems: 'center' }}>
                    <ListItemButton
                      onClick={() => onAlbumOpen(album)}
                      sx={{ flex: 1, minWidth: 0, py: 0.75, px: 0, alignItems: 'flex-start' }}
                    >
                      <ListItemAvatar sx={{ minWidth: 48 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: 'hidden' }}>
                          <CoverArtThumb
                            api={api}
                            coverArtId={album.coverArt}
                            resolveCachedArtwork={resolveCachedArtwork}
                        persistCachedArtwork={persistCachedArtwork}
                            artworkCacheBump={bumpFor(album.coverArt)}
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
                        sx={{ flex: 1, minWidth: 0, my: 0 }}
                        slotProps={{
                          primary: { variant: 'body2', noWrap: true },
                          secondary: { variant: 'caption', noWrap: true },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                )}
              />
              </LibraryVirtuosoFill>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
