//
//  SettingsCacheView.swift
//  AsMusic
//
//  Created by An So on 2026-04-02.
//

import SwiftUI

struct SettingsCacheView: View {
  @State private var isConfirmingCacheReset = false
  @State private var isConfirmingFileCacheReset = false
  @State private var cacheResetResultMessage: String?

  var body: some View {
    List {
      Section {
        Button(role: .destructive) {
          isConfirmingCacheReset = true
        } label: {
          Label("Reset library database", systemImage: "arrow.clockwise")
        }
        Button(role: .destructive) {
          isConfirmingFileCacheReset = true
        } label: {
          Label("Delete downloaded media", systemImage: "trash")
        }
      }
    }
    .foregroundStyle(.red)
    .navigationTitle("Cache")
    .navigationBarTitleDisplayMode(.inline)
    .confirmationDialog(
      "Reset library database?",
      isPresented: $isConfirmingCacheReset,
      titleVisibility: .visible
    ) {
      Button("Reset", role: .destructive) {
        Task {
          let success = await LibraryCacheMaintenance.resetDatabase()
          cacheResetResultMessage =
            success
            ? "Library database has been reset."
            : "Failed to reset library database."
        }
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text(
        "This deletes cached songs, playlists, folders, artists, and albums metadata. This does NOT delete your downloaded media files."
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
      Text("This deletes downloaded media files. This does NOT reset local library database.")
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

#Preview {
  NavigationStack {
    SettingsCacheView()
  }
}
