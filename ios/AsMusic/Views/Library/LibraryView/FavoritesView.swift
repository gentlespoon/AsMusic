//
//  FavoritesView.swift
//  AsMusic
//
//  Created by An So on 2026-03-30.
//

import AsNavidromeKit
import SwiftUI

struct FavoritesView: View {
  let client: AsNavidromeClient

  @State private var refreshCoordinator = LibraryRefreshCoordinator.shared
  @State private var songs: [Song] = []
  @State private var isLoading = false
  @State private var errorMessage: String?

  private var starredSongs: [Song] {
    songs
      .filter { $0.starred != nil }
      .sorted { lhs, rhs in
        lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
      }
  }

  var body: some View {
    Group {
      if isLoading && songs.isEmpty {
        ProgressView("Loading favorites…")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Favorites",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else {
        SongsView(songs: starredSongs, navigationTitle: "Favorites")
      }
    }
    .navigationTitle("Favorites")
    .task(id: refreshCoordinator.generation) {
      await loadFromCache()
    }
    .refreshable {
      await loadFromCache()
      refreshCoordinator.bump()
    }
  }

  private func loadFromCache() async {
    isLoading = true
    defer { isLoading = false }
    if let scope = await LibrarySongCacheScope.current(for: client),
      let cachedSongs = await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )
    {
      songs = cachedSongs
    } else {
      songs = []
    }
    errorMessage = nil
  }
}


