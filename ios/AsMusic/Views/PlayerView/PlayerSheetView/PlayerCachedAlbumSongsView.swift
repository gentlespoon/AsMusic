//
//  PlayerCachedAlbumSongsView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct PlayerCachedAlbumSongsView: View {
  let albumId: String
  let albumTitle: String
  let artistLine: String?
  let client: AsNavidromeClient

  @State private var songs: [Song] = []
  @State private var songClientsByID: [String: AsNavidromeClient] = [:]

  private var albumArtworkURL: URL? {
    let artworkID = songs.first?.coverArt?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !artworkID.isEmpty else { return nil }
    return client.media.coverArt(forID: artworkID, size: 600)
  }

  var body: some View {
    Group {
      if songs.isEmpty {
        ProgressView("Loading album...")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        SongsView(
          songs: songs,
          navigationTitle: albumTitle,
          albumArtworkURL: albumArtworkURL,
          songClientsByID: songClientsByID
        )
      }
    }
    .environment(\.libraryClient, client)
    .task {
      await loadSongs()
    }
  }

  private func loadSongs() async {
    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      songs = []
      return
    }
    guard let cached = await SongCacheStore.shared.loadSongs(
      serverID: scope.serverID,
      libraryID: scope.libraryID
    ), !cached.isEmpty else {
      songs = []
      return
    }

    let derived = LibraryIndexFromSongs.albums(from: cached)
    let album: Album
    if !albumId.isEmpty, let match = derived.first(where: { $0.id == albumId }) {
      album = match
    } else if let match = derived.first(where: {
      $0.name.caseInsensitiveCompare(albumTitle) == .orderedSame
    }) {
      album = match
    } else {
      album = Album(
        id: albumId.isEmpty ? "player:\(albumTitle.lowercased())" : albumId, name: albumTitle,
        artist: artistLine)
    }

    let list = LibraryIndexFromSongs.songs(in: album, from: cached)
    songs = list
    songClientsByID = Dictionary(uniqueKeysWithValues: list.map { ($0.id, client) })
  }
}
