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
    case downloaded
    /// Songs currently being downloaded by `DownloadManager`.
    case downloading
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
  @State private var deleteErrorMessage: String?
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
    DownloadManager.canDownload(
      songs: filteredSongs,
      preferredClient: client,
      songClientsByID: injectedSongClientsByID
    )
  }

  var body: some View {
    List {
      if let artworkURL = resolvedAlbumArtworkURL {
        HStack(alignment: .center) {
          Spacer()
          ArtworkView(artworkURL: artworkURL)
            .frame(maxHeight: 180)
            .aspectRatio(1, contentMode: .fit)
          Spacer()
        }
      }

      if (isLibraryMode || isLocalDownloadedMode || isDownloadingMode) && isLoading && displaySongs.isEmpty {
        ProgressView(
          isLocalDownloadedMode
            ? "Checking downloads…"
            : isDownloadingMode
              ? "Checking downloading songs…"
              : "Loading songs..."
        )
      } else if isLibraryMode, let errorMessage {
        ContentUnavailableView(
          "Unable to Load Songs",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if displaySongs.isEmpty {
        ContentUnavailableView(
          isLocalDownloadedMode ? "No Downloaded Songs" : "No Songs",
          systemImage: isLocalDownloadedMode
            ? "arrow.down.circle"
            : isDownloadingMode
              ? "arrow.down.circle.dotted"
              : "music.note.list",
          description: Text(
            isLocalDownloadedMode
              ? "Songs you play are saved under Documents. Open Songs and play a track, then pull to refresh here."
              : isDownloadingMode
                ? "No songs are currently downloading."
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
            Label("Download all songs", systemImage: "arrow.down.circle")
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
      } else if isDownloadingMode {
        await loadDownloadingSongs()
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
    .alert("Unable to Delete Downloaded Song", isPresented: deleteErrorBinding) {
      Button("OK", role: .cancel) {
        deleteErrorMessage = nil
      }
    } message: {
      Text(deleteErrorMessage ?? "Unknown error.")
    }
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
      errorMessage = nil
      return
    }
    let localDownloaded = await DownloadManager.localDownloadedSongs(for: client)
    loadedSongs = localDownloaded.songs
    localPlaybackURLs = localDownloaded.playbackURLsBySongID
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
    loadedSongs = await DownloadManager.downloadingSongs()
    downloadingProgressBySongID = await DownloadManager.downloadingProgressBySongID()
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
    Group {
      if canQueue {
        Button {
          openPlayer(for: song)
        } label: {
          SongRowContentView(
            song: song,
            showsDownloadProgressBar: isDownloadingMode,
            downloadProgress: downloadingProgressBySongID[song.id]
          )
        }
      } else {
        SongRowContentView(
          song: song,
          showsDownloadProgressBar: isDownloadingMode,
          downloadProgress: downloadingProgressBySongID[song.id]
        )
      }
    }
    .buttonStyle(.plain)
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      if isDownloadingMode {
        Button(role: .destructive) {
          Task {
            await DownloadManager.removeFromDownloading(songID: song.id)
            loadedSongs = await DownloadManager.downloadingSongs()
          }
        } label: {
          Label("Remove from Downloading", systemImage: "xmark.circle")
        }
      } else {
        if isLocalDownloadedMode {
          Button(role: .destructive) {
            Task {
              await deleteDownloadedSong(song)
            }
          } label: {
            Label("Delete Download", systemImage: "trash")
          }
        }

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
  }

  private func deleteDownloadedSong(_ song: Song) async {
    guard isLocalDownloadedMode else { return }
    guard let localURL = localPlaybackURLs[song.id] else {
      await loadLocalDownloadedSongs()
      return
    }

    do {
      let fileManager = FileManager.default
      if fileManager.fileExists(atPath: localURL.path(percentEncoded: false)) {
        try fileManager.removeItem(at: localURL)
      }
      let markerURL = localURL.appendingPathExtension("cachecomplete")
      if fileManager.fileExists(atPath: markerURL.path(percentEncoded: false)) {
        try fileManager.removeItem(at: markerURL)
      }
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
