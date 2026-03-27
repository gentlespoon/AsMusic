//
//  NowPlayingQueueItem.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import Foundation

/// Local playback queue entry (not server playlists). Built on the fly for skip-next and auto-advance.
struct NowPlayingQueueItem: Identifiable, Equatable {
  /// Stable row identity for list reorder / duplicate `id` (same song twice).
  let rowId: UUID
  let id: String
  let url: URL
  let cacheRelativePath: String?
  let metadata: PlaybackTrackMetadata

  init(rowId: UUID = UUID(), id: String, url: URL, cacheRelativePath: String?, metadata: PlaybackTrackMetadata) {
    self.rowId = rowId
    self.id = id
    self.url = url
    self.cacheRelativePath = cacheRelativePath
    self.metadata = metadata
  }
}
