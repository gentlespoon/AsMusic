export function libraryRowKey(row: { serverId: string; libraryId: string }): string {
  return `${row.serverId}:${row.libraryId}`;
}
