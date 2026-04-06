//
//  SongsViewFileSupport.swift
//  AsMusic
//

import Foundation

enum SongsViewFileSupport {
  static func resolvedAlbumArtworkDisplayURL(for injected: URL?) async -> URL? {
    guard let injected else { return nil }
    return await ArtworkFileCache.displayURL(for: injected)
  }

  static func removeDownloadedFileAndMarker(at localURL: URL) throws {
    let fileManager = FileManager.default
    if fileManager.fileExists(atPath: localURL.path(percentEncoded: false)) {
      try fileManager.removeItem(at: localURL)
    }
    let markerURL = localURL.appendingPathExtension("cachecomplete")
    if fileManager.fileExists(atPath: markerURL.path(percentEncoded: false)) {
      try fileManager.removeItem(at: markerURL)
    }
  }
}
