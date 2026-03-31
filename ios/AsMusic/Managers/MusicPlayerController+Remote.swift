//
//  MusicPlayerController+Remote.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation
import MediaPlayer
import UIKit

extension MusicPlayerController {
  func configureRemoteCommands() {
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

  func refreshRemoteCommandAvailability() {
    let center = MPRemoteCommandCenter.shared()
    center.nextTrackCommand.isEnabled = hasNextInQueue
    center.previousTrackCommand.isEnabled = hasPreviousInQueue
  }

  func refreshRemoteFeedbackState() {
    let center = MPRemoteCommandCenter.shared()
    let hasTrack = (currentQueueItem?.id ?? loadedSongID) != nil
    center.likeCommand.isEnabled = hasTrack
    center.dislikeCommand.isEnabled = hasTrack
    let starred = currentTrackIsStarred
    center.likeCommand.isActive = starred
    center.dislikeCommand.isActive = !starred
  }

  func updateNowPlayingInfo() {
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

  func updateNowPlayingPlaybackOnly() {
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

  func refreshNowPlayingArtworkIfNeeded() {
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
      await self?.commitLoadedNowPlayingArtwork(
        artwork,
        expectedArtworkID: expectedArtworkID,
        expectedSourceURL: expectedSourceURL
      )
    }
  }

  private func commitLoadedNowPlayingArtwork(
    _ artwork: MPMediaItemArtwork,
    expectedArtworkID: String,
    expectedSourceURL: URL?
  ) {
    guard !Task.isCancelled else { return }
    guard currentArtworkID == expectedArtworkID else { return }
    guard loadedSourceURL == expectedSourceURL else { return }
    currentNowPlayingArtwork = artwork
    updateNowPlayingInfo()
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
}
