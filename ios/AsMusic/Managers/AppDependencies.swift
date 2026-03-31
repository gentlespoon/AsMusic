//
//  AppDependencies.swift
//  AsMusic
//

import Foundation

@MainActor
enum AppDependencies {
  static let navidromeSession = NavidromeSession()
  static let musicPlayer = MusicPlayerController()
}
