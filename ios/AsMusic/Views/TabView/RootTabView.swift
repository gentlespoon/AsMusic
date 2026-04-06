//
//  RootTabView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI

private enum RootTab: Hashable {
  case library
  case queue
  case settings
}

/// Hosts the main `TabView` and player accessory without `@AppStorage`, so `MusicPlayerController`
/// observation in `PlayerBarView` stays reliable (mixing `@AppStorage` + `@Environment` on the same
/// view that owns `tabViewBottomAccessory` can suppress accessory updates on some OS versions).
private struct RootTabContent: View {
  @Environment(MusicPlayerController.self) private var playback
  @State private var selectedTab: RootTab = .library
  @State private var isQueueSheetPresented = false

  var body: some View {
    TabView(selection: $selectedTab) {
      Tab("Library", systemImage: "music.note.list", value: RootTab.library) {
        LibraryTabRootView()
      }

      Tab("Queue", systemImage: "list.bullet", value: RootTab.queue) {
        Color.clear
          .accessibilityHidden(true)
      }

      Tab("Settings", systemImage: "gearshape", value: RootTab.settings) {
        NavigationStack {
          SettingsView()
        }
      }
    }
    .tabViewBottomAccessory {
      PlayerBarView()
    }
    .onChange(of: selectedTab) { oldValue, newValue in
      guard newValue == .queue else { return }
      isQueueSheetPresented = true
      DispatchQueue.main.async {
        selectedTab = oldValue
      }
    }
    .sheet(isPresented: $isQueueSheetPresented) {
      PlayingQueueSheetView()
        .environment(playback)
    }
    .sheet(
      isPresented: Binding(
        get: { playback.isPlayerPresented },
        set: { playback.isPlayerPresented = $0 }
      )
    ) {
      PlayerSheetView()
        .environment(playback)
    }
  }
}

struct RootTabView: View {
  @AppStorage(AppUserDefaultsKey.Onboarding.completed) private var hasCompletedOnboarding = false
  @State private var presentOnboarding = false

  var body: some View {
    RootTabContent()
      .task {
        await MainActor.run {
          if !hasCompletedOnboarding {
            let servers = ServerManager().servers
            if !servers.isEmpty, SelectedLibraryStore.shared.selection != nil {
              hasCompletedOnboarding = true
            }
          }
          presentOnboarding = !hasCompletedOnboarding
        }
      }
      .fullScreenCover(isPresented: $presentOnboarding) {
        OnboardingView()
      }
      .onChange(of: hasCompletedOnboarding) { _, completed in
        if completed {
          presentOnboarding = false
        }
      }
  }
}

#Preview {
  RootTabView()
    .environment(MusicPlayerController.previewMockedController())
}
