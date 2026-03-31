//
//  MusicPlayerController+Core.swift
//  AsMusic
//

import AVFoundation
import AsNavidromeKit
import Foundation
import MediaPlayer

extension MusicPlayerController {
  func cancelCacheFillTask() {
    cacheFillTask?.cancel()
    cacheFillTask = nil
  }

  func cancelArtworkLoadTask() {
    artworkLoadTask?.cancel()
    artworkLoadTask = nil
  }

  func tearDownPlayer() {
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

  func observeCurrentItemStatus(of player: AVPlayer) {
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

  func addTimeObserver(to p: AVPlayer) {
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

  func registerEndOfPlayback(for item: AVPlayerItem?) {
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

  func handlePlaybackEnded() async {
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

  func syncPlayingState(from p: AVPlayer?) {
    isPlaying = p?.timeControlStatus == .playing
  }

  static func metadata(from song: Song) -> PlaybackTrackMetadata {
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
}
