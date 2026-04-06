//
//  SongsViewFilter.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum SongsViewFilter {
  static func filteredSongs(from displaySongs: [Song], searchText: String) -> [Song] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return displaySongs }
    let needle = query.lowercased()
    return displaySongs.filter { song in
      song.title.lowercased().contains(needle)
        || (song.artist?.lowercased().contains(needle) ?? false)
        || (song.album?.lowercased().contains(needle) ?? false)
    }
  }

  static func playableQueueItems(
    from songs: [Song],
    playbackURL: (Song) -> URL?
  ) -> [NowPlayingQueueItem] {
    songs.compactMap { song in
      guard playbackURL(song) != nil else { return nil }
      return NowPlayingQueueItem(id: song.id)
    }
  }
}
