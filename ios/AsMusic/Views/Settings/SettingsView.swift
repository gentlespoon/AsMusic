//
//  SettingsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI

struct SettingsView: View {
  @AppStorage("app.appearance") private var appAppearanceRaw = AppAppearance.system.rawValue
  @State private var isConfirmingCacheReset = false
  @State private var isConfirmingFileCacheReset = false
  @State private var cacheResetResultMessage: String?

  var body: some View {
    List {

      Section {
        EmptyView()
      } header: {
        Text("How to use Player Bar?")
      } footer: {
        Text(
          """
            Short tap to play/pause.
            Swipe horizontally to skip tracks.
            Swipe up to show player.
            Hold and drag to seek.
          """)
      }

      Section("Appearance") {
        Picker("Color Scheme", selection: $appAppearanceRaw) {
          ForEach(AppAppearance.allCases) { appearance in
            Text(appearance.title).tag(appearance.rawValue)
          }
        }
        .pickerStyle(.segmented)
      }
      Section("Libraries") {
        NavigationLink("Server Manager") {
          ServerManagerView()
        }
        NavigationLink("Libraries") {
          LibrariesView()
        }
      }
      Section("Cache") {
        Button("Reset Library Database Cache", role: .destructive) {
          isConfirmingCacheReset = true
        }
        Button("Delete Downloaded Songs and Artwork", role: .destructive) {
          isConfirmingFileCacheReset = true
        }
      }
    }
    .navigationTitle("Settings")
    .confirmationDialog(
      "Reset Library Cache?",
      isPresented: $isConfirmingCacheReset,
      titleVisibility: .visible
    ) {
      Button("Reset", role: .destructive) {
        Task {
          let success = await LibraryCacheMaintenance.resetAllCaches()
          cacheResetResultMessage =
            success
            ? "Library cache has been reset."
            : "Failed to reset library cache."
        }
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text(
        "This deletes cached songs, playlists, folders, artists, and albums. Data will be reloaded from your server."
      )
    }
    .confirmationDialog(
      "Delete Downloaded Songs and Artwork?",
      isPresented: $isConfirmingFileCacheReset,
      titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        let success = LibraryCacheMaintenance.resetFileAndArtworkCaches()
        cacheResetResultMessage =
          success
          ? "Downloaded songs and artwork cache have been deleted."
          : "Failed to delete downloaded songs and artwork cache."
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("This deletes files under Documents/Music and Documents/Artwork.")
    }
    .alert("Cache", isPresented: cacheResetResultBinding) {
      Button("OK", role: .cancel) {
        cacheResetResultMessage = nil
      }
    } message: {
      Text(cacheResetResultMessage ?? "")
    }
  }

  private var cacheResetResultBinding: Binding<Bool> {
    Binding(
      get: { cacheResetResultMessage != nil },
      set: { isPresented in
        if !isPresented {
          cacheResetResultMessage = nil
        }
      }
    )
  }
}
