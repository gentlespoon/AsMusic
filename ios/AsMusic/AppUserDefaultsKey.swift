//
//  AppUserDefaultsKey.swift
//  AsMusic
//
//  Central `UserDefaults` keys for user preferences.
//
//  **Convention:** `app.<domain>.<feature…>`
//  - `app` — app-wide scope (not per-server or per-library).
//  - `<domain>` — area: `ui`, `feedback`, `playback`, `library`, etc.
//  - Additional dot segments narrow the setting (`enabled`, `seconds`, or a stable slug).
//
//  **Examples for future keys:** `app.playback.crossfade.seconds`,
//  `app.library.showCompilationAlbums`, `app.diagnostics.analytics.enabled`.
//

import Foundation

enum AppUserDefaultsKey {

  enum UI {
    /// Color scheme (`AppAppearance.rawValue`). Kept as `app.appearance` for existing installs.
    static let appearance = "app.appearance"
  }

  enum Feedback {
    /// Master switch for haptic feedback in the UI.
    static let hapticsEnabled = "app.feedback.haptics.enabled"
  }
}
