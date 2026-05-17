# AsMusic on Android — notes

## Library cache

When we ship an Android client, the **local library cache should use SQLite**, not IndexedDB (IndexedDB is a web API and is not the primary persistence layer on native Android).

Align the schema and sync flow with:

- **Legacy reference**: `legacy-swiftui-ios/` — `SongCacheStore`, `AlbumCacheStore`, `ArtistCacheStore`, `PlaylistSummaryCacheStore`, and `LibrarySongCacheReload` (full paginated song fetch, then derived album/artist indexes and playlist summaries).
- **Web parity**: `packages/core/src/library/` and `packages/platform-web/` — IndexedDB implementation and `libraryIndexFromSongs.ts` derivation rules.

This keeps one conceptual model across platforms: **Subsonic network fetch → durable local store → UI reads from the store.**
