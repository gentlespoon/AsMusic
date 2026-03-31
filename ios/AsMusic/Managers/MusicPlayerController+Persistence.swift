//
//  MusicPlayerController+Persistence.swift
//  AsMusic
//

import AVFoundation
import Foundation

extension MusicPlayerController {
  static let persistedPlaybackKey = "asmusic.persistedPlayback"
  static let playbackPersistThrottleSeconds: TimeInterval = 1.5

  /// Serializable queue row (rebuilds stream URL via Subsonic id + server base; local files by path).
  struct PersistedQueueEntry: Codable {
    var id: String
  }

  struct PersistedPlaybackState: Codable {
    var songId: String?
    var streamBaseURLString: String?
    var localFileURLString: String?
    var cacheRelativePath: String?
    var metadata: PlaybackTrackMetadata
    var positionSeconds: Double
    var wasPlaying: Bool
    /// When present and non-empty, restores the full queue; otherwise legacy single-track restore runs.
    var queueEntries: [PersistedQueueEntry]?
    var currentQueueIndex: Int?
  }

  func persistPlaybackStateThrottled() {
    let now = Date()
    guard now.timeIntervalSince(lastPlaybackPersistTime) >= Self.playbackPersistThrottleSeconds
    else { return }
    lastPlaybackPersistTime = now
    persistPlaybackState()
  }

  func persistPlaybackState() {
    guard !isRestoringPlayback else { return }
    guard let url = loadedSourceURL, player != nil else {
      Self.clearPersistedPlaybackState()
      return
    }

    let queueEntries = resolvedQueueEntriesForPersistence()
    let idx = currentQueueIndex ?? 0

    let state = PersistedPlaybackState(
      songId: Self.songId(from: url),
      streamBaseURLString: Self.streamBaseURLString(from: url),
      localFileURLString: url.isFileURL ? url.absoluteString : nil,
      cacheRelativePath: loadedCachePath,
      metadata: metadata ?? PlaybackTrackMetadata(title: "Unknown Title"),
      positionSeconds: currentTime,
      wasPlaying: isPlaying,
      queueEntries: queueEntries.isEmpty ? nil : queueEntries,
      currentQueueIndex: queueEntries.isEmpty ? nil : min(idx, max(0, queueEntries.count - 1))
    )

    guard let data = try? JSONEncoder().encode(state) else { return }
    UserDefaults.standard.set(data, forKey: Self.persistedPlaybackKey)
  }

  /// Persists the in-memory queue, or a single row derived from the loaded track if the queue was not populated.
  private func resolvedQueueEntriesForPersistence() -> [PersistedQueueEntry] {
    if !nowPlayingQueue.isEmpty {
      return nowPlayingQueue.map { Self.persistEntry(from: $0) }
    }
    guard let id = loadedSongID else { return [] }
    return [PersistedQueueEntry(id: id)]
  }

  private static func persistEntry(from item: NowPlayingQueueItem) -> PersistedQueueEntry {
    PersistedQueueEntry(id: item.id)
  }

  func restoreQueueEntries(_ entries: [PersistedQueueEntry]) async -> [NowPlayingQueueItem]
  {
    entries.map { NowPlayingQueueItem(id: $0.id) }
  }

  static func resolveQueueIndexAfterRestore(
    restored: [NowPlayingQueueItem],
    originalEntries: [PersistedQueueEntry],
    originalIndex: Int
  ) -> Int {
    guard !restored.isEmpty else { return 0 }
    let safeOriginalIdx = min(max(0, originalIndex), originalEntries.count - 1)
    let originalId = originalEntries[safeOriginalIdx].id
    if let idx = restored.firstIndex(where: { $0.id == originalId }) {
      return idx
    }
    return min(originalIndex, restored.count - 1)
  }

  static func clearPersistedPlaybackState() {
    UserDefaults.standard.removeObject(forKey: persistedPlaybackKey)
  }

  static func songId(from url: URL) -> String? {
    guard !url.isFileURL else { return nil }
    return URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?
      .first(where: { $0.name == "id" })?
      .value
  }

  /// Scheme + host (+ port) for matching `Server.hostname` without persisting one-time auth query params.
  static func streamBaseURLString(from url: URL) -> String? {
    guard !url.isFileURL else { return nil }
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return nil
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    return components.string
  }

  static func serverMatching(streamBaseURLString: String) -> Server? {
    guard let base = URL(string: streamBaseURLString) else { return nil }
    let wantHost = base.host?.lowercased()
    let wantScheme = base.scheme?.lowercased()
    let manager = ServerManager()
    for server in manager.servers {
      let trimmed = server.hostname.trimmingCharacters(in: .whitespacesAndNewlines)
      guard let serverURL = URL(string: trimmed) else { continue }
      if serverURL.host?.lowercased() == wantHost, serverURL.scheme?.lowercased() == wantScheme {
        return server
      }
    }
    return nil
  }

  func seekToRestoredPosition(_ seconds: Double) async {
    guard let p = player else { return }
    let clamped = max(0, seconds)
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      p.seek(to: CMTime(seconds: clamped, preferredTimescale: 600)) { _ in
        Task { @MainActor in
          self.currentTime = clamped
          self.syncPlayingState(from: p)
          self.updateNowPlayingPlaybackOnly()
          continuation.resume()
        }
      }
    }
  }
}
