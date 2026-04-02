//
//  AppAppearance.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI

enum AppAppearance: String, CaseIterable, Identifiable {
  case system
  case light
  case dark

  var id: String { rawValue }

  var symbolName: String {
    switch self {
    case .light:
      return "sun.max"
    case .system:
      return "circle.lefthalf.filled"
    case .dark:
      return "moon"
    }
  }

  var title: String {
    switch self {
    case .light:
      return "Light"
    case .system:
      return "System"
    case .dark:
      return "Dark"
    }
  }

  var colorScheme: ColorScheme? {
    switch self {
    case .light:
      return .light
    case .system:
      return nil
    case .dark:
      return .dark
    }
  }
}
