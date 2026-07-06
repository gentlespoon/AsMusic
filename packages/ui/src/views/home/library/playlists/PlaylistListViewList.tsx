import { useEffect, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { PlaylistCatalogRow } from '@ui/contexts/LibraryBrowseCacheContext';
import { useLibraryScrollRestoration } from '@ui/shared/useLibraryScrollRestoration';
import { useLibraryVirtuosoScroller } from '@ui/shared/useLibraryVirtuosoScroller';
import { LibraryVirtuosoFill } from '@ui/shared/LibraryVirtuosoFill';
import { VirtuosoMuiList } from '@ui/shared/virtuosoMuiList';
import { PlaylistListViewRow } from './PlaylistListViewRow';

export function PlaylistListViewList({
  rows,
  multiLibrary,
  search,
  onPlaylistOpen,
  onDeleteClick,
}: {
  rows: PlaylistCatalogRow[];
  multiLibrary: boolean;
  search: string;
  onPlaylistOpen: (row: PlaylistCatalogRow) => void;
  onDeleteClick: (row: PlaylistCatalogRow) => void;
}) {
  const scrollRef = useLibraryScrollRestoration('lb:playlists');
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start' });
  }, [search]);

  return (
    <LibraryVirtuosoFill>
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%', width: '100%', minHeight: 0 }}
        data={rows}
        components={{ ...virtuosoComponents, List: VirtuosoMuiList }}
        computeItemKey={(_index, row) =>
          (row as PlaylistCatalogRow | undefined)?.rowKey ?? `lb-playlists-vrow:${_index}`
        }
        itemContent={(_index, row) => (
          <PlaylistListViewRow
            row={row}
            multiLibrary={multiLibrary}
            onOpen={onPlaylistOpen}
            onDeleteClick={onDeleteClick}
          />
        )}
      />
    </LibraryVirtuosoFill>
  );
}
