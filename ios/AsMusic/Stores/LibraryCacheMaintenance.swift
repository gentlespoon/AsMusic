//
//  LibraryCacheMaintenance.swift
//  AsMusic
//

import Foundation

enum LibraryCacheMaintenance {
  static func resetAllCaches() async -> Bool {
    await SongCacheStore.shared.closeDatabase()
    await PlaylistSummaryCacheStore.shared.closeDatabase()
    await LibraryFoldersCacheStore.shared.closeDatabase()
    await ArtistCacheStore.shared.closeDatabase()
    await AlbumCacheStore.shared.closeDatabase()

    do {
      let dbURL = try databaseURL()
      let fileManager = FileManager.default
      let walURL = URL(fileURLWithPath: dbURL.path + "-wal")
      let shmURL = URL(fileURLWithPath: dbURL.path + "-shm")

      if fileManager.fileExists(atPath: dbURL.path) {
        try fileManager.removeItem(at: dbURL)
      }
      if fileManager.fileExists(atPath: walURL.path) {
        try fileManager.removeItem(at: walURL)
      }
      if fileManager.fileExists(atPath: shmURL.path) {
        try fileManager.removeItem(at: shmURL)
      }
      return true
    } catch {
      return false
    }
  }

  static func resetFileAndArtworkCaches() -> Bool {
    do {
      let fileManager = FileManager.default
      let documents = try fileManager.url(
        for: .documentDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      let musicDirectory = documents.appending(path: "Music", directoryHint: .isDirectory)
      let artworkDirectory = documents.appending(path: "Artwork", directoryHint: .isDirectory)

      if fileManager.fileExists(atPath: musicDirectory.path) {
        try fileManager.removeItem(at: musicDirectory)
      }
      if fileManager.fileExists(atPath: artworkDirectory.path) {
        try fileManager.removeItem(at: artworkDirectory)
      }

      URLCache.shared.removeAllCachedResponses()
      return true
    } catch {
      return false
    }
  }

  private static func databaseURL() throws -> URL {
    let documents = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = documents.appending(path: "Database", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appending(path: "library-cache.sqlite3", directoryHint: .notDirectory)
  }
}

