//
//  ArtistsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import SwiftUI

struct ArtistsView: View {
  @Environment(\.libraryClient) private var client

  @State private var artists: [Artist] = []
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

  private var filteredArtists: [Artist] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return artists }
    let needle = query.lowercased()
    return artists.filter { $0.name.lowercased().contains(needle) }
  }

  var body: some View {
    List {
      if isLoading && artists.isEmpty {
        ProgressView("Loading artists...")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Artists",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if artists.isEmpty {
        ContentUnavailableView(
          "No Artists",
          systemImage: "music.mic",
          description: Text("No artists found for this library.")
        )
      } else if filteredArtists.isEmpty {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No artists match your search.")
        )
      } else {
        ForEach(filteredArtists) { artist in
          NavigationLink {
            AlbumsView(artist: artist)
          } label: {
            Text(artist.name)
          }
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter artists")
    .navigationTitle("Artists")
    .task {
      await loadArtistsFromSongCacheOrServer()
    }
  }

  private func loadArtistsFromSongCacheOrServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    if let cachedSongs = await SongCacheStore.shared.loadSongs(for: cacheKey),
      !cachedSongs.isEmpty
    {
      artists = LibraryIndexFromSongs.artists(from: cachedSongs)
      errorMessage = nil
      return
    }

    await reloadArtistsFromSongServer()
  }

  private func reloadArtistsFromSongServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    isLoading = true
    defer { isLoading = false }

    do {
      let (songs, _) = try await LibrarySongFetch.loadSongs(client: client)

      await SongCacheStore.shared.saveSongs(songs, for: cacheKey)
      artists = LibraryIndexFromSongs.artists(from: songs)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
