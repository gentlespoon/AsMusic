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

  @State private var albumSummaries: [AlbumSummary] = []
  @State private var songsByAlbumID: [String: [Song]] = [:]
  @State private var artistSongs: [Song] = []
  @State private var errorMessage: String?
  @State private var searchText = ""

  init(artist: Artist? = nil) {
    self.artist = artist
  }

  private var searchQuery: String {
    searchText.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var filteredAlbums: [AlbumSummary] {
    let query = searchQuery
    guard !query.isEmpty else { return albumSummaries }
    let needle = query.lowercased()
    return albumSummaries.filter { album in
      album.name.lowercased().contains(needle)
        || (album.artistName?.lowercased().contains(needle) ?? false)
    }
  }

  /// When the artist has songs, the "All Songs" row stays available while filtering albums.
  private var showsAllSongsRow: Bool {
    artist != nil && !artistSongs.isEmpty
  }

  private var showsNoSearchResults: Bool {
    !searchQuery.isEmpty && filteredAlbums.isEmpty && !showsAllSongsRow
  }

  private func artistLine(for album: AlbumSummary) -> String? {
    let trimmedAlbumArtist = album.artistName?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let trimmedAlbumArtist, !trimmedAlbumArtist.isEmpty {
      return trimmedAlbumArtist
    }
    let trimmedSelectedArtist = artist?.name.trimmingCharacters(in: .whitespacesAndNewlines)
    if let trimmedSelectedArtist, !trimmedSelectedArtist.isEmpty {
      return trimmedSelectedArtist
    }
    return nil
  }

  private func songCountLine(for album: AlbumSummary) -> String {
    let songCount = album.songCount
    return "\(songCount) \(songCount == 1 ? "song" : "songs")"
  }

  private func subtitleLine(for album: AlbumSummary) -> String {
    if let artistLine = artistLine(for: album) {
      return "\(artistLine) · \(songCountLine(for: album))"
    }
    return "· \(songCountLine(for: album))"
  }

  private func albumArtworkURL(for album: AlbumSummary) -> URL? {
    ArtworkURLSupport.coverArtURL(client: client, artworkID: album.artworkID)
  }

  var body: some View {
    List {
      if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Albums",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if artist != nil, artistSongs.isEmpty, albumSummaries.isEmpty {
        ContentUnavailableView(
          "No Music",
          systemImage: "opticaldisc",
          description: Text("No albums or songs found for this artist.")
        )
      } else if artist == nil, albumSummaries.isEmpty {
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
              navigationTitle: "All Songs"
            )
          } label: {
            Label("All Songs", systemImage: "music.note.list")
          }
        }

        ForEach(filteredAlbums) { album in
          NavigationLink {
            SongsView(
              songs: songsForAlbum(album),
              navigationTitle: album.name,
              albumArtworkURL: albumArtworkURL(for: album)
            )
          } label: {
            HStack(alignment: .center) {
              ArtworkView(artworkURL: albumArtworkURL(for: album))
                .frame(width: 40, height: 40)
                .cornerRadius(4)
              VStack(alignment: .leading, spacing: 2) {
                Text(album.name)
                Text(subtitleLine(for: album))
                  .font(.caption)
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
      await loadAlbumsFromCacheOnly()
    }
  }

  private func songsForAlbum(_ album: AlbumSummary) -> [Song] {
    return songsByAlbumID[album.id] ?? []
  }

  private func buildSongIndexes(from songs: [Song]) {
    var byAlbum: [String: [Song]] = [:]
    for song in songs {
      let albumID = song.albumId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      guard !albumID.isEmpty else { continue }
      byAlbum[albumID, default: []].append(song)
    }
    songsByAlbumID = byAlbum

    guard let artist else {
      artistSongs = []
      return
    }
    artistSongs = songs.filter { $0.artistId == artist.id }
  }

  private func applyCachedData(albums: [AlbumSummary], songs: [Song]) {
    albumSummaries = albums
    buildSongIndexes(from: songs)
  }

  private func loadAlbumsFromCacheOnly() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      applyCachedData(albums: [], songs: [])
      errorMessage = nil
      return
    }

    let albums =
      await AlbumCacheStore.shared.loadAlbumSummaries(
        serverID: scope.serverID,
        libraryID: scope.libraryID,
        artistID: artist?.id
      ) ?? []
    let songs =
      await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ) ?? []
    applyCachedData(albums: albums, songs: songs)
    errorMessage = nil
  }
}
