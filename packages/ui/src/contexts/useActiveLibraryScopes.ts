import { useMemo } from 'react';
import { libraryCacheScope, type LibraryCacheScope } from '@asmusic/core';
import { useServerAndLibrary } from './ServerAndLibraryContext';

/** Cache scopes for libraries the user has activated for browsing. */
export function useActiveLibraryScopes(): LibraryCacheScope[] {
  const { servers, activeLibraryRefs } = useServerAndLibrary();
  return useMemo(() => {
    const scopes: LibraryCacheScope[] = [];
    for (const ref of activeLibraryRefs) {
      const s = servers.find((x) => x.id === ref.serverId);
      if (!s) continue;
      scopes.push(libraryCacheScope(s.serverUrl, s.username, ref.libraryId));
    }
    return scopes;
  }, [activeLibraryRefs, servers]);
}
