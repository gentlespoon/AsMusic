//
//  AppLog.swift
//  AsMusic
//

import Foundation
import os

enum AppLog {
  static let audio = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "AsMusic",
    category: "audio"
  )
}
