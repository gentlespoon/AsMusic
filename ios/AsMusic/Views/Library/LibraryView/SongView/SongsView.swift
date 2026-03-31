//
//  SongsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import SwiftUI

struct SongsView: View {
  enum ListSource: Equatable {
    /// Loads the full library list (cache + server).
    case library
    /// Cached library songs that have a complete on-disk file (same scan as former Downloaded list).
    case localDownloaded
  }

  /// When `nil`, loads from `listSource`. When set, shows only these songs.
  private let fixedSongs: [Song]?
  private let navigationTitle: String
  /// When `fixedSongs` is used, map song id → client for rows that need an explicit client.
  private let injectedSongClientsByID: [String: AsNavidromeClient]
  private let listSource: ListSource

  @Environment(\.libraryClient) private var client
  @Environment(MusicPlayerController.self) private var playback

  @State private var refreshCoordinator = LibraryRefreshCoordinator.shared

  @State private var loadedSongs: [Song] = []
  /// Populated in `.localDownloaded` mode for file playback.
  @State private var localPlaybackURLs: [String: URL] = [:]
  @State private var songClientsByID: [String: AsNavidromeClient] = [:]
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

  init(
    songs: [Song]? = nil,
    navigationTitle: String = "Songs",
    songClientsByID: [String: AsNavidromeClient] = [:],
    listSource: ListSource = .library
  ) {
    self.fixedSongs = songs
    self.navigationTitle = navigationTitle
    self.injectedSongClientsByID = songClientsByID
    self.listSource = listSource
  }

  private var isFixedListMode: Bool { fixedSongs != nil }
  private var isLocalDownloadedMode: Bool { fixedSongs == nil && listSource == .localDownloaded }
  private var isLibraryMode: Bool { fixedSongs == nil && listSource == .library }

  private var displaySongs: [Song] {
    fixedSongs ?? loadedSongs
  }

  private var filteredSongs: [Song] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return displaySongs }
    let needle = query.lowercased()
    return displaySongs.filter { song in
      song.title.lowercased().contains(needle)
        || (song.artist?.lowercased().contains(needle) ?? false)
        || (song.album?.lowercased().contains(needle) ?? false)
    }
  }

  /// Songs currently shown in the list that can be played (respects search filter).
  private var playableQueueItems: [NowPlayingQueueItem] {
    filteredSongs.compactMap { song in
      guard playbackURL(for: song) != nil else { return nil }
      return queueItem(for: song)
    }
  }

  var body: some View {
    List {
      if (isLibraryMode || isLocalDownloadedMode) && isLoading && displaySongs.isEmpty {
        ProgressView(isLocalDownloadedMode ? "Checking downloads…" : "Loading songs...")
      } else if isLibraryMode, let errorMessage {
        ContentUnavailableView(
          "Unable to Load Songs",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if displaySongs.isEmpty {
        ContentUnavailableView(
          isLocalDownloadedMode ? "No Downloaded Songs" : "No Songs",
          systemImage: isLocalDownloadedMode ? "arrow.down.circle" : "music.note.list",
          description: Text(
            isLocalDownloadedMode
              ? "Songs you play are saved under Documents. Open Songs and play a track, then pull to refresh here."
              : isLibraryMode
                ? "No songs found for this library."
                : "No songs in this album."
          )
        )
      } else if filteredSongs.isEmpty {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No songs match your search.")
        )
      } else {
        ForEach(filteredSongs) { song in
          if let playURL = playbackURL(for: song) {
            Button {
              openPlayer(for: song)
            } label: {
              SongRowContentView(song: song)
            }
            .buttonStyle(.plain)
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
              Button {
                let item = queueItem(for: song)
                Task { @MainActor in
                  await playback.insertAfterCurrentWithoutPlaying(item)
                }
              } label: {
                Label("Play Next", systemImage: "text.insert")
              }
              .tint(.orange)

              Button {
                let item = queueItem(for: song)
                playback.appendToEndOfQueue(item)
              } label: {
                Label("Add to Queue", systemImage: "text.line.last.and.arrowtriangle.forward")
              }
              .tint(.blue)
            }
          } else {
            SongRowContentView(song: song)
          }
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter songs")
    .navigationTitle(navigationTitle)
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        Button {
          startPlaybackOrdered()
        } label: {
          Label("Play in order", systemImage: "play.circle")
        }
        .disabled(playableQueueItems.isEmpty)

        Button {
          startPlaybackShuffled()
        } label: {
          Label("Play shuffled", systemImage: "shuffle")
        }
        .disabled(playableQueueItems.isEmpty)
      }
    }
    .task(id: refreshCoordinator.generation) {
      guard isLibraryMode else { return }
      await loadSongsFromCacheOrServer()
    }
    .task {
      if isLocalDownloadedMode {
        await loadLocalDownloadedSongs()
      }
    }
  }

  private func loadLocalDownloadedSongs() async {
    isLoading = true
    defer { isLoading = false }

    guard let client else {
      loadedSongs = []
      localPlaybackURLs = [:]
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    guard let cachedSongs = await SongCacheStore.shared.loadSongs(for: cacheKey),
      !cachedSongs.isEmpty
    else {
      loadedSongs = []
      localPlaybackURLs = [:]
      errorMessage = nil
      return
    }

    let entries = await LocalCachedSongList.entries(from: cachedSongs, client: client)
    loadedSongs = entries.map(\.song)
    localPlaybackURLs = Dictionary(uniqueKeysWithValues: entries.map { ($0.song.id, $0.localURL) })
    errorMessage = nil
  }

  private func loadSongsFromCacheOrServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    if let cachedSongs = await SongCacheStore.shared.loadSongs(for: cacheKey),
      !cachedSongs.isEmpty
    {
      loadedSongs = cachedSongs
      errorMessage = nil
      return
    }

    await reloadSongsFromServer()
  }

  private func reloadSongsFromServer() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    let cacheKey = LibrarySongCacheKey.current(for: client)
    songClientsByID = [:]
    isLoading = true
    defer { isLoading = false }

    do {
      let (fetched, clientsMap) = try await LibrarySongFetch.loadSongs(client: client)

      loadedSongs = fetched
      songClientsByID = clientsMap
      await SongCacheStore.shared.saveSongs(loadedSongs, for: cacheKey)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func effectiveSongClientsByID() -> [String: AsNavidromeClient] {
    if !injectedSongClientsByID.isEmpty {
      return injectedSongClientsByID
    }
    return songClientsByID
  }

  private func playbackURL(for song: Song) -> URL? {
    if isLocalDownloadedMode {
      return localPlaybackURLs[song.id]
    }
    if let client {
      return client.media.stream(forSongID: song.id)
    }
    let map = effectiveSongClientsByID()
    if let sourceClient = map[song.id] {
      return sourceClient.media.stream(forSongID: song.id)
    }
    return nil
  }

  private func queueItem(for song: Song) -> NowPlayingQueueItem {
    NowPlayingQueueItem(id: song.id)
  }

  private func openPlayer(for song: Song) {
    let item = queueItem(for: song)
    Task { @MainActor in
      await playback.insertAfterCurrentAndPlay(item)
    }
  }

  private func startPlaybackOrdered() {
    let items = playableQueueItems
    guard !items.isEmpty else { return }
    Task { @MainActor in
      await playback.replaceQueueAndPlay(items, startAt: 0)
    }
  }

  private func startPlaybackShuffled() {
    let items = playableQueueItems.shuffled()
    guard !items.isEmpty else { return }
    Task { @MainActor in
      await playback.replaceQueueAndPlay(items, startAt: 0)
    }
  }
}

