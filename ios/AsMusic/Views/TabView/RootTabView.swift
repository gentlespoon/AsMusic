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

struct RootTabView: View {
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


#Preview {
  RootTabView()
    .environment(MusicPlayerController.previewMockedController())
}
