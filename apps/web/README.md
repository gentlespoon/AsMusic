# AsMusic Web (Capacitor app)

Capacitor-first **React shell** for Navidrome (Subsonic API). This package (`apps/web`) is the Vite entry and Capacitor project root. Shared code lives in **`packages/`**:

| Package | Role |
|--------|------|
| `@asmusic/ui` | React UI (routes, screens, MUI theme, `HostProvider` / `AuthProvider`) |
| `@asmusic/core` | Subsonic client, library sync/indexing, `PlatformHost` types, `LibraryCacheStorage` contract |
| `@asmusic/platform-web` | Browser host: IndexedDB cache + `<audio>` + `localStorage` |
| `@asmusic/platform-capacitor` | iOS Capacitor host: native plugin + SQLite-backed cache |
| `@asmusic/shell` | `createPlatformHost()` — picks browser vs iOS at runtime |

## Setup (from repository root)

```bash
pnpm install
pnpm dev
```

## iOS (Capacitor)

The bundle is embedded in the native iOS shell under [`../../ios/`](../../ios/).

```bash
pnpm run cap:sync
pnpm run cap:open:ios
# or: pnpm --filter asmusic-web exec cap run ios
```

`capacitor.config.ts` sets **`ios.scheme: 'AsMusic'`** (Capacitor’s default is `App`). In Xcode, open **`ios/App/App.xcodeproj`**, select the **AsMusic** scheme, and run on a device or simulator.

## API layer

[subsonic-api](https://github.com/explodingcamera/subsonic-api) is wrapped in `@asmusic/core` (`createNavidromeApi`, `ping`, etc.).

## Env

- **`VITE_NAVIDROME_URL`** — optional default server URL for the login form (handy in dev).
