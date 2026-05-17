# Project notes

## Playlist creation and multiple active libraries

Subsonic playlists are **per server account**, not per music-folder (`libraryId`). The app still caches playlist summaries under each active library scope (`serverUrl` + `username` + `libraryId`), so a full library browse can load several scopes at once (multiple servers, or multiple folders on one server).

**Current product rule (v1):** mutating server playlists (create, edit membership, add track from player) is only allowed when **exactly one library** is active in Settings → Servers & libraries. **Delete** is allowed with multiple libraries active when the playlist view only contains songs from one library scope.

**Why not auto-pick a scope?** With multiple active libraries we would need to choose which `libraryId` to pass into cache refresh, and whether to refresh every scope on that server. Same-server multi-folder and multi-server cases behave differently; doing it wrong would show stale or duplicated playlist rows.

**UI today:**

- Playlists tab **+** stays enabled; multiple libraries → explanatory dialog (includes a note about future server-playlist and local cross-library support). One library → create name dialog.
- Playlist detail **Edit** and player **Add to playlist** are disabled with a tooltip when multiple libraries are active.
- **Delete playlist** is not gated on library count.

**Planned (not implemented):**

- Create/edit server playlists with multiple libraries active (with correct cache refresh).
- **Local cross-library playlists** stored on device, combining tracks from any active library without Subsonic scope ambiguity.

Relevant code: `PlaylistListView.tsx`, `PlaylistSingleLibraryRequiredDialog.tsx`, `PlaylistSongListView.tsx`, `useLibraryBrowserPlaylists.tsx`, `usePlayerFullScreenTrackActions.ts`, `LibraryBrowseCacheContext.tsx`.
