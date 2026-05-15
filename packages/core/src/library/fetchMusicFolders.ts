import type { SubsonicAPI } from '../api/client';

function isOk(r: { status?: string } | null | undefined): boolean {
  return r?.status === 'ok';
}

export type MusicFolderSummary = {
  id: string;
  name: string;
};

/**
 * Lists Subsonic music folders (Navidrome libraries) for the authenticated account.
 */
export async function fetchMusicFolders(api: SubsonicAPI): Promise<MusicFolderSummary[]> {
  const r = await api.getMusicFolders();
  if (!isOk(r)) {
    const msg =
      r && 'error' in r ? String((r as { error?: { message?: string } }).error?.message) : 'getMusicFolders failed';
    throw new Error(msg);
  }
  const raw = r.musicFolders?.musicFolder ?? [];
  return raw.map((f) => ({
    id: String(f.id),
    name: f.name?.trim() ? f.name : `Library ${f.id}`,
  }));
}
