//
//  AsMusicApp.swift
//  AsMusic
//
//  Created by An So on 2026-03-14.
//

import AVFoundation
import AppIntents
import CarPlay
import SwiftUI
import UIKit

@main
struct AsMusicApp: App {
  @UIApplicationDelegateAdaptor(AsMusicAppDelegate.self) private var appDelegate
  @State private var navidromeSession = AppDependencies.navidromeSession
  @State private var musicPlayer = AppDependencies.musicPlayer
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

final class AsMusicAppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    if connectingSceneSession.role == .carTemplateApplication {
      let configuration = UISceneConfiguration(name: "CarPlay", sessionRole: connectingSceneSession.role)
      configuration.delegateClass = CarPlaySceneDelegate.self
      return configuration
    }

    return UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
  }
}