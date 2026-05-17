# AsMusic on desktop (Electron) — notes

## Library cache

When we ship a desktop/Electron build, the **local library cache should use SQLite** (via `better-sqlite3`, `sql.js`, or another maintained binding), not IndexedDB as the canonical store. IndexedDB in Electron is tied to Chromium and is awkward for tooling, migrations, and sharing with non-web code.

Align the schema and sync flow with:

- **Legacy reference**: `legacy-swiftui-ios/` — `SongCacheStore`, `AlbumCacheStore`, `ArtistCacheStore`, `PlaylistSummaryCacheStore`, and `LibrarySongCacheReload`.
- **Web parity**: `packages/core/src/library/` — same fetch and derivation semantics; SQLite tables should mirror those concerns even if column layout differs.

**Decision**: Desktop/Electron = **SQLite** for the library database; document any deviation from the legacy schema in code comments when implemented.
