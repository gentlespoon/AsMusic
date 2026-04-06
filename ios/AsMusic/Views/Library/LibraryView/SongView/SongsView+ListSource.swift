//
//  SongsView+ListSource.swift
//  AsMusic
//

import Foundation

extension SongsView {
  enum ListSource: Equatable {
    /// Loads the full library list (cache + server).
    case library
    /// Cached library songs that have a complete on-disk file (same scan as former Downloaded list).
    case downloaded
    /// Songs currently being downloaded by `DownloadManager`.
    case downloading
  }
}
