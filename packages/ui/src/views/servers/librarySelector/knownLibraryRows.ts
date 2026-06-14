import { DEFAULT_LIBRARY_ID } from '@asmusic/core';
import type { ActiveLibraryRef, SavedServer } from '../../../contexts';
import type { LibraryRow } from './types';

const KNOWN_LIBRARIES_KEY = 'asmusic-known-libraries-v1';

function isLibraryRow(value: unknown): value is LibraryRow {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as LibraryRow).serverId === 'string' &&
    typeof (value as LibraryRow).serverUrl === 'string' &&
    typeof (value as LibraryRow).username === 'string' &&
    typeof (value as LibraryRow).libraryId === 'string' &&
    typeof (value as LibraryRow).libraryName === 'string'
  );
}

export function readKnownLibraryRows(): LibraryRow[] {
  try {
    const raw = localStorage.getItem(KNOWN_LIBRARIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLibraryRow);
  } catch {
    return [];
  }
}

export function persistKnownLibraryRows(rows: LibraryRow[]): void {
  const persistable = rows.filter((row) => row.libraryId !== 'unreachable');
  localStorage.setItem(KNOWN_LIBRARIES_KEY, JSON.stringify(persistable));
}

export function filterKnownRowsForServers(rows: LibraryRow[], servers: SavedServer[]): LibraryRow[] {
  const serverById = new Map(servers.map((s) => [s.id, s]));
  return rows
    .filter((row) => serverById.has(row.serverId) && row.libraryId !== 'unreachable')
    .map((row) => {
      const server = serverById.get(row.serverId)!;
      return {
        ...row,
        serverUrl: server.serverUrl,
        username: server.username,
      };
    });
}

export function knownLibraryRowsForServer(
  server: SavedServer,
  knownRows: LibraryRow[],
  activeRefs: ActiveLibraryRef[],
  defaultLibraryName: string
): LibraryRow[] {
  const byLibraryId = new Map<string, LibraryRow>();

  for (const row of knownRows) {
    if (row.serverId !== server.id || row.libraryId === 'unreachable') continue;
    byLibraryId.set(row.libraryId, {
      ...row,
      serverUrl: server.serverUrl,
      username: server.username,
    });
  }

  for (const ref of activeRefs) {
    if (ref.serverId !== server.id || byLibraryId.has(ref.libraryId)) continue;
    byLibraryId.set(ref.libraryId, {
      serverId: server.id,
      serverUrl: server.serverUrl,
      username: server.username,
      libraryId: ref.libraryId,
      libraryName:
        ref.libraryId === DEFAULT_LIBRARY_ID ? defaultLibraryName : ref.libraryId,
    });
  }

  const rows = [...byLibraryId.values()];
  if (rows.length > 0) return rows;

  return [
    {
      serverId: server.id,
      serverUrl: server.serverUrl,
      username: server.username,
      libraryId: DEFAULT_LIBRARY_ID,
      libraryName: defaultLibraryName,
    },
  ];
}

export function unreachableLibraryRow(server: SavedServer, label: string): LibraryRow {
  return {
    serverId: server.id,
    serverUrl: server.serverUrl,
    username: server.username,
    libraryId: 'unreachable',
    libraryName: label,
  };
}
