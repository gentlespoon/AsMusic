//
//  SongsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import SwiftUI

struct SongsView: View {
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
  @State private var deleteErrorMessage: String?
  @State private var songPendingDeleteConfirmation: Song?
  @State private var downloadingProgressBySongID: [String: Double] = [:]
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
  private var isLocalDownloadedMode: Bool { fixedSongs == nil && listSource == .downloaded }
  private var isDownloadingMode: Bool { fixedSongs == nil && listSource == .downloading }
  private var isLibraryMode: Bool { fixedSongs == nil && listSource == .library }

  private var displaySongs: [Song] {
    fixedSongs ?? loadedSongs
  }

  private var filteredSongs: [Song] {
    SongsViewFilter.filteredSongs(from: displaySongs, searchText: searchText)
  }

  /// Songs currently shown in the list that can be played (respects search filter).
  private var playableQueueItems: [NowPlayingQueueItem] {
    SongsViewFilter.playableQueueItems(from: filteredSongs, playbackURL: playbackURL(for:))
  }

  private var canDownloadVisibleSongs: Bool {
    DownloadManager.canDownload(
      songs: filteredSongs,
      preferredClient: client,
      songClientsByID: injectedSongClientsByID
    )
  }

  var body: some View {
    songsListWithNotifications
  }

  private var listWithSearchAndToolbar: some View {
    List {
      SongsViewListContents(
        resolvedAlbumArtworkURL: resolvedAlbumArtworkURL,
        isLibraryMode: isLibraryMode,
        isLocalDownloadedMode: isLocalDownloadedMode,
        isDownloadingMode: isDownloadingMode,
        isLoading: isLoading,
        displaySongs: displaySongs,
        errorMessage: errorMessage,
        filteredSongs: filteredSongs
      ) { song in
        songRow(for: song)
      }
    }
    .searchable(text: $searchText, prompt: "Filter songs")
    .navigationTitle(navigationTitle)
    .toolbar {
      SongsViewToolbar(
        playableQueueIsEmpty: playableQueueItems.isEmpty,
        canDownloadVisibleSongs: canDownloadVisibleSongs,
        onPlayInOrder: startPlaybackOrdered,
        onPlayShuffled: startPlaybackShuffled,
        onDownloadAll: downloadAllSongsInView,
        onPlayAllNext: playAllSongsNext,
        onAddAllToQueue: addAllSongsToQueue
      )
    }
  }

  private var songsListWithLifecycle: some View {
    listWithSearchAndToolbar
      .task {
        if isLocalDownloadedMode {
          await loadLocalDownloadedSongs()
        } else if isDownloadingMode {
          await loadDownloadingSongs()
        } else if isLibraryMode {
          await loadSongsFromCacheOnly()
        }
      }
      .task(id: injectedAlbumArtworkURL?.absoluteString ?? "") {
        resolvedAlbumArtworkURL = await SongsViewFileSupport.resolvedAlbumArtworkDisplayURL(
          for: injectedAlbumArtworkURL
        )
      }
  }

  private var songsListWithAlerts: some View {
    songsListWithLifecycle
      .alert("Unable to Download Songs", isPresented: downloadErrorBinding) {
        Button("OK", role: .cancel) {
          downloadErrorMessage = nil
        }
      } message: {
        Text(downloadErrorMessage ?? "Unknown error.")
      }
      .alert("Unable to Delete Downloaded Song", isPresented: deleteErrorBinding) {
        Button("OK", role: .cancel) {
          deleteErrorMessage = nil
        }
      } message: {
        Text(deleteErrorMessage ?? "Unknown error.")
      }
      .confirmationDialog(
        "Delete Download",
        isPresented: deleteDownloadConfirmationBinding,
        titleVisibility: Visibility.visible
      ) {
        Button("Delete Download", role: .destructive) {
          if let song = songPendingDeleteConfirmation {
            Task {
              await deleteDownloadedSong(song)
            }
          }
        }
        Button("Cancel", role: .cancel) {}
      } message: {
        Text("Remove the downloaded file? You can download it again later.")
      }
  }

  private var songsListWithNotifications: some View {
    songsListWithAlerts
      .onReceive(NotificationCenter.default.publisher(for: DownloadManager.downloadingSongsDidChangeNotification)) { _ in
        Task {
          if isDownloadingMode {
            await loadDownloadingSongs()
          }
        }
      }
      .onReceive(NotificationCenter.default.publisher(for: DownloadManager.downloadDidFinishNotification)) { _ in
        Task {
          if isLocalDownloadedMode {
            await loadLocalDownloadedSongs()
          } else if isDownloadingMode {
            await loadDownloadingSongs()
          }
        }
      }
      .onReceive(NotificationCenter.default.publisher(for: DownloadManager.downloadProgressDidChangeNotification)) { _ in
        guard isDownloadingMode else { return }
        Task {
          downloadingProgressBySongID = await DownloadManager.downloadingProgressBySongID()
        }
      }
  }

  private func loadLocalDownloadedSongs() async {
    isLoading = true
    defer { isLoading = false }

    guard let client else {
      loadedSongs = []
      localPlaybackURLs = [:]
      errorMessage = nil
      return
    }
    let payload = await SongsViewDataLoading.loadLocalDownloaded(client: client)
    loadedSongs = payload.songs
    localPlaybackURLs = payload.playbackURLsBySongID
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

  private func loadDownloadingSongs() async {
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    let state = await SongsViewDataLoading.loadDownloadingState()
    loadedSongs = state.songs
    downloadingProgressBySongID = state.progressBySongID
  }

  private func playbackURL(for song: Song) -> URL? {
    if isLocalDownloadedMode {
      return localPlaybackURLs[song.id]
    }
    return DownloadManager.streamURL(
      for: song,
      preferredClient: client,
      songClientsByID: injectedSongClientsByID
    )
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

  private var deleteErrorBinding: Binding<Bool> {
    Binding(
      get: { deleteErrorMessage != nil },
      set: { isPresented in
        if !isPresented {
          deleteErrorMessage = nil
        }
      }
    )
  }

  private var deleteDownloadConfirmationBinding: Binding<Bool> {
    Binding(
      get: { songPendingDeleteConfirmation != nil },
      set: { isPresented in
        if !isPresented {
          songPendingDeleteConfirmation = nil
        }
      }
    )
  }

  private func downloadAllSongsInView() async {
    let failedCount = await DownloadManager.downloadAllMissing(
      songs: filteredSongs,
      preferredClient: client,
      songClientsByID: injectedSongClientsByID
    )
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
    SongsListRowView(
      song: song,
      showsDownloadProgressBar: isDownloadingMode,
      downloadProgress: downloadingProgressBySongID[song.id],
      canQueue: canQueue,
      isDownloadingMode: isDownloadingMode,
      isLocalDownloadedMode: isLocalDownloadedMode,
      onPlay: { openPlayer(for: song) },
      onRemoveFromDownloading: {
        await DownloadManager.removeFromDownloading(songID: song.id)
        loadedSongs = await DownloadManager.downloadingSongs()
      },
      onPlayNext: {
        let item = queueItem(for: song)
        Task { @MainActor in
          await playback.insertAfterCurrentWithoutPlaying(item)
        }
      },
      onAddToQueue: {
        let item = queueItem(for: song)
        playback.appendToEndOfQueue(item)
      },
      onRequestDeleteDownload: {
        songPendingDeleteConfirmation = song
      }
    )
  }

  private func deleteDownloadedSong(_ song: Song) async {
    defer { songPendingDeleteConfirmation = nil }
    guard isLocalDownloadedMode else { return }
    guard let localURL = localPlaybackURLs[song.id] else {
      await loadLocalDownloadedSongs()
      return
    }

    do {
      try SongsViewFileSupport.removeDownloadedFileAndMarker(at: localURL)
      await loadLocalDownloadedSongs()
    } catch {
      deleteErrorMessage = "Could not delete \(song.title)."
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
