//
//  MusicPlayerController.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AVFoundation
import AsNavidromeKit
import MediaPlayer
import Observation
import SwiftUI
import UIKit

/// Owns `AVPlayer` at app scope so playback continues after navigation or when the app backgrounds.
@Observable
@MainActor
final class MusicPlayerController {
  var isPlayerPresented = false
  var player: AVPlayer?
  var currentTime: Double = 0
  var duration: Double = 0
  var loadError: String?
  var isBuffering = false
  /// Mirrors `AVPlayer.timeControlStatus` for SwiftUI; updated on play/pause and periodically.
  var isPlaying: Bool = false

  var timeObserver: Any?
  var endPlaybackObserver: NSObjectProtocol?
  var itemStatusObservation: NSKeyValueObservation?
  /// Fills on-disk cache while streaming remote playback; cancelled when switching tracks.
  var cacheFillTask: Task<Void, Never>?
  var loadedSourceURL: URL?
  var loadedSongID: String?
  var loadedCachePath: String?
  var metadata: PlaybackTrackMetadata?
  var artworkLoadTask: Task<Void, Never>?
  var currentArtworkID: String?
  var currentNowPlayingArtwork: MPMediaItemArtwork?

  /// Local “needle + list” queue for auto-advance and skip-next (not server playlists).
  var nowPlayingQueue: [NowPlayingQueueItem] = []
  /// Index into `nowPlayingQueue` for the track currently loaded in `player`, if any.
  var currentQueueIndex: Int?
  /// Resolved from cached library songs; queue ids are source-of-truth keys.
  var cachedSongsByID: [String: Song] = [:]
  var cachedClientBySongID: [String: AsNavidromeClient] = [:]
  var starredSongIDs: Set<String> = []

  var currentSourceURL: URL? {
    loadedSourceURL
  }

  var currentCacheRelativePath: String? {
    loadedCachePath
  }

  var currentMetadata: PlaybackTrackMetadata? {
    metadata
  }

  /// Current queue row (stable Subsonic `id`; metadata resolves from cached song list).
  var currentQueueItem: NowPlayingQueueItem? {
    guard let idx = currentQueueIndex, nowPlayingQueue.indices.contains(idx) else { return nil }
    return nowPlayingQueue[idx]
  }

  var currentTrackIsStarred: Bool {
    if let id = currentQueueItem?.id ?? loadedSongID {
      return starredSongIDs.contains(id)
    }
    return metadata?.isStarred ?? false
  }

  func metadataForQueueIndex(_ index: Int) -> PlaybackTrackMetadata? {
    guard nowPlayingQueue.indices.contains(index) else { return nil }
    let songID = nowPlayingQueue[index].id
    guard let song = cachedSongsByID[songID] else { return nil }
    return Self.metadata(from: song)
  }

  var hasNextInQueue: Bool {
    guard let idx = currentQueueIndex, idx + 1 < nowPlayingQueue.count else { return false }
    return true
  }

  var hasPreviousInQueue: Bool {
    guard let idx = currentQueueIndex, idx > 0 else { return false }
    return true
  }

  /// Updated via KVO on `AVPlayerItem.status` — the item often becomes `.readyToPlay` after `player` is set.
  var isReady: Bool = false

  /// Skips persisting transient `currentTime` while restoring from disk (avoids overwriting seek with 0).
  var isRestoringPlayback = false
  var hasAttemptedPlaybackRestore = false
  var lastPlaybackPersistTime: Date = .distantPast
  /// Observer token; `nonisolated(unsafe)` so `deinit` can remove the registration (not `@Observable`).
  @ObservationIgnored
  private nonisolated(unsafe) var resignActiveObserver: NSObjectProtocol?

  init() {
    configureRemoteCommands()
    resignActiveObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willResignActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in
        self?.persistPlaybackState()
      }
    }
  }

  deinit {
    if let resignActiveObserver {
      NotificationCenter.default.removeObserver(resignActiveObserver)
    }
  }

  /// Rebuilds the queue/track from `UserDefaults` and restores position; leaves playback paused until the user plays.
  func restorePlaybackIfNeeded() async {
    guard !hasAttemptedPlaybackRestore else { return }
    hasAttemptedPlaybackRestore = true
    guard let data = UserDefaults.standard.data(forKey: Self.persistedPlaybackKey),
      let state = try? JSONDecoder().decode(PersistedPlaybackState.self, from: data)
    else { return }

    isRestoringPlayback = true
    defer { isRestoringPlayback = false }

    if let entries = state.queueEntries, !entries.isEmpty {
      let restored = await restoreQueueEntries(entries)
      if !restored.isEmpty {
        let targetIndex = Self.resolveQueueIndexAfterRestore(
          restored: restored,
          originalEntries: entries,
          originalIndex: state.currentQueueIndex ?? 0
        )
        nowPlayingQueue = restored
        currentQueueIndex = targetIndex
        await loadQueueItem(at: targetIndex)
        await seekToRestoredPosition(state.positionSeconds)
        isRestoringPlayback = false
        persistPlaybackState()
        return
      }
    }

    if let fileStr = state.localFileURLString, let fileURL = URL(string: fileStr), fileURL.isFileURL
    {
      guard FileManager.default.fileExists(atPath: fileURL.path(percentEncoded: false)) else {
        Self.clearPersistedPlaybackState()
        return
      }
      await load(
        url: fileURL,
        cacheRelativePath: state.cacheRelativePath,
        metadata: state.metadata
      )
      replaceQueueWithSingleCurrentTrack()
      await seekToRestoredPosition(state.positionSeconds)
      isRestoringPlayback = false
      persistPlaybackState()
      return
    }

    guard let songId = state.songId, let baseStr = state.streamBaseURLString else {
      Self.clearPersistedPlaybackState()
      return
    }
    guard let server = Self.serverMatching(streamBaseURLString: baseStr) else { return }

    let client = await NavidromeClientStore.shared.client(for: server)
    let streamURL = DownloadManager.streamURL(forSongID: songId, from: client)
    await load(
      url: streamURL,
      cacheRelativePath: state.cacheRelativePath,
      metadata: state.metadata
    )
    replaceQueueWithSingleCurrentTrack()
    await seekToRestoredPosition(state.positionSeconds)
    isRestoringPlayback = false
    persistPlaybackState()
  }

  /// Loads a track. If the same URL + cache path is already loaded, only updates metadata.
  func load(url: URL, cacheRelativePath: String?, metadata: PlaybackTrackMetadata?) async {
    let sameTrack =
      loadedSourceURL == url && loadedCachePath == cacheRelativePath && player != nil
    if sameTrack {
      if let metadata {
        self.metadata = metadata
      }
      updateNowPlayingInfo()
      persistPlaybackState()
      refreshRemoteCommandAvailability()
      return
    }

    tearDownPlayer()

    AppHaptics.playImpactIfEnabled()
    loadError = nil
    loadedSourceURL = url
    loadedSongID = Self.songId(from: url)
    loadedCachePath = cacheRelativePath
    self.metadata = metadata
    let cacheScope = SongFileCache.activeSelectionScope()

    isBuffering =
      !url.isFileURL
      && !SongFileCache.hasCached(for: url, relativePath: cacheRelativePath, cacheScope: cacheScope)

    do {
      let playURL = try SongFileCache.playbackURL(
        for: url,
        relativePath: cacheRelativePath,
        cacheScope: cacheScope
      )
      isBuffering = false

      cancelCacheFillTask()
      if !playURL.isFileURL {
        let streamURL = url
        let rel = cacheRelativePath
        let scope = cacheScope
        cacheFillTask = Task { [streamURL, rel, scope] in
          try? await SongFileCache.downloadFullToCache(
            remoteURL: streamURL,
            relativePath: rel,
            cacheScope: scope
          )
        }
      }

      let p = AVPlayer(url: playURL)
      player = p
      syncPlayingState(from: p)
      observeCurrentItemStatus(of: p)

      if let secs = metadata?.durationSeconds, secs > 0 {
        duration = secs
      } else {
        duration = 0
      }

      addTimeObserver(to: p)
      registerEndOfPlayback(for: p.currentItem)

      updateNowPlayingInfo()
      persistPlaybackState()
      refreshRemoteCommandAvailability()
    } catch {
      isBuffering = false
      loadError = error.localizedDescription
      player = nil
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      Self.clearPersistedPlaybackState()
    }
  }

  func replaceQueueWithSingleCurrentTrack() {
    guard let songID = loadedSongID else { return }
    let item = NowPlayingQueueItem(id: songID)
    nowPlayingQueue = [item]
    currentQueueIndex = 0
    refreshRemoteCommandAvailability()
  }

  func togglePlayPause() {
    guard let p = player else { return }
    AppHaptics.playImpactIfEnabled()
    if p.timeControlStatus == .playing {
      p.pause()
    } else {
      p.play()
    }
    syncPlayingState(from: p)
    updateNowPlayingPlaybackOnly()
    persistPlaybackState()
  }

  func play() {
    guard let p = player else { return }
    p.play()
    syncPlayingState(from: p)
    updateNowPlayingPlaybackOnly()
    persistPlaybackState()
  }

  func seek(to seconds: Double) {
    guard let p = player else { return }
    p.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
    currentTime = seconds
    syncPlayingState(from: p)
    updateNowPlayingPlaybackOnly()
    persistPlaybackState()
  }

  func presentPlayer() {
    isPlayerPresented = true
  }

}

extension MusicPlayerController {
  static func previewMockedController(
    currentIndex: Int = 0,
    currentTime: Double = 61,
    isPlaying: Bool = true
  ) -> MusicPlayerController {
    let playback = MusicPlayerController()
    playback.applyPreviewNowPlaying(
      queue: previewQueue,
      currentIndex: currentIndex,
      currentTime: currentTime,
      isPlaying: isPlaying
    )
    return playback
  }

  static var previewQueue: [NowPlayingQueueItem] {
    [
      NowPlayingQueueItem(id: "preview-1"),
      NowPlayingQueueItem(id: "preview-2"),
    ]
  }

  static let previewMetadataByID: [String: PlaybackTrackMetadata] = [
    "preview-1": PlaybackTrackMetadata(
      title: "Mockingbird",
      artist: "Preview Artist",
      album: "Preview Album",
      artworkID: "cover-preview-1",
      durationSeconds: 236,
      artistId: "artist-preview-1",
      albumId: "album-preview-1",
      libraryArtistBucketId: "preview artist",
      suffix: "flac",
      bitRate: 1411
    ),
    "preview-2": PlaybackTrackMetadata(
      title: "Second Song",
      artist: "Preview Artist",
      album: "Preview Album",
      artworkID: "cover-preview-2",
      durationSeconds: 204,
      artistId: "artist-preview-1",
      albumId: "album-preview-1",
      libraryArtistBucketId: "preview artist",
      suffix: "mp3",
      bitRate: 320
    ),
  ]

  /// Fills queue state for SwiftUI previews only; does not load media or touch persistence.
  func applyPreviewState(queue: [NowPlayingQueueItem], currentIndex: Int?) {
    nowPlayingQueue = queue
    if let idx = currentIndex, queue.indices.contains(idx) {
      currentQueueIndex = idx
    } else {
      currentQueueIndex = queue.isEmpty ? nil : 0
    }
    refreshRemoteCommandAvailability()
  }

  /// Seeds now-playing fields for SwiftUI previews without creating real playback.
  func applyPreviewNowPlaying(
    queue: [NowPlayingQueueItem],
    currentIndex: Int = 0,
    currentTime: Double = 42,
    isPlaying: Bool = true
  ) {
    guard !queue.isEmpty, queue.indices.contains(currentIndex) else {
      applyPreviewState(queue: [], currentIndex: nil)
      loadedSourceURL = nil
      loadedSongID = nil
      loadedCachePath = nil
      metadata = nil
      loadError = nil
      isBuffering = false
      duration = 0
      self.currentTime = 0
      player = nil
      isReady = false
      self.isPlaying = false
      return
    }

    let current = queue[currentIndex]
    applyPreviewState(queue: queue, currentIndex: currentIndex)
    loadedSourceURL = URL(string: "https://example.com/rest/stream.view?id=\(current.id)")!
    loadedSongID = current.id
    loadedCachePath = nil
    metadata = Self.previewMetadataByID[current.id]
    loadError = nil
    isBuffering = false
    duration = max(0, metadata?.durationSeconds ?? 0)
    self.currentTime = min(max(0, currentTime), duration > 0 ? duration : currentTime)
    player = AVPlayer()
    isReady = true
    self.isPlaying = isPlaying
    updateNowPlayingInfo()
  }
}
