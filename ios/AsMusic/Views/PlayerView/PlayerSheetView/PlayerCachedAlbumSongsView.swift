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

  var body: some View {
    Group {
      if songs.isEmpty {
        ProgressView("Loading album...")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        SongsView(songs: songs, navigationTitle: albumTitle, songClientsByID: songClientsByID)
      }
    }
    .environment(\.libraryClient, client)
    .task {
      await loadSongs()
    }
  }

  private func loadSongs() async {
    let cacheKey = LibrarySongCacheKey.current(for: client)
    guard let cached = await SongCacheStore.shared.loadSongs(for: cacheKey), !cached.isEmpty else {
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
