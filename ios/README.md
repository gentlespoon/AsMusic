# AsMusic — iOS

Native SwiftUI client for **Navidrome** and other **Subsonic-compatible** servers. It lives under the monorepo root; see the [repository README](../README.md) for the overall project status and platform matrix.

## Requirements

- **Xcode** — use a current stable release that matches the Swift toolchain expected by the app and local packages (CI uses `latest-stable` from [`.github/workflows/build-ios.yml`](../.github/workflows/build-ios.yml)).
- **Swift** — 6.x (see `SWIFT_VERSION` in `AsMusic.xcodeproj` and `swift-tools-version` in `AsNavidromeKit/Package.swift`).
- **Deployment target** — defined in `AsMusic.xcodeproj` (`IPHONEOS_DEPLOYMENT_TARGET`). Run on a device or simulator that meets that minimum.

## Getting started

1. Open `AsMusic.xcodeproj` in Xcode.
2. Select the **AsMusic** scheme and your run destination (simulator or device).
3. Build and run (**⌘R**).

First launch: configure a library/server in **Settings** so the app can reach your Navidrome or Subsonic instance.

## Project structure

| Path | Purpose |
|------|---------|
| `AsMusic.xcodeproj` | Xcode project for the iOS app. |
| `AsMusic/` | Application sources: SwiftUI views, app entry (`AsMusicApp.swift`), assets, and `AsMusic-Info.plist`. |
| `AsMusic/Views/` | UI grouped by feature (e.g. `TabView/`, `Library/`, `PlayerView/`, `Settings/`). |
| `AsMusic/Managers/` | Playback, networking session, downloads, CarPlay, and related controllers. |
| `AsMusic/Stores/` | Caching and library/playlist state used by the UI layer. |
| `AsMusic/Models/` | App-level models and small types shared across views. |
| `AsNavidromeKit/` | **Swift Package** — Subsonic API client, request/auth helpers, and shared `Song` / `Album` / `Artist` / `Playlist` models. |
| `AsNavidromeKit/Tests/` | Unit tests for the package (`AsNavidromeKitTests`). |
| `AppStoreDescription.md` | App Store–oriented copy (not build input). |

The app target depends on **AsNavidromeKit** as a local package dependency; edit the package under `AsNavidromeKit/Sources/AsNavidromeKit/` when changing API or model code.

## Command-line build (CI parity)

From the repository root, an unsigned device SDK build (as used in CI):

```bash
xcodebuild clean build \
  -project ios/AsMusic.xcodeproj \
  -scheme AsMusic \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO
```

## Tests

- **Package tests**: In Xcode, select the `AsNavidromeKit` scheme and run tests, or from `ios/AsNavidromeKit`:

  ```bash
  swift test
  ```

## Continuous integration

Pushes and pull requests that touch `ios/**` run the **Build iOS** workflow; status is shown in the root [README](../README.md).
