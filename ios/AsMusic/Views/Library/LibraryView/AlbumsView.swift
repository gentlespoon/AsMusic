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
  @State private var cachedLibraryAlbums: [Album] = []
  @State private var songClientsByID: [String: AsNavidromeClient] = [:]
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

  init(artist: Artist? = nil) {
    self.artist = artist
  }

  private var displayAlbums: [Album] {
    guard let artist else {
      return cachedLibraryAlbums
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

  private func artistLine(for album: Album) -> String? {
    let trimmedAlbumArtist = album.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let trimmedAlbumArtist, !trimmedAlbumArtist.isEmpty {
      return trimmedAlbumArtist
    }
    let trimmedSelectedArtist = artist?.name.trimmingCharacters(in: .whitespacesAndNewlines)
    if let trimmedSelectedArtist, !trimmedSelectedArtist.isEmpty {
      return trimmedSelectedArtist
    }
    return nil
  }

  private func songCountLine(for album: Album) -> String {
    let songCount: Int
    if let artist {
      songCount = LibraryIndexFromSongs.songs(in: album, for: artist, from: allSongs).count
    } else {
      songCount = LibraryIndexFromSongs.songs(in: album, from: allSongs).count
    }
    return "\(songCount) \(songCount == 1 ? "song" : "songs")"
  }

  private func subtitleLine(for album: Album) -> String {
    if let artistLine = artistLine(for: album) {
      return "\(artistLine) · \(songCountLine(for: album))"
    }
    return "· \(songCountLine(for: album))"
  }

  private func albumArtworkURL(for album: Album) -> URL? {
    guard let client else { return nil }
    let artworkID = album.coverArt?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !artworkID.isEmpty else { return nil }
    return client.media.coverArt(forID: artworkID, size: 600)
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
                albumArtworkURL: albumArtworkURL(for: album),
                songClientsByID: songClientsByID
              )
            } else {
              SongsView(
                songs: LibraryIndexFromSongs.songs(in: album, from: allSongs),
                navigationTitle: album.name,
                albumArtworkURL: albumArtworkURL(for: album),
                songClientsByID: songClientsByID
              )
            }
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(album.name)
              Text(subtitleLine(for: album))
                .font(.caption)
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

    if let scope = await LibrarySongCacheScope.current(for: client) {
      if artist == nil,
        let cachedAlbums = await AlbumCacheStore.shared.loadAlbums(
          serverID: scope.serverID,
          libraryID: scope.libraryID
        ),
        !cachedAlbums.isEmpty
      {
        cachedLibraryAlbums = cachedAlbums
        allSongs =
          await SongCacheStore.shared.loadSongs(
            serverID: scope.serverID,
            libraryID: scope.libraryID
          ) ?? []
        errorMessage = nil
        return
      }

      if let cachedSongs = await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ),
        !cachedSongs.isEmpty
      {
        allSongs = cachedSongs
        if artist == nil {
          cachedLibraryAlbums = LibraryIndexFromSongs.albums(from: cachedSongs)
        }
        errorMessage = nil
        return
      }
    }

    await reloadAlbumsFromSongServer()
  }

  private func reloadAlbumsFromSongServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      let (_, clientsMap) = try await LibrarySongFetch.loadSongs(client: client)
      songClientsByID = clientsMap
      try await LibrarySongCacheReload.fetchAndSave(client: client)

      if let scope = await LibrarySongCacheScope.current(for: client) {
        if artist == nil {
          cachedLibraryAlbums =
            await AlbumCacheStore.shared.loadAlbums(
              serverID: scope.serverID,
              libraryID: scope.libraryID
            ) ?? []
          allSongs =
            await SongCacheStore.shared.loadSongs(
              serverID: scope.serverID,
              libraryID: scope.libraryID
            ) ?? []
        } else {
          allSongs =
            await SongCacheStore.shared.loadSongs(
              serverID: scope.serverID,
              libraryID: scope.libraryID
            ) ?? []
          cachedLibraryAlbums = []
        }
      } else {
        allSongs = []
        cachedLibraryAlbums = []
      }
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
