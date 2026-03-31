//
//  MusicPlayerController+Queue.swift
//  AsMusic
//

import AsNavidromeKit
import MediaPlayer
import SwiftUI

extension MusicPlayerController {
  func loadQueueItem(at index: Int) async {
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
      guard let songs = await SongCacheStore.shared.loadSongs(forServerID: server.id), !songs.isEmpty else {
        continue
      }
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

  /// Duplicates an existing queue row and appends the duplicate to the end.
  func addQueueItemToEnd(from index: Int) {
    guard nowPlayingQueue.indices.contains(index) else { return }
    appendToEndOfQueue(NowPlayingQueueItem(id: nowPlayingQueue[index].id))
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

  /// Moves a queue row to play right after the current track.
  func moveQueueItemToPlayNext(at index: Int) {
    guard nowPlayingQueue.indices.contains(index) else { return }
    guard let current = currentQueueIndex, nowPlayingQueue.indices.contains(current) else { return }

    let target = min(current + 1, nowPlayingQueue.count - 1)
    guard index != current, index != target else { return }

    let moving = nowPlayingQueue.remove(at: index)
    let insertionIndex = index < target ? target - 1 : target
    nowPlayingQueue.insert(moving, at: insertionIndex)

    if var cur = currentQueueIndex {
      if index < cur {
        cur -= 1
      }
      if insertionIndex <= cur {
        cur += 1
      }
      currentQueueIndex = cur
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
}
