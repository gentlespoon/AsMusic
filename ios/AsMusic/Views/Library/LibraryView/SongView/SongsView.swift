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
  private let injectedAlbumArtworkURL: URL?
  /// When `fixedSongs` is used, map song id → client for rows that need an explicit client.
  private let injectedSongClientsByID: [String: AsNavidromeClient]
  private let listSource: ListSource

  @Environment(\.libraryClient) private var client
  @Environment(MusicPlayerController.self) private var playback

  @State private var loadedSongs: [Song] = []
  /// Populated in `.localDownloaded` mode for file playback.
  @State private var localPlaybackURLs: [String: URL] = [:]
  @State private var resolvedAlbumArtworkURL: URL?
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var downloadErrorMessage: String?
  @State private var searchText = ""

  init(
    songs: [Song]? = nil,
    navigationTitle: String = "Songs",
    albumArtworkURL: URL? = nil,
    songClientsByID: [String: AsNavidromeClient] = [:],
    listSource: ListSource = .library
  ) {
    self.fixedSongs = songs
    self.navigationTitle = navigationTitle
    self.injectedAlbumArtworkURL = albumArtworkURL
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

  private var canDownloadVisibleSongs: Bool {
    filteredSongs.contains { song in
      guard let request = downloadRequest(for: song) else { return false }
      return !SongFileCache.hasCached(for: request.remoteURL, relativePath: request.relativePath)
    }
  }

  var body: some View {
    List {
      if let artworkURL = resolvedAlbumArtworkURL {
        HStack(alignment: .center) {
          Spacer()
          PlayerArtworkView(artworkURL: artworkURL)
            .frame(maxHeight: 180)
            .aspectRatio(1, contentMode: .fit)
          Spacer()
        }
      }

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
          songRow(for: song)
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

        Menu {
          Button {
            Task {
              await downloadAllSongsInView()
            }
          } label: {
            Label("Download all songs in view", systemImage: "arrow.down.circle")
          }
          .disabled(!canDownloadVisibleSongs)

          Divider()
          
          Button {
            playAllSongsNext()
          } label: {
            Label("Play all next", systemImage: "text.insert")
          }
          .disabled(playableQueueItems.isEmpty)

          Button {
            addAllSongsToQueue()
          } label: {
            Label("Add all to queue", systemImage: "text.line.last.and.arrowtriangle.forward")
          }
          .disabled(playableQueueItems.isEmpty)
        } label: {
          Label("More actions", systemImage: "ellipsis.circle")
        }
      }
    }
    .task {
      if isLocalDownloadedMode {
        await loadLocalDownloadedSongs()
      } else if isLibraryMode {
        await loadSongsFromCacheOnly()
      }
    }
    .task(id: injectedAlbumArtworkURL?.absoluteString ?? "") {
      await resolveAlbumArtworkURL()
    }
    .alert("Unable to Download Songs", isPresented: downloadErrorBinding) {
      Button("OK", role: .cancel) {
        downloadErrorMessage = nil
      }
    } message: {
      Text(downloadErrorMessage ?? "Unknown error.")
    }
  }

  private func resolveAlbumArtworkURL() async {
    guard let injectedAlbumArtworkURL else {
      resolvedAlbumArtworkURL = nil
      return
    }
    resolvedAlbumArtworkURL = await ArtworkFileCache.displayURL(for: injectedAlbumArtworkURL)
  }

  private func loadLocalDownloadedSongs() async {
    isLoading = true
    defer { isLoading = false }

    guard let client else {
      loadedSongs = []
      localPlaybackURLs = [:]
      return
    }

    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      loadedSongs = []
      localPlaybackURLs = [:]
      errorMessage = nil
      return
    }
    guard
      let cachedSongs = await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ),
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

  private func loadSongsFromCacheOnly() async {
    guard let client else {
      errorMessage = "No library connection."
      return
    }

    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      loadedSongs = []
      errorMessage = nil
      return
    }

    isLoading = true
    defer { isLoading = false }

    loadedSongs =
      await SongCacheStore.shared.loadSongs(
      serverID: scope.serverID,
      libraryID: scope.libraryID
      ) ?? []
    errorMessage = nil
  }

  private func playbackURL(for song: Song) -> URL? {
    if isLocalDownloadedMode {
      return localPlaybackURLs[song.id]
    }
    if let client {
      return client.media.stream(forSongID: song.id)
    }
    if let sourceClient = injectedSongClientsByID[song.id] {
      return sourceClient.media.stream(forSongID: song.id)
    }
    return nil
  }

  private func queueItem(for song: Song) -> NowPlayingQueueItem {
    NowPlayingQueueItem(id: song.id)
  }

  private var downloadErrorBinding: Binding<Bool> {
    Binding(
      get: { downloadErrorMessage != nil },
      set: { isPresented in
        if !isPresented {
          downloadErrorMessage = nil
        }
      }
    )
  }

  private func downloadRequest(for song: Song) -> (remoteURL: URL, relativePath: String?)? {
    if let client {
      return (client.media.download(forSongID: song.id), song.path)
    }
    guard let sourceClient = injectedSongClientsByID[song.id] else { return nil }
    return (sourceClient.media.download(forSongID: song.id), song.path)
  }

  private func downloadAllSongsInView() async {
    var failedCount = 0
    for song in filteredSongs {
      guard let request = downloadRequest(for: song) else { continue }
      if SongFileCache.hasCached(for: request.remoteURL, relativePath: request.relativePath) {
        continue
      }
      do {
        try await SongFileCache.downloadFullToCache(
          remoteURL: request.remoteURL,
          relativePath: request.relativePath
        )
      } catch {
        failedCount += 1
      }
    }
    if failedCount > 0 {
      downloadErrorMessage =
        failedCount == 1
        ? "One song could not be downloaded."
        : "\(failedCount) songs could not be downloaded."
    }
  }

  @ViewBuilder
  private func songRow(for song: Song) -> some View {
    let canQueue = playbackURL(for: song) != nil
    Group {
      if canQueue {
        Button {
          openPlayer(for: song)
        } label: {
          SongRowContentView(song: song)
        }
      } else {
        SongRowContentView(song: song)
      }
    }
    .buttonStyle(.plain)
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button {
        guard canQueue else { return }
        let item = queueItem(for: song)
        Task { @MainActor in
          await playback.insertAfterCurrentWithoutPlaying(item)
        }
      } label: {
        Label("Play Next", systemImage: "text.insert")
      }
      .tint(.orange)
      .disabled(!canQueue)

      Button {
        guard canQueue else { return }
        let item = queueItem(for: song)
        playback.appendToEndOfQueue(item)
      } label: {
        Label("Add to Queue", systemImage: "text.line.last.and.arrowtriangle.forward")
      }
      .tint(.blue)
      .disabled(!canQueue)
    }
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

  private func addAllSongsToQueue() {
    let items = playableQueueItems
    guard !items.isEmpty else { return }
    for item in items {
      playback.appendToEndOfQueue(item)
    }
  }

  private func playAllSongsNext() {
    let items = playableQueueItems
    guard !items.isEmpty else { return }
    Task { @MainActor in
      // Insert in reverse so the first visible song becomes immediate "next".
      for item in items.reversed() {
        await playback.insertAfterCurrentWithoutPlaying(item)
      }
    }
  }
}
