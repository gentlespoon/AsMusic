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

  @State private var artists: [ArtistSummary] = []
  @State private var isLoading = true
  @State private var errorMessage: String?
  @State private var searchText = ""

  private var filteredArtists: [ArtistSummary] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return artists }
    let needle = query.lowercased()
    return artists.filter { $0.name.lowercased().contains(needle) }
  }

  var body: some View {
    List {
      if isLoading && artists.isEmpty {
        ProgressView("Loading artists…")
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
            AlbumsView(artist: Artist(id: artist.id, name: artist.name))
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(artist.name)
              Text("\(artist.albumCount) \(artist.albumCount == 1 ? "album" : "albums")")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter artists")
    .navigationTitle("Artists")
    .task {
      await loadArtistsFromCacheOnly()
    }
  }

  private func loadArtistsFromCacheOnly() async {
    isLoading = true
    defer { isLoading = false }

    guard let client else {
      errorMessage = "No library connection."
      return
    }

    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      artists = []
      errorMessage = nil
      return
    }

    artists =
      await ArtistCacheStore.shared.loadArtistSummaries(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ) ?? []
    errorMessage = nil
  }
}
