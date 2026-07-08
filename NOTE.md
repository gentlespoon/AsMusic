# Project notes

## Equalizer (deferred)

Global EQ for streaming and offline downloads — one global preset/band setting for all output. See [`.cursor/plans/equalizer_platformhost.plan.md`](.cursor/plans/equalizer_platformhost.plan.md). iOS native DSP notes: [`ios/NOTE.md`](ios/NOTE.md).

## Playlist creation and multiple active libraries

Subsonic playlists are **per server account**, not per music-folder (`libraryId`). The app caches playlist summaries under `serverKey` only (one copy per account). Songs, artwork, and offline media remain per library scope.

**Server playlists:** create uses a **server picker** when multiple servers are active; no library picker. Edit membership and add-from-player use all cached songs on that server across active libraries.

**Local playlists (on device):** cross-library playlists stored in `LocalPlaylistStore`. Create, edit, delete, and add-from-player work with any number of active libraries. See [`doc/features/playlist.md`](doc/features/playlist.md).

**UI:**

- Playlists tab **+** opens create dialog: **On server** vs **On this device**.
- Server create: server picker only when multiple servers are active.
- Playlist detail resolves tracks against merged song caches for that server.
- Player **Add to playlist** lists server playlists for the current track's server plus all local playlists.

Relevant code: `PlaylistListView.tsx`, `PlaylistListViewCreateDialog.tsx`, `LocalPlaylistSongListView.tsx`, `useLibraryBrowserPlaylists.tsx`, `usePlayerFullScreenTrackActions.ts`, `LibraryBrowseCacheContext.tsx`, `packages/core/src/localPlaylists/*`.
