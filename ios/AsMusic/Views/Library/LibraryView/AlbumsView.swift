//
//  AlbumsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import SwiftUI

struct AlbumsView: View {
  /// When set, shows this artist’s albums plus “All Songs”; when `nil`, the full library album list.
  private let artist: Artist?

  @Environment(\.libraryClient) private var client

  @State private var allSongs: [Song] = []
  @State private var songClientsByID: [String: AsNavidromeClient] = [:]
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

  init(artist: Artist? = nil) {
    self.artist = artist
  }

  private var displayAlbums: [Album] {
    guard let artist else {
      return LibraryIndexFromSongs.albums(from: allSongs)
    }
    return LibraryIndexFromSongs.albums(for: artist, from: allSongs)
  }

  private var artistSongs: [Song] {
    guard let artist else { return [] }
    return LibraryIndexFromSongs.songs(for: artist, from: allSongs)
  }

  private var searchQuery: String {
    searchText.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var filteredAlbums: [Album] {
    let query = searchQuery
    guard !query.isEmpty else { return displayAlbums }
    let needle = query.lowercased()
    return displayAlbums.filter { album in
      album.name.lowercased().contains(needle)
        || (album.artist?.lowercased().contains(needle) ?? false)
    }
  }

  /// When the artist has songs, the "All Songs" row stays available while filtering albums.
  private var showsAllSongsRow: Bool {
    artist != nil && !artistSongs.isEmpty
  }

  private var showsNoSearchResults: Bool {
    !searchQuery.isEmpty && filteredAlbums.isEmpty && !showsAllSongsRow
  }

  var body: some View {
    List {
      if isLoading && allSongs.isEmpty {
        ProgressView("Loading albums...")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Albums",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if let artist, artistSongs.isEmpty {
        ContentUnavailableView(
          "No Music",
          systemImage: "opticaldisc",
          description: Text("No albums or songs found for this artist.")
        )
      } else if artist == nil, displayAlbums.isEmpty {
        ContentUnavailableView(
          "No Albums",
          systemImage: "opticaldisc",
          description: Text("No albums found for this library.")
        )
      } else if showsNoSearchResults {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No albums match your search.")
        )
      } else {
        if showsAllSongsRow {
          NavigationLink {
            SongsView(
              songs: artistSongs,
              navigationTitle: "All Songs",
              songClientsByID: songClientsByID
            )
          } label: {
            Label("All Songs", systemImage: "music.note.list")
          }
        }

        ForEach(filteredAlbums) { album in
          NavigationLink {
            if let artist {
              SongsView(
                songs: LibraryIndexFromSongs.songs(in: album, for: artist, from: allSongs),
                navigationTitle: album.name,
                songClientsByID: songClientsByID
              )
            } else {
              SongsView(
                songs: LibraryIndexFromSongs.songs(in: album, from: allSongs),
                navigationTitle: album.name,
                songClientsByID: songClientsByID
              )
            }
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(album.name)
              if let line = album.artist, !line.isEmpty {
                Text(line)
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter albums")
    .navigationTitle(artist?.name ?? "Albums")
    .navigationBarTitleDisplayMode(artist == nil ? .automatic : .inline)
    .task {
      await loadAlbumsFromSongCacheOrServer()
    }
  }

  private func loadAlbumsFromSongCacheOrServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    if let cachedSongs = await SongCacheStore.shared.loadSongs(for: cacheKey),
      !cachedSongs.isEmpty
    {
      allSongs = cachedSongs
      errorMessage = nil
      return
    }

    await reloadAlbumsFromSongServer()
  }

  private func reloadAlbumsFromSongServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    isLoading = true
    defer { isLoading = false }

    do {
      let (songs, clientsMap) = try await LibrarySongFetch.loadSongs(client: client)

      allSongs = songs
      songClientsByID = clientsMap
      await SongCacheStore.shared.saveSongs(songs, for: cacheKey)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
