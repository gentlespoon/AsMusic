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

/// Metadata shown in Control Center / Lock Screen.
struct PlaybackTrackMetadata: Equatable, Sendable, Codable {
  var title: String
  var artist: String?
  var album: String?
  /// Subsonic cover-art id (used to render artwork in player UI).
  var artworkID: String?
  /// Known duration in seconds (e.g. from Subsonic); used until the file reports duration.
  var durationSeconds: Double?
  /// Subsonic artist id when known (library navigation).
  var artistId: String?
  /// Subsonic album id when known (library navigation).
  var albumId: String?
  /// Matches `LibraryIndexFromSongs.artistBucketId(for:)` so artist drill-down finds the same rows as the library.
  var libraryArtistBucketId: String?
  /// File extension / container from Subsonic (e.g. `mp3`, `flac`).
  var suffix: String?
  /// Nominal bitrate in kilobits per second when known.
  var bitRate: Int?
  /// Mirrors Subsonic star state for the active track.
  var isStarred: Bool?

  init(
    title: String,
    artist: String? = nil,
    album: String? = nil,
    artworkID: String? = nil,
    durationSeconds: Double? = nil,
    artistId: String? = nil,
    albumId: String? = nil,
    libraryArtistBucketId: String? = nil,
    suffix: String? = nil,
    bitRate: Int? = nil,
    isStarred: Bool? = nil
  ) {
    self.title = title
    self.artist = artist
    self.album = album
    self.artworkID = artworkID
    self.durationSeconds = durationSeconds
    self.artistId = artistId
    self.albumId = albumId
    self.libraryArtistBucketId = libraryArtistBucketId
    self.suffix = suffix
    self.bitRate = bitRate
    self.isStarred = isStarred
  }
}

/// Owns `AVPlayer` at app scope so playback continues after navigation or when the app backgrounds.
@Observable
@MainActor
final class MusicPlayerController {
  var isPlayerPresented = false
  private(set) var player: AVPlayer?
  private(set) var currentTime: Double = 0
  private(set) var duration: Double = 0
  private(set) var loadError: String?
  private(set) var isBuffering = false
  /// Mirrors `AVPlayer.timeControlStatus` for SwiftUI; updated on play/pause and periodically.
  private(set) var isPlaying: Bool = false

  private var timeObserver: Any?
  private var endPlaybackObserver: NSObjectProtocol?
  private var itemStatusObservation: NSKeyValueObservation?
  /// Fills on-disk cache while streaming remote playback; cancelled when switching tracks.
  private var cacheFillTask: Task<Void, Never>?
  private var loadedSourceURL: URL?
  private var loadedSongID: String?
  private var loadedCachePath: String?
  private var metadata: PlaybackTrackMetadata?
  private var artworkLoadTask: Task<Void, Never>?
  private var currentArtworkID: String?
  private var currentNowPlayingArtwork: MPMediaItemArtwork?

  /// Local “needle + list” queue for auto-advance and skip-next (not server playlists).
  private(set) var nowPlayingQueue: [NowPlayingQueueItem] = []
  /// Index into `nowPlayingQueue` for the track currently loaded in `player`, if any.
  private(set) var currentQueueIndex: Int?
  /// Resolved from cached library songs; queue ids are source-of-truth keys.
  private var cachedSongsByID: [String: Song] = [:]
  private var cachedClientBySongID: [String: AsNavidromeClient] = [:]
  private var starredSongIDs: Set<String> = []

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
  private(set) var isReady: Bool = false

  /// Skips persisting transient `currentTime` while restoring from disk (avoids overwriting seek with 0).
  private var isRestoringPlayback = false
  private var hasAttemptedPlaybackRestore = false
  private var lastPlaybackPersistTime: Date = .distantPast
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
    let streamURL = client.media.stream(forSongID: songId)
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
    loadError = nil
    loadedSourceURL = url
    loadedSongID = Self.songId(from: url)
    loadedCachePath = cacheRelativePath
    self.metadata = metadata

    isBuffering =
      !url.isFileURL && !SongFileCache.hasCached(for: url, relativePath: cacheRelativePath)

    do {
      let playURL = try SongFileCache.playbackURL(for: url, relativePath: cacheRelativePath)
      isBuffering = false

      cancelCacheFillTask()
      if !playURL.isFileURL {
        let streamURL = url
        let rel = cacheRelativePath
        cacheFillTask = Task { [streamURL, rel] in
          try? await SongFileCache.downloadFullToCache(remoteURL: streamURL, relativePath: rel)
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

  private func replaceQueueWithSingleCurrentTrack() {
    guard let songID = loadedSongID else { return }
    let item = NowPlayingQueueItem(id: songID)
    nowPlayingQueue = [item]
    currentQueueIndex = 0
    refreshRemoteCommandAvailability()
  }

  func togglePlayPause() {
    guard let p = player else { return }
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

  private func loadQueueItem(at index: Int) async {
    guard nowPlayingQueue.indices.contains(index) else { return }
    let songID = nowPlayingQueue[index].id
    guard let resolved = await resolveSongAndClient(for: songID) else { return }
    let streamURL = resolved.client.media.stream(forSongID: songID)
    await load(
      url: streamURL,
      cacheRelativePath: resolved.song.path,
      metadata: Self.metadata(from: resolved.song)
    )
  }

  private func resolveSongAndClient(for songID: String) async -> (song: Song, client: AsNavidromeClient)? {
    if let song = cachedSongsByID[songID], let client = cachedClientBySongID[songID] {
      return (song, client)
    }

    let manager = ServerManager()
    let servers = manager.servers
    guard !servers.isEmpty else { return nil }
    let preferredServerID = SelectedLibraryStore.shared.selection?.serverID
    let orderedServers = servers.sorted { lhs, rhs in
      if lhs.id == preferredServerID { return true }
      if rhs.id == preferredServerID { return false }
      return false
    }

    for server in orderedServers {
      let client = await NavidromeClientStore.shared.client(for: server)
      let cacheKey = LibrarySongCacheKey.current(for: client)
      guard let songs = await SongCacheStore.shared.loadSongs(for: cacheKey), !songs.isEmpty else { continue }
      for song in songs {
        cachedSongsByID[song.id] = song
        cachedClientBySongID[song.id] = client
        if song.starred != nil {
          starredSongIDs.insert(song.id)
        }
      }
      if let match = cachedSongsByID[songID], let sourceClient = cachedClientBySongID[songID] {
        return (match, sourceClient)
      }
    }
    return nil
  }

  func setCurrentTrackStarred(_ shouldStar: Bool) async {
    guard let songID = currentQueueItem?.id ?? loadedSongID else { return }
    guard let resolved = await resolveSongAndClient(for: songID) else { return }
    do {
      if shouldStar {
        try await resolved.client.song.star(songID: songID)
        starredSongIDs.insert(songID)
      } else {
        try await resolved.client.song.unstar(songID: songID)
        starredSongIDs.remove(songID)
      }
      if var current = metadata, currentQueueItem?.id == songID || loadedSongID == songID {
        current.isStarred = shouldStar
        metadata = current
      }
      refreshRemoteFeedbackState()
    } catch {
      // Keep playback uninterrupted if starring fails.
    }
  }

  func presentPlayer() {
    isPlayerPresented = true
  }

  /// Inserts `item` immediately after the current queue position and loads it. If the queue is empty or there is no current index, replaces the queue with a single item.
  func insertAfterCurrentAndPlay(_ item: NowPlayingQueueItem) async {
    if nowPlayingQueue.isEmpty || currentQueueIndex == nil {
      nowPlayingQueue = [item]
      currentQueueIndex = 0
    } else if let idx = currentQueueIndex {
      let insertAt = idx + 1
      nowPlayingQueue.insert(item, at: insertAt)
      currentQueueIndex = insertAt
    }
    refreshRemoteCommandAvailability()
    if let idx = currentQueueIndex {
      await loadQueueItem(at: idx)
    }
    play()
  }

  /// Inserts `item` right after the current track without switching what is playing. If the queue is empty or there is no current index, starts playback like `insertAfterCurrentAndPlay`.
  func insertAfterCurrentWithoutPlaying(_ item: NowPlayingQueueItem) async {
    if nowPlayingQueue.isEmpty || currentQueueIndex == nil {
      await insertAfterCurrentAndPlay(item)
      return
    }
    if let idx = currentQueueIndex {
      nowPlayingQueue.insert(item, at: idx + 1)
    }
    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  /// Appends `item` to the end of the queue without changing the current track or starting playback.
  func appendToEndOfQueue(_ item: NowPlayingQueueItem) {
    nowPlayingQueue.append(item)
    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  /// Replaces the queue with `items` and starts playback at `startAt`.
  func replaceQueueAndPlay(_ items: [NowPlayingQueueItem], startAt index: Int = 0) async {
    guard !items.isEmpty, items.indices.contains(index) else { return }
    nowPlayingQueue = items
    currentQueueIndex = index
    refreshRemoteCommandAvailability()
    await loadQueueItem(at: index)
    play()
  }

  func jumpToQueueIndex(_ index: Int) async {
    guard nowPlayingQueue.indices.contains(index) else { return }
    currentQueueIndex = index
    refreshRemoteCommandAvailability()
    await loadQueueItem(at: index)
    play()
  }

  /// Reorders the queue; keeps the playing track as current when its row moves.
  func moveQueue(fromOffsets source: IndexSet, toOffset destination: Int) {
    guard !nowPlayingQueue.isEmpty else { return }
    let playingRowId = currentQueueIndex.flatMap { idx in
      nowPlayingQueue.indices.contains(idx) ? nowPlayingQueue[idx].rowId : nil
    }
    nowPlayingQueue.move(fromOffsets: source, toOffset: destination)
    if let pr = playingRowId {
      currentQueueIndex = nowPlayingQueue.firstIndex(where: { $0.rowId == pr })
    }
    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  /// Removes one queue row; if the current track is removed, loads the next or previous remaining item.
  func removeQueueItem(at index: Int) async {
    guard nowPlayingQueue.indices.contains(index) else { return }
    let oldCount = nowPlayingQueue.count
    let wasCurrent = currentQueueIndex == index
    let idxBefore = currentQueueIndex

    nowPlayingQueue.remove(at: index)

    if nowPlayingQueue.isEmpty {
      currentQueueIndex = nil
      tearDownPlayer()
      loadedSourceURL = nil
      loadedSongID = nil
      loadedCachePath = nil
      metadata = nil
      loadError = nil
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      Self.clearPersistedPlaybackState()
      refreshRemoteCommandAvailability()
      return
    }

    if let cur = idxBefore {
      if index < cur {
        currentQueueIndex = cur - 1
      } else if wasCurrent {
        let newIdx: Int
        if index < oldCount - 1 {
          newIdx = index
        } else {
          newIdx = nowPlayingQueue.count - 1
        }
        currentQueueIndex = newIdx
        refreshRemoteCommandAvailability()
        await loadQueueItem(at: newIdx)
        play()
        persistPlaybackState()
        return
      }
    }

    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  func skipToNext() async {
    guard let idx = currentQueueIndex, idx + 1 < nowPlayingQueue.count else { return }
    await jumpToQueueIndex(idx + 1)
  }

  func skipToPrevious() async {
    guard let idx = currentQueueIndex, idx > 0 else { return }
    await jumpToQueueIndex(idx - 1)
  }

  /// Drops every queue row except the one currently loaded in the player. No reload; playback continues.
  func clearQueueExceptCurrent() {
    guard !nowPlayingQueue.isEmpty else { return }
    if let idx = currentQueueIndex, nowPlayingQueue.indices.contains(idx) {
      let current = nowPlayingQueue[idx]
      nowPlayingQueue = [current]
      currentQueueIndex = 0
    } else {
      replaceQueueWithSingleCurrentTrack()
    }
    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  /// Randomizes queue order without reloading the current item; the playing row keeps the same track.
  func reshuffleQueuePreservingCurrentTrack() {
    guard nowPlayingQueue.count > 1 else { return }
    let playingRowId = currentQueueIndex.flatMap { idx in
      nowPlayingQueue.indices.contains(idx) ? nowPlayingQueue[idx].rowId : nil
    }
    nowPlayingQueue.shuffle()
    if let playingRowId {
      currentQueueIndex = nowPlayingQueue.firstIndex(where: { $0.rowId == playingRowId })
    }
    refreshRemoteCommandAvailability()
    persistPlaybackState()
  }

  private func cancelCacheFillTask() {
    cacheFillTask?.cancel()
    cacheFillTask = nil
  }

  private func cancelArtworkLoadTask() {
    artworkLoadTask?.cancel()
    artworkLoadTask = nil
  }

  private func tearDownPlayer() {
    cancelCacheFillTask()
    cancelArtworkLoadTask()
    currentArtworkID = nil
    currentNowPlayingArtwork = nil
    if let observer = timeObserver, let p = player {
      p.removeTimeObserver(observer)
    }
    timeObserver = nil
    itemStatusObservation?.invalidate()
    itemStatusObservation = nil
    if let endPlaybackObserver {
      NotificationCenter.default.removeObserver(endPlaybackObserver)
      self.endPlaybackObserver = nil
    }
    player?.pause()
    player = nil
    currentTime = 0
    duration = 0
    isPlaying = false
    isReady = false
    // Do not clear UserDefaults here — `load` may immediately replace state for the next track.
  }

  private func observeCurrentItemStatus(of player: AVPlayer) {
    itemStatusObservation?.invalidate()
    guard let item = player.currentItem else {
      isReady = false
      return
    }
    applyItemStatus(item)
    itemStatusObservation = item.observe(\.status, options: [.new, .initial]) {
      [weak self] item, _ in
      Task { @MainActor in
        self?.applyItemStatus(item)
      }
    }
  }

  private func applyItemStatus(_ item: AVPlayerItem) {
    switch item.status {
    case .readyToPlay:
      isReady = true
    case .failed:
      isReady = false
      if loadError == nil {
        loadError = item.error?.localizedDescription ?? "Playback failed"
      }
    case .unknown:
      isReady = false
    @unknown default:
      isReady = false
    }
  }

  private func addTimeObserver(to p: AVPlayer) {
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    timeObserver = p.addPeriodicTimeObserver(forInterval: interval, queue: .main) {
      [weak self] time in
      guard let self else { return }
      self.currentTime = time.seconds
      self.syncPlayingState(from: p)
      if self.duration <= 0, let item = p.currentItem, item.status == .readyToPlay {
        let secs = item.duration.seconds
        if secs.isFinite && secs > 0 { self.duration = secs }
      }
      self.updateNowPlayingPlaybackOnly()
      self.persistPlaybackStateThrottled()
    }
  }

  private func registerEndOfPlayback(for item: AVPlayerItem?) {
    if let endPlaybackObserver {
      NotificationCenter.default.removeObserver(endPlaybackObserver)
      self.endPlaybackObserver = nil
    }
    guard let item else { return }
    endPlaybackObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      Task { @MainActor in
        await self.handlePlaybackEnded()
      }
    }
  }

  private func handlePlaybackEnded() async {
    guard let idx = currentQueueIndex, idx + 1 < nowPlayingQueue.count else {
      player?.pause()
      syncPlayingState(from: player)
      updateNowPlayingPlaybackOnly()
      persistPlaybackState()
      return
    }
    let next = idx + 1
    currentQueueIndex = next
    refreshRemoteCommandAvailability()
    await loadQueueItem(at: next)
    play()
  }

  private func syncPlayingState(from p: AVPlayer?) {
    isPlaying = p?.timeControlStatus == .playing
  }

  private static func metadata(from song: Song) -> PlaybackTrackMetadata {
    PlaybackTrackMetadata(
      title: song.title,
      artist: LibraryIndexFromSongs.trackArtistCreditLine(for: song) ?? song.artist,
      album: song.album,
      artworkID: song.coverArt,
      durationSeconds: song.duration.map { Double($0) },
      artistId: song.artistId,
      albumId: song.albumId,
      libraryArtistBucketId: LibraryIndexFromSongs.artistBucketId(for: song),
      suffix: song.suffix,
      bitRate: song.bitRate,
      isStarred: song.starred != nil
    )
  }

  // MARK: - Now Playing & Remote Commands

  private func configureRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    center.playCommand.isEnabled = true
    center.playCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        self.player?.play()
        if let p = self.player { self.syncPlayingState(from: p) }
        self.updateNowPlayingPlaybackOnly()
        self.persistPlaybackState()
      }
      return .success
    }

    center.pauseCommand.isEnabled = true
    center.pauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        self.player?.pause()
        if let p = self.player { self.syncPlayingState(from: p) }
        self.updateNowPlayingPlaybackOnly()
        self.persistPlaybackState()
      }
      return .success
    }

    center.togglePlayPauseCommand.isEnabled = true
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in self.togglePlayPause() }
      return .success
    }

    center.nextTrackCommand.isEnabled = false
    center.nextTrackCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        await self.skipToNext()
      }
      return .success
    }

    center.previousTrackCommand.isEnabled = false
    center.previousTrackCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        await self.skipToPrevious()
      }
      return .success
    }

    center.changePlaybackPositionCommand.isEnabled = true
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let self,
        let e = event as? MPChangePlaybackPositionCommandEvent
      else { return .commandFailed }
      Task { @MainActor in self.seek(to: e.positionTime) }
      return .success
    }

    center.likeCommand.isEnabled = false
    center.likeCommand.localizedTitle = "Star"
    center.likeCommand.isActive = false
    center.likeCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        await self.setCurrentTrackStarred(true)
      }
      return .success
    }

    center.dislikeCommand.isEnabled = false
    center.dislikeCommand.localizedTitle = "Unstar"
    center.dislikeCommand.isActive = false
    center.dislikeCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      Task { @MainActor in
        await self.setCurrentTrackStarred(false)
      }
      return .success
    }

    refreshRemoteCommandAvailability()
    refreshRemoteFeedbackState()
  }

  private func refreshRemoteCommandAvailability() {
    let center = MPRemoteCommandCenter.shared()
    center.nextTrackCommand.isEnabled = hasNextInQueue
    center.previousTrackCommand.isEnabled = hasPreviousInQueue
  }

  private func refreshRemoteFeedbackState() {
    let center = MPRemoteCommandCenter.shared()
    let hasTrack = (currentQueueItem?.id ?? loadedSongID) != nil
    center.likeCommand.isEnabled = hasTrack
    center.dislikeCommand.isEnabled = hasTrack
    let starred = currentTrackIsStarred
    center.likeCommand.isActive = starred
    center.dislikeCommand.isActive = !starred
  }

  private func updateNowPlayingInfo() {
    var info = [String: Any]()
    let title = metadata?.title ?? "Unknown Title"
    info[MPMediaItemPropertyTitle] = title
    if let artist = metadata?.artist, !artist.isEmpty {
      info[MPMediaItemPropertyArtist] = artist
    }
    if let album = metadata?.album, !album.isEmpty {
      info[MPMediaItemPropertyAlbumTitle] = album
    }
    let dur = duration > 0 ? duration : (metadata?.durationSeconds ?? 0)
    if dur > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = dur
    }
    if let currentNowPlayingArtwork {
      info[MPMediaItemPropertyArtwork] = currentNowPlayingArtwork
    }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
    info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    refreshRemoteFeedbackState()
    refreshNowPlayingArtworkIfNeeded()
  }

  private func updateNowPlayingPlaybackOnly() {
    guard player != nil else { return }
    guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else {
      updateNowPlayingInfo()
      return
    }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
    info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
    if duration > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = duration
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func refreshNowPlayingArtworkIfNeeded() {
    guard let artworkID = metadata?.artworkID?.trimmingCharacters(in: .whitespacesAndNewlines), !artworkID.isEmpty else {
      currentArtworkID = nil
      currentNowPlayingArtwork = nil
      cancelArtworkLoadTask()
      return
    }

    if currentArtworkID == artworkID, currentNowPlayingArtwork != nil {
      return
    }
    guard let remoteArtworkURL = coverArtRemoteURL(for: artworkID) else {
      currentArtworkID = nil
      currentNowPlayingArtwork = nil
      cancelArtworkLoadTask()
      return
    }

    currentArtworkID = artworkID
    currentNowPlayingArtwork = nil
    cancelArtworkLoadTask()

    let expectedArtworkID = artworkID
    let expectedSourceURL = loadedSourceURL
    artworkLoadTask = Task.detached(priority: .utility) { [weak self] in
      let resolvedURL = await ArtworkFileCache.displayURL(for: remoteArtworkURL)
      guard !Task.isCancelled else { return }
      guard let imageData = try? Data(contentsOf: resolvedURL), let image = UIImage(data: imageData) else { return }
      let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      await MainActor.run {
        guard let self else { return }
        guard !Task.isCancelled else { return }
        guard self.currentArtworkID == expectedArtworkID else { return }
        guard self.loadedSourceURL == expectedSourceURL else { return }
        self.currentNowPlayingArtwork = artwork
        self.updateNowPlayingInfo()
      }
    }
  }

  private func coverArtRemoteURL(for artworkID: String) -> URL? {
    guard let sourceURL = loadedSourceURL, !sourceURL.isFileURL else { return nil }
    guard var components = URLComponents(url: sourceURL, resolvingAgainstBaseURL: false) else {
      return nil
    }
    components.path = ApiPaths.getCoverArt
    var items = components.queryItems ?? []
    items.removeAll { $0.name == "id" || $0.name == "size" || $0.name == "f" }
    items.append(URLQueryItem(name: "id", value: artworkID))
    items.append(URLQueryItem(name: "size", value: "600"))
    components.queryItems = items
    return components.url
  }

  // MARK: - Resume persistence

  private static let persistedPlaybackKey = "asmusic.persistedPlayback"
  private static let playbackPersistThrottleSeconds: TimeInterval = 1.5

  /// Serializable queue row (rebuilds stream URL via Subsonic id + server base; local files by path).
  private struct PersistedQueueEntry: Codable {
    var id: String
  }

  private struct PersistedPlaybackState: Codable {
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

  private func persistPlaybackStateThrottled() {
    let now = Date()
    guard now.timeIntervalSince(lastPlaybackPersistTime) >= Self.playbackPersistThrottleSeconds
    else { return }
    lastPlaybackPersistTime = now
    persistPlaybackState()
  }

  private func persistPlaybackState() {
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

  private func restoreQueueEntries(_ entries: [PersistedQueueEntry]) async -> [NowPlayingQueueItem]
  {
    entries.map { NowPlayingQueueItem(id: $0.id) }
  }

  private static func resolveQueueIndexAfterRestore(
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

  private static func clearPersistedPlaybackState() {
    UserDefaults.standard.removeObject(forKey: persistedPlaybackKey)
  }

  private static func songId(from url: URL) -> String? {
    guard !url.isFileURL else { return nil }
    return URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?
      .first(where: { $0.name == "id" })?
      .value
  }

  /// Scheme + host (+ port) for matching `Server.hostname` without persisting one-time auth query params.
  private static func streamBaseURLString(from url: URL) -> String? {
    guard !url.isFileURL else { return nil }
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return nil
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    return components.string
  }

  private static func serverMatching(streamBaseURLString: String) -> Server? {
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

  private func seekToRestoredPosition(_ seconds: Double) async {
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

#if DEBUG
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
#endif
