//
//  SongsViewDataLoading.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum SongsViewDataLoading {
  struct LocalDownloadedPayload {
    let songs: [Song]
    let playbackURLsBySongID: [String: URL]
  }

  static func loadLocalDownloaded(client: AsNavidromeClient?) async -> LocalDownloadedPayload {
    guard let client else {
      return LocalDownloadedPayload(songs: [], playbackURLsBySongID: [:])
    }
    let localDownloaded = await DownloadManager.localDownloadedSongs(for: client)
    return LocalDownloadedPayload(
      songs: localDownloaded.songs,
      playbackURLsBySongID: localDownloaded.playbackURLsBySongID
    )
  }

  static func loadDownloadingState() async -> (songs: [Song], progressBySongID: [String: Double]) {
    let songs = await DownloadManager.downloadingSongs()
    let progressBySongID = await DownloadManager.downloadingProgressBySongID()
    return (songs, progressBySongID)
  }
}
