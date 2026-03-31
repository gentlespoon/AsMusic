//
//  PlaylistSongView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct PlaylistSongView: View {
  let playlistID: String
  let playlistName: String

  @Environment(\.dismiss) private var dismiss
  @Environment(\.libraryClient) private var client
  @Environment(MusicPlayerController.self) private var playback

  @State private var songs: [Song] = []
  @State private var serverPlaylistEntries: [Song] = []
  @State private var isLoading = true
  @State private var isSavingOrder = false
  @State private var errorMessage: String?
  @State private var searchText = ""
  @State private var isReorderMode = false
  @State private var isEditorPresented = false
  @State private var isConfirmingDelete = false
  @State private var deletePlaylistErrorMessage: String?
  @State private var downloadErrorMessage: String?
  @State private var editMode: EditMode = .inactive

  private var filteredSongs: [Song] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return songs }
    let needle = query.lowercased()
    return songs.filter { song in
      song.title.lowercased().contains(needle)
        || (song.artist?.lowercased().contains(needle) ?? false)
        || (song.album?.lowercased().contains(needle) ?? false)
    }
  }

  private var songsForList: [Song] {
    isReorderMode ? songs : filteredSongs
  }

  private var hasOrderChanges: Bool {
    songs.map(\.id) != serverPlaylistEntries.map(\.id)
  }

  private var playableQueueItems: [NowPlayingQueueItem] {
    songsForList.map { NowPlayingQueueItem(id: $0.id) }
  }

  private var canDownloadVisibleSongs: Bool {
    guard let client else { return false }
    return songsForList.contains { song in
      let remoteURL = client.media.download(forSongID: song.id)
      return !SongFileCache.hasCached(for: remoteURL, relativePath: song.path)
    }
  }

  var body: some View {
    List {
      if isLoading {
        ProgressView("Loading playlist…")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Playlist",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if songs.isEmpty {
        ContentUnavailableView(
          "No Songs",
          systemImage: "music.note.list",
          description: Text("This playlist has no songs.")
        )
      } else if !isReorderMode && filteredSongs.isEmpty {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No songs match your search.")
        )
      } else {
        ForEach(songsForList) { song in
          row(for: song)
        }
        .onMove(perform: moveSongs)
      }
    }
    .environment(\.editMode, $editMode)
    .searchable(text: $searchText, prompt: "Filter songs")
    .navigationTitle(playlistName)
    .toolbar {
      if isReorderMode {
        ToolbarItem(placement: .topBarTrailing) {
          if isSavingOrder {
            ProgressView()
          } else {
            Button("Save") {
              Task {
                await saveReorderedPlaylist()
              }
            }
          }
        }
      } else {
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

            Divider()

            Button("Re-order", systemImage: "line.3.horizontal") {
              enterReorderMode()
            }
            .disabled(songs.count <= 1)

            Button("Edit", systemImage: "pencil") {
              isEditorPresented = true
            }

            Divider()

            Button("Delete", systemImage: "trash", role: .destructive) {
              isConfirmingDelete = true
            }
          } label: {
            Label("More actions", systemImage: "ellipsis.circle")
          }
          .confirmationDialog(
            "Delete playlist?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
          ) {
            Button("Delete", role: .destructive) {
              Task {
                await deletePlaylist() // TODO: delete current playlist
              }
            }
          }
        }
      }
    }
    .task {
      await loadDetail()
    }
    .navigationDestination(isPresented: $isEditorPresented) {
      PlaylistEditorView(
        playlistID: playlistID,
        playlistName: playlistName,
        onSaved: {
          await loadDetail()
        }
      )
    }
    .alert("Unable to Delete Playlist", isPresented: deletePlaylistErrorBinding) {
      Button("OK", role: .cancel) {
        deletePlaylistErrorMessage = nil
      }
    } message: {
      Text(deletePlaylistErrorMessage ?? "Unknown error.")
    }
    .alert("Unable to Download Songs", isPresented: downloadErrorBinding) {
      Button("OK", role: .cancel) {
        downloadErrorMessage = nil
      }
    } message: {
      Text(downloadErrorMessage ?? "Unknown error.")
    }
  }

  @ViewBuilder
  private func row(for song: Song) -> some View {
    if isReorderMode {
      SongRowContentView(song: song)
    } else {
      Button {
        openPlayer(for: song)
      } label: {
        SongRowContentView(song: song)
      }
      .buttonStyle(.plain)
      .swipeActions(edge: .trailing, allowsFullSwipe: false) {
        Button {
          let item = NowPlayingQueueItem(id: song.id)
          Task { @MainActor in
            await playback.insertAfterCurrentWithoutPlaying(item)
          }
        } label: {
          Label("Play Next", systemImage: "text.insert")
        }
        .tint(.orange)

        Button {
          let item = NowPlayingQueueItem(id: song.id)
          playback.appendToEndOfQueue(item)
        } label: {
          Label("Add to Queue", systemImage: "text.line.last.and.arrowtriangle.forward")
        }
        .tint(.blue)
      }
    }
  }

  private func moveSongs(from source: IndexSet, to destination: Int) {
    guard isReorderMode else { return }
    songs.move(fromOffsets: source, toOffset: destination)
  }

  private func enterReorderMode() {
    searchText = ""
    isReorderMode = true
    editMode = .active
  }

  private func exitReorderMode() {
    isReorderMode = false
    editMode = .inactive
  }

  private func loadDetail() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      isLoading = false
      errorMessage = "Add a server in Settings to load playlists."
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      let detail = try await apiClient.getPlaylist(id: playlistID)
      let entries = detail.entry?.filter { $0.isDir != true } ?? []
      songs = entries
      serverPlaylistEntries = entries
      if let scope = await resolvePlaylistCacheScope(environmentClient: client) {
        await PlaylistSummaryCacheStore.shared.saveSongs(
          entries,
          forPlaylistID: playlistID,
          serverID: scope.serverID,
          libraryID: scope.libraryID
        )
      }
      errorMessage = nil
      exitReorderMode()
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func saveReorderedPlaylist() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to edit playlists."
      return
    }

    guard hasOrderChanges else {
      exitReorderMode()
      return
    }

    isSavingOrder = true
    defer { isSavingOrder = false }

    do {
      let removeIndexes = Array(serverPlaylistEntries.indices)
      try await apiClient.updatePlaylist(
        id: playlistID,
        songIDsToAdd: songs.map(\.id),
        songIndexesToRemove: removeIndexes
      )
      serverPlaylistEntries = songs
      if let scope = await resolvePlaylistCacheScope(environmentClient: client) {
        await PlaylistSummaryCacheStore.shared.saveSongs(
          songs,
          forPlaylistID: playlistID,
          serverID: scope.serverID,
          libraryID: scope.libraryID
        )
      }
      exitReorderMode()
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private var deletePlaylistErrorBinding: Binding<Bool> {
    Binding(
      get: { deletePlaylistErrorMessage != nil },
      set: { isPresented in
        if !isPresented {
          deletePlaylistErrorMessage = nil
        }
      }
    )
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

  private func downloadAllSongsInView() async {
    guard let client else { return }
    var failedCount = 0
    for song in songsForList {
      let remoteURL = client.media.download(forSongID: song.id)
      if SongFileCache.hasCached(for: remoteURL, relativePath: song.path) {
        continue
      }
      do {
        try await SongFileCache.downloadFullToCache(remoteURL: remoteURL, relativePath: song.path)
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

  private func deletePlaylist() async {
    do {
      _ = try await deletePlaylistAndRefreshCache(
        playlistID: playlistID,
        environmentClient: client
      )
      await MainActor.run {
        dismiss()
      }
    } catch {
      deletePlaylistErrorMessage = error.localizedDescription
    }
  }

  private func openPlayer(for song: Song) {
    let item = NowPlayingQueueItem(id: song.id)
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

private func effectiveLibraryClient(_ environmentClient: AsNavidromeClient?) async
  -> AsNavidromeClient?
{
  return environmentClient
}

private struct PlaylistCacheScope {
  let serverID: UUID
  let libraryID: String
}

private func resolvePlaylistCacheScope(environmentClient: AsNavidromeClient?) async
  -> PlaylistCacheScope?
{
  _ = environmentClient
  let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
    SelectedLibraryStore.shared.selection
  }
  if let selection {
    return PlaylistCacheScope(serverID: selection.serverID, libraryID: selection.folderID)
  }
  return nil
}
