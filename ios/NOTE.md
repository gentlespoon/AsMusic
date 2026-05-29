# AsMusic on iOS (Capacitor shell) — notes

## Equalizer (deferred)

Playback today uses **`AVPlayer`** in `AsmusicNativePlugin.swift`, which has no built-in EQ. A global equalizer for **streaming + offline** requires native DSP — likely `AVAudioEngine` + `AVAudioUnitEQ` or an `MTAudioProcessingTap` on `AVPlayerItem`. Full plan: [`.cursor/plans/equalizer_platformhost.plan.md`](../.cursor/plans/equalizer_platformhost.plan.md).

## Xcode scheme / product name

- Shared scheme: **`AsMusic`** (`ios/App/App.xcodeproj/xcshareddata/xcschemes/AsMusic.xcscheme`).
- Shipped bundle: **`AsMusic.app`** (`PRODUCT_NAME = AsMusic` on the `App` target).
- **`cap run ios`** uses `ios.scheme: 'AsMusic'` in `apps/web/capacitor.config.ts` (Capacitor CLI defaults to `App`).

## Library cache

The React UI still runs in **WKWebView**, but the **library mirror is stored in native SQLite**, not in IndexedDB. The web layer uses the same `LibraryCacheStorage` contract as the browser; on iOS, `iosCapacitorHost` wires `createCapacitorIosSqliteLibraryCacheStorage()` (`packages/platform-capacitor/src/capacitorIosSqliteLibraryCacheStorage.ts`), which calls the **AsmusicNative** Capacitor plugin.

### Native implementation

| Piece | Location |
| ----- | -------- |
| SQLite schema + transactions | `ios/App/App/LibraryCacheSQLiteStore.swift` |
| JS bridge methods | `ios/App/App/AsmusicNativePlugin.swift` (`libraryCache*` methods) |
| TypeScript client | `packages/platform-capacitor/src/asmusicNativePlugin.ts` |

Database file: **Application Support** → `AsMusic/Database/library-cache.sqlite3` (sandboxed app container). Tables: `library_songs`, `library_meta`, `library_playlists`, keyed by `(server_key, library_id)` to match the web scope model.

### Legacy SwiftUI parity

The legacy app used `Documents/Database/library-cache.sqlite3` with a richer multi-table layout (`legacy-swiftui-ios/AsMusic/Stores/`). The Capacitor schema is **intentionally aligned with the current web cache** (flat song JSON rows + meta + playlist summaries) so one JS sync path can talk to either IndexedDB or SQLite without branching UI logic.

### Browser / dev

`browserHost` continues to use IndexedDB (`packages/platform-web/src/indexedDbLibraryCacheStorage.ts`). The web `AsmusicNative` stub throws if library cache methods are invoked outside the iOS shell (they are not used on web).
