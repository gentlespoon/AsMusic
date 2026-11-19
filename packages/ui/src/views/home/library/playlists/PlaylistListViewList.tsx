import { useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { PlaylistCatalogRow } from '@ui/contexts/LibraryBrowseCacheContext';
import { useLibraryVirtuosoScroller } from '@ui/shared/useLibraryVirtuosoScroller';
import { useBoundedListData } from '@ui/shared/useBoundedListData';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtuosoComponents = useLibraryVirtuosoScroller(scrollRef);
  const bounded = useBoundedListData(rows, {
    memoryKey: 'lb:playlists',
    resetKey: search,
  });

  return (
    <LibraryVirtuosoFill>
      <Virtuoso
        key={bounded.virtuosoKey}
        ref={bounded.virtuosoRef}
        style={{ height: '100%', width: '100%', minHeight: 0 }}
        data={bounded.data}
        initialTopMostItemIndex={bounded.initialTopMostItemIndex}
        rangeChanged={bounded.rangeChanged}
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
