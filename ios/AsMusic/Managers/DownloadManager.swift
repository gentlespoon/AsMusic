//
//  DownloadManager.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum DownloadManager {
  struct LocalDownloadedList {
    let songs: [Song]
    let playbackURLsBySongID: [String: URL]
  }

  private actor DownloadRegistry {
    var songsByID: [String: Song] = [:]
    var tasksByID: [String: Task<Result<Void, Error>, Never>] = [:]
    var progressByID: [String: Double] = [:]

    func contains(_ songID: String) -> Bool {
      tasksByID[songID] != nil
    }

    func register(song: Song, task: Task<Result<Void, Error>, Never>) {
      songsByID[song.id] = song
      tasksByID[song.id] = task
    }

    func setProgress(songID: String, progress: Double?) {
      guard songsByID[songID] != nil else { return }
      if let progress {
        progressByID[songID] = min(max(progress, 0), 1)
      } else {
        progressByID[songID] = nil
      }
    }

    func finish(songID: String) {
      tasksByID[songID] = nil
      songsByID[songID] = nil
      progressByID[songID] = nil
    }

    func cancel(songID: String) {
      tasksByID[songID]?.cancel()
      tasksByID[songID] = nil
      songsByID[songID] = nil
      progressByID[songID] = nil
    }

    func songsSnapshotSortedByTitle() -> [Song] {
      songsByID.values.sorted {
        $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
      }
    }

    func progressSnapshot() -> [String: Double] {
      progressByID
    }
  }

  private static let registry = DownloadRegistry()
  nonisolated static let downloadDidFinishNotification = Notification.Name("DownloadManager.downloadDidFinish")
  nonisolated static let downloadingSongsDidChangeNotification = Notification.Name("DownloadManager.downloadingSongsDidChange")
  nonisolated static let downloadProgressDidChangeNotification = Notification.Name("DownloadManager.downloadProgressDidChange")

  static func streamURL(forSongID songID: String, from client: AsNavidromeClient) -> URL {
    client.media.stream(forSongID: songID)
  }

  static func downloadURL(forSongID songID: String, from client: AsNavidromeClient) -> URL {
    client.media.download(forSongID: songID)
  }

  static func streamURL(
    for song: Song,
    preferredClient: AsNavidromeClient?,
    songClientsByID: [String: AsNavidromeClient]
  ) -> URL? {
    if let preferredClient {
      return streamURL(forSongID: song.id, from: preferredClient)
    }
    guard let sourceClient = songClientsByID[song.id] else { return nil }
    return streamURL(forSongID: song.id, from: sourceClient)
  }

  static func canDownload(
    songs: [Song],
    preferredClient: AsNavidromeClient?,
    songClientsByID: [String: AsNavidromeClient]
  ) -> Bool {
    songs.contains { song in
      guard let request = cacheRequest(
        for: song,
        preferredClient: preferredClient,
        songClientsByID: songClientsByID
      ) else {
        return false
      }
      return !SongFileCache.hasCached(for: request)
    }
  }

  static func downloadAllMissing(
    songs: [Song],
    preferredClient: AsNavidromeClient?,
    songClientsByID: [String: AsNavidromeClient]
  ) async -> Int {
    let preferredScope = await cacheScope(for: preferredClient)
    var failedCount = 0
    for song in songs {
      let request: SongFileCache.Request?
      if let preferredClient {
        request = SongFileCache.Request(
          remoteURL: downloadURL(forSongID: song.id, from: preferredClient),
          relativePath: song.path,
          cacheScope: preferredScope
        )
      } else if let sourceClient = songClientsByID[song.id] {
        let scope = await cacheScope(for: sourceClient)
        request = SongFileCache.Request(
          remoteURL: downloadURL(forSongID: song.id, from: sourceClient),
          relativePath: song.path,
          cacheScope: scope
        )
      } else {
        request = nil
      }
      guard let request else { continue }
      if SongFileCache.hasCached(for: request) {
        continue
      }
      if await registry.contains(song.id) {
        continue
      }

      let task = Task<Result<Void, Error>, Never> {
        do {
          try await SongFileCache.downloadFullToCache(request: request) { progress in
            Task {
              await registry.setProgress(songID: song.id, progress: progress)
              postDownloadProgressDidChange()
            }
          }
          await registry.finish(songID: song.id)
          postDownloadingSongsDidChange()
          postDownloadProgressDidChange()
          postDownloadDidFinish(songID: song.id)
          return .success(())
        } catch {
          await registry.finish(songID: song.id)
          postDownloadingSongsDidChange()
          postDownloadProgressDidChange()
          return .failure(error)
        }
      }
      await registry.register(song: song, task: task)
      postDownloadingSongsDidChange()
      switch await task.value {
      case .success:
        break
      case .failure(let error):
        if error is CancellationError {
          break
        }
        failedCount += 1
      }
    }
    return failedCount
  }

  static func downloadingSongs() async -> [Song] {
    await registry.songsSnapshotSortedByTitle()
  }

  static func downloadingProgressBySongID() async -> [String: Double] {
    await registry.progressSnapshot()
  }

  static func removeFromDownloading(songID: String) async {
    await registry.cancel(songID: songID)
    postDownloadingSongsDidChange()
    postDownloadProgressDidChange()
  }

  /// Source of truth for the downloaded songs list shown in `SongsView` local mode.
  static func localDownloadedSongs(for client: AsNavidromeClient) async -> LocalDownloadedList {
    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      return LocalDownloadedList(songs: [], playbackURLsBySongID: [:])
    }
    guard
      let cachedSongs = await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ),
      !cachedSongs.isEmpty
    else {
      return LocalDownloadedList(songs: [], playbackURLsBySongID: [:])
    }

    var entries: [(song: Song, localURL: URL)] = []
    for song in cachedSongs {
      let request = SongFileCache.Request(
        remoteURL: downloadURL(forSongID: song.id, from: client),
        relativePath: song.path,
        cacheScope: SongFileCache.CacheScope(serverID: scope.serverID, libraryID: scope.libraryID)
      )
      if let localURL = SongFileCache.existingLocalFileURLIfPresent(for: request) {
        entries.append((song: song, localURL: localURL))
      }
    }
    entries.sort {
      $0.song.title.localizedCaseInsensitiveCompare($1.song.title) == .orderedAscending
    }

    return LocalDownloadedList(
      songs: entries.map(\.song),
      playbackURLsBySongID: Dictionary(
        uniqueKeysWithValues: entries.map { ($0.song.id, $0.localURL) }
      )
    )
  }

  private static func cacheScope(for client: AsNavidromeClient?) async -> SongFileCache.CacheScope? {
    guard let client else { return nil }
    guard let scope = await LibrarySongCacheScope.current(for: client) else { return nil }
    return SongFileCache.CacheScope(serverID: scope.serverID, libraryID: scope.libraryID)
  }

  private static func cacheRequest(
    for song: Song,
    preferredClient: AsNavidromeClient?,
    songClientsByID: [String: AsNavidromeClient]
  ) -> SongFileCache.Request? {
    if let preferredClient {
      return SongFileCache.Request(
        remoteURL: downloadURL(forSongID: song.id, from: preferredClient),
        relativePath: song.path
      )
    }
    guard let sourceClient = songClientsByID[song.id] else { return nil }
    return SongFileCache.Request(
      remoteURL: downloadURL(forSongID: song.id, from: sourceClient),
      relativePath: song.path
    )
  }

  nonisolated private static func postDownloadingSongsDidChange() {
    Task { @MainActor in
      NotificationCenter.default.post(name: downloadingSongsDidChangeNotification, object: nil)
    }
  }

  nonisolated private static func postDownloadDidFinish(songID: String) {
    Task { @MainActor in
      NotificationCenter.default.post(
        name: downloadDidFinishNotification,
        object: nil,
        userInfo: ["songID": songID]
      )
    }
  }

  nonisolated private static func postDownloadProgressDidChange() {
    Task { @MainActor in
      NotificationCenter.default.post(name: downloadProgressDidChangeNotification, object: nil)
    }
  }
}
