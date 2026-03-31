//
//  LocalCachedSongList.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum LocalCachedSongList {
  struct Entry {
    let song: Song
    let localURL: URL
  }

  /// From the cached library list, songs that have a complete on-disk cache; sorted by title.
  static func entries(from cachedSongs: [Song], client: AsNavidromeClient?) async -> [Entry] {
    var result: [Entry] = []
    for song in cachedSongs {
      if let localURL = await resolveLocalFileURLIfDownloaded(for: song, client: client) {
        result.append(Entry(song: song, localURL: localURL))
      }
    }
    result.sort {
      $0.song.title.localizedCaseInsensitiveCompare($1.song.title) == .orderedAscending
    }
    return result
  }

  private static func resolveLocalFileURLIfDownloaded(for song: Song, client: AsNavidromeClient?)
    async -> URL?
  {
    guard let client else { return nil }
    let remote = client.media.download(forSongID: song.id)
    return SongFileCache.existingLocalFileURLIfPresent(for: remote, relativePath: song.path)
  }
}
