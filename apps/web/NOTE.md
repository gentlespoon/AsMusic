# Library cache (web)

The Capacitor / browser shell mirrors the legacy native app’s approach: **fetch the full library from Subsonic/Navidrome, persist it locally, then drive the UI from that store** (see `legacy-swiftui-ios/AsMusic/Stores/LibrarySongCacheReload.swift` and `SongCacheStore` / `AlbumCacheStore` / `ArtistCacheStore`).

## Storage abstraction

React code does **not** talk to IndexedDB (or SQLite) directly.

- **Contract**: `LibraryCacheStorage` in `packages/core/src/library/storage/LibraryCacheStorage.ts` (`readSongList`, `replaceSongList`, `readMeta`, `replacePlaylistSummaries`, `deleteScope`).
- **Injection**: `PlatformHost` in `packages/core/src/host/types.ts` — `browserHost` (`packages/platform-web`) uses `createIndexedDbLibraryCacheStorage()`; **`iosCapacitorHost`** (`packages/platform-capacitor`) uses `createCapacitorIosSqliteLibraryCacheStorage()` (native SQLite via `AsmusicNative`).
- **Sync orchestration**: `refreshLibraryCache` in `@asmusic/core` takes the API client plus a `LibraryCacheStorage` instance (from `useHost().libraryCache`).

Swapping backends means implementing `LibraryCacheStorage` and wiring it in the platform host factory (`packages/shell/src/createPlatformHost.ts`).

## iOS native SQLite (Capacitor shell)

Implemented: see `ios/NOTE.md` and `ios/App/App/LibraryCacheSQLiteStore.swift`. The JS side stays on `LibraryCacheStorage` only.

## IndexedDB (browser / dev shell only)

- **Database name**: `asmusic-library-cache` (inside `packages/platform-web/src/indexedDbLibraryCacheStorage.ts` only).
- **Scope**: `(serverKey, libraryId)` — same idea as legacy `(server_id, library_id)`. Today `libraryId` is the placeholder `default` until we add Subsonic music-folder selection (`getMusicFolders`).
- **Stores**: `songs`, `meta`, `playlists` (playlist summaries after a sync).

Album and artist **lists are derived in memory** from cached songs using the same bucketing rules as `LibraryIndexFromSongs` (`packages/core/src/library/libraryIndexFromSongs.ts`).

## iOS / desktop / Android

See `ios/NOTE.md`, `desktop/NOTE.md`, and `android/NOTE.md` for other platforms.
