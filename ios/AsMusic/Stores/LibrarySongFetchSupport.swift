//
//  LibrarySongFetchSupport.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

// MARK: - Cache key (shared with `SongCacheStore`)

enum LibrarySongCacheKey {
  static func current(for client: AsNavidromeClient) -> String {
    "songs::\(client.host)::\(client.username)"
  }
}

// MARK: - Fetch (single source for library song list)

enum LibrarySongFetch {
  /// Loads the library song list and a map from song id to client (for album drill-down rows that reuse `SongsView`).
  static func loadSongs(client: AsNavidromeClient) async throws -> (
    songs: [Song],
    songClientsByID: [String: AsNavidromeClient]
  ) {
    let songs = try await client.song.getSongs()
    let map = Dictionary(uniqueKeysWithValues: songs.map { ($0.id, client) })
    return (songs, map)
  }
}

// MARK: - Full library cache refresh (LibraryView pull-to-refresh)

enum LibrarySongCacheReload {
  static func fetchAndSave(client: AsNavidromeClient) async throws {
    let cacheKey = LibrarySongCacheKey.current(for: client)
    let (songs, _) = try await LibrarySongFetch.loadSongs(client: client)
    await SongCacheStore.shared.saveSongs(songs, for: cacheKey)
  }
}
