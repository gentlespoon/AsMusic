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
    .overlay {
      LibraryReloadFromServerOverlay()
    }
  }
}

/// Shown while a full library sync (songs + playlists + indexes) runs after pull-to-refresh or changing library.
private struct LibraryReloadFromServerOverlay: View {
  @State private var coordinator = LibraryRefreshCoordinator.shared

  var body: some View {
    Group {
      if coordinator.isReloadingFromServer {
        ZStack {
          Color.black.opacity(0.32)
            .ignoresSafeArea()
          VStack(spacing: 12) {
            ProgressView()
              .controlSize(.large)
            Text("Loading library from server")
              .font(.headline)
            Group {
              switch coordinator.serverReloadStep {
              case .loadingSongs:
                if coordinator.songsLoadedSoFar > 0 {
                  Text(
                    "\(coordinator.songsLoadedSoFar.formatted(.number.grouping(.automatic))) songs loaded"
                  )
                  .contentTransition(.numericText())
                  .animation(.default, value: coordinator.songsLoadedSoFar)
                } else {
                  Text("Starting…")
                }
              case .loadingPlaylists:
                Text("Loading playlists…")
              case .savingCaches:
                Text("Building local library…")
              }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
          }
          .multilineTextAlignment(.center)
          .padding(24)
          .frame(maxWidth: 320)
          .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .transition(.opacity)
      }
    }
    .animation(.easeInOut(duration: 0.2), value: coordinator.isReloadingFromServer)
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
