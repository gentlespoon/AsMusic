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
  /// Subsonic song id. Queue stores only ids; song list cache is the source of truth.
  let id: String

  init(rowId: UUID = UUID(), id: String) {
    self.rowId = rowId
    self.id = id
  }
}
