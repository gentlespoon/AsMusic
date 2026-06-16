# Project notes

## Equalizer (deferred)

Global EQ for streaming and offline downloads — one global preset/band setting for all output. See [`.cursor/plans/equalizer_platformhost.plan.md`](.cursor/plans/equalizer_platformhost.plan.md). iOS native DSP notes: [`ios/NOTE.md`](ios/NOTE.md).

## Playlist creation and multiple active libraries

Subsonic playlists are **per server account**, not per music-folder (`libraryId`). The app still caches playlist summaries under each active library scope (`serverUrl` + `username` + `libraryId`), so a full library browse can load several scopes at once (multiple servers, or multiple folders on one server).

**Server playlists:** create (with library picker when multiple libraries are active), edit membership, and add-from-player for server playlists still require **exactly one active library** for edit/add mutations. **Delete** is allowed with multiple libraries active.

**Local playlists (on device):** cross-library playlists stored in `LocalPlaylistStore`. Create, edit, delete, and add-from-player work with any number of active libraries. See [`doc/features/playlist.md`](doc/features/playlist.md).

**UI:**

- Playlists tab **+** opens create dialog: **On server** vs **On this device**.
- Server playlist detail **Edit** and player add-to-**server**-playlist are disabled when multiple libraries are active.
- Local playlists are always editable; player add-to-playlist includes all local playlists plus server playlists for the current track's library.

Relevant code: `PlaylistListView.tsx`, `PlaylistListViewCreateDialog.tsx`, `LocalPlaylistSongListView.tsx`, `useLibraryBrowserPlaylists.tsx`, `usePlayerFullScreenTrackActions.ts`, `LibraryBrowseCacheContext.tsx`, `packages/core/src/localPlaylists/*`.
