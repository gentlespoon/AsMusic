---
name: Server playlists per account
overview: Align server playlist storage, sync, and create UX with Subsonic semantics — playlists belong to a server account, not a music-folder library scope. Replace per-library cache + catalog dedupe with native per-server playlists; use a server picker (not library picker) when creating playlists.
todos:
  - id: storage-contract
    content: Change LibraryCacheStorage playlist APIs to ServerPlaylistScope (serverKey only); add type in cacheScope.ts
    status: completed
  - id: indexeddb-migration
    content: IndexedDB v6 — migrate playlists/playlistTrackLists to serverPlaylists/serverPlaylistTracks; exclude playlists from deleteScope
    status: completed
  - id: ios-sqlite-migration
    content: SQLite user_version 5 — server_playlists + server_playlist_tracks tables; migrate from library_playlists; update Capacitor bridge
    status: completed
  - id: sync-once-per-server
    content: Remove playlist refresh from refreshLibraryCache; refresh once per serverKey in runRefresh and useRefreshLibraryRow
    status: completed
  - id: context-catalog
    content: serverPlaylistsByServerKey in LibraryBrowseCacheContext; remove playlists from slices; simplify playlistCatalogRows (no dedupe)
    status: completed
  - id: create-dialog-server-picker
    content: Replace library picker with server picker when multiple servers active; drop libraryId from create/delete/update mutations
    status: completed
  - id: url-resolution
    content: Add lp1. server playlist deep links; resolve with merged server song cache; legacy lb1. fallback
    status: completed
  - id: playback-artwork
    content: Per-track library scope for playlist detail artwork/playback; merged cachedSongs for editor and track list
    status: completed
  - id: i18n-docs
    content: Update createServerLabel strings (all locales) and NOTE.md playlist section
    status: completed
isProject: false
---

# Server playlists per account

## Problem

Subsonic playlists are **per server account**, but the app cached them under each `(serverKey, libraryId)` scope. That caused:

- Duplicate playlist rows when multiple libraries on one server were active (papered over with catalog dedupe)
- A misleading **library picker** on create (“which library should own the playlist?”)
- Redundant `getPlaylists` fetches during sync (once per active library on the same server)
- Playlists deleted when `deleteScope` cleared one music folder

## Goal

- Cache playlists under **`serverKey` only** (one copy per account)
- Keep songs, artwork, and offline media **per library scope**
- Create dialog: **server picker** when multiple servers are active; no library picker
- Playlist detail/editor: merged song cache across all active libraries on that server
- Per-track scope resolution for artwork, starring, and queue items

## Architecture (after)

```mermaid
flowchart TB
  subgraph sync [Library sync]
    Refresh[refreshLibraryCache per library scope]
    GP[getPlaylists once per serverKey]
    W[replacePlaylistSummaries serverKey]
    Refresh --> GP --> W
  end
  subgraph storage [Platform storage]
    IDB[IndexedDB serverPlaylists / serverPlaylistTracks]
    SQLite[iOS server_playlists tables]
    W --> IDB
    W --> SQLite
  end
  subgraph context [LibraryBrowseCacheContext]
    SP[serverPlaylistsByServerKey]
    Rows[playlistCatalogRows one row per server playlist]
    SP --> Rows
  end
  subgraph ui [UI]
    Create[Create dialog server picker]
    Detail[Playlist detail merged songs]
    Create --> Detail
  end
  storage --> SP
```

## Key changes

### Core (`packages/core`)

| File | Change |
|------|--------|
| `cacheScope.ts` | `ServerPlaylistScope = { serverKey }` |
| `LibraryCacheStorage.ts` | Playlist methods take `ServerPlaylistScope` |
| `playlistMutations.ts` | `refreshPlaylistCacheForServer`; deprecate per-scope name |
| `loadPlaylistTracks.ts` | `serverKey` instead of full `LibraryCacheScope` |
| `refreshLibraryCache.ts` | No longer refreshes playlists |

### Storage

| Platform | Migration |
|----------|-----------|
| Web IndexedDB | v6: new stores, dedupe migrate, `deleteScope` skips playlists |
| iOS SQLite | v5: `server_playlists` / `server_playlist_tracks`, drop legacy tables |

### UI

| Area | Change |
|------|--------|
| `LibraryBrowseCacheContext` | `serverPlaylistsByServerKey`, `multiServer`; mutations drop `libraryId` |
| `PlaylistListViewCreateDialog` | Server selector when `multiServer` |
| `libraryNavigationUrl.ts` | `lp1.` encode/decode for `{ serverKey, id }` |
| `useLibraryBrowserResolvedScopes` | Server playlist resolves merged `cachedSongs` + `findTrackScope` |
| `PlaylistSongListView` | Per-track artwork scope; `serverKey` for cache reads |

## Deep links

| Ref prefix | Payload | When used |
|------------|---------|-----------|
| `lp1.` | `{ serverKey, id }` | Multiple servers active |
| `lb1.` | `{ serverKey, libraryId, id }` | Legacy playlist URLs (still resolves) |
| raw id | playlist id | Single server |

## Test matrix

| Scenario | Expected |
|----------|----------|
| Two libraries, same server | One playlist list; one sync fetch per server |
| Create server playlist, multi-library same server | No picker; playlist appears once |
| Create with two servers | Server picker shown |
| `deleteScope` one library | Playlists preserved |
| Playlist track in library B | Resolves from merged cache; correct per-track scope for artwork |
| Legacy `lb1.` bookmark | Still opens playlist |

## Related

- Prior plan: `media-library/2026-05-17T16-03-11-playlist_feature_parity_9362e259.plan.md`
- Product notes: `NOTE.md`, `doc/features/playlist.md`
- Fixes duplicate playlist display issue (#27 follow-up)
