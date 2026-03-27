//
//  AsMusicApp.swift
//  AsMusic
//
//  Created by An So on 2026-03-14.
//

import AVFoundation
import SwiftUI

@main
struct AsMusicApp: App {
  @State private var navidromeSession = NavidromeSession()
  @State private var musicPlayer = MusicPlayerController()
  @AppStorage("app.appearance") private var appAppearanceRaw = AppAppearance.system.rawValue

  init() {
    // iOS 26+: Enable Observation for AVPlayer so SwiftUI can observe playback state.
    AVPlayer.isObservationEnabled = true
    configureAudioSession()
  }

  var body: some Scene {
    WindowGroup {
      RootTabView()
        .environment(navidromeSession)
        .environment(musicPlayer)
        .preferredColorScheme(appAppearance.colorScheme)
        .task {
          await musicPlayer.restorePlaybackIfNeeded()
        }
    }
  }

  private var appAppearance: AppAppearance {
    AppAppearance(rawValue: appAppearanceRaw) ?? .system
  }

  private func configureAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(
        .playback,
        mode: .default,
        options: [.allowAirPlay, .allowBluetoothA2DP]
      )
      try session.setActive(true)
    } catch {
      print("Failed to configure audio session: \(error.localizedDescription)")
    }
  }
}