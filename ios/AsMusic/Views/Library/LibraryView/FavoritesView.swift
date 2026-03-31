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
      await loadFromCacheOrServer()
    }
    .refreshable {
      await reloadFromServer()
      refreshCoordinator.bump()
    }
  }

  private func loadFromCacheOrServer() async {
    let cacheKey = LibrarySongCacheKey.current(for: client)
    if let cachedSongs = await SongCacheStore.shared.loadSongs(for: cacheKey),
      !cachedSongs.isEmpty
    {
      songs = cachedSongs
      errorMessage = nil
      return
    }
    await reloadFromServer()
  }

  private func reloadFromServer() async {
    isLoading = true
    defer { isLoading = false }
    do {
      let (fetched, _) = try await LibrarySongFetch.loadSongs(client: client)
      songs = fetched
      let cacheKey = LibrarySongCacheKey.current(for: client)
      await SongCacheStore.shared.saveSongs(fetched, for: cacheKey)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}


