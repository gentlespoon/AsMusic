//
//  AppHaptics.swift
//  AsMusic
//

import Foundation

#if canImport(UIKit)
  import UIKit

  enum AppHaptics {
    /// Impact feedback when the user has not disabled haptics in Settings.
    static func playImpactIfEnabled(style: UIImpactFeedbackGenerator.FeedbackStyle = .soft) {
      guard UserDefaults.standard.bool(forKey: AppUserDefaultsKey.Feedback.hapticsEnabled) else {
        return
      }
      let generator = UIImpactFeedbackGenerator(style: style)
      generator.impactOccurred()
    }
  }

#else

  enum AppHaptics {
    static func playImpactIfEnabled() {}
  }

#endif
