//
//  PlaylistSongView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct PlaylistSongView: View {
  let playlistID: String
  let playlistName: String

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

          Button("Re-order", systemImage: "line.3.horizontal") {
            enterReorderMode()
          }
          .disabled(songs.count <= 1)

          Button("Edit", systemImage: "pencil") {
            isEditorPresented = true
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
      exitReorderMode()
    } catch {
      errorMessage = error.localizedDescription
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
}

/// When "Use all libraries" is selected, `libraryClient` is nil; use the first saved server like `SongsView`.
private func effectiveLibraryClient(_ environmentClient: AsNavidromeClient?) async
  -> AsNavidromeClient?
{
  if let environmentClient { return environmentClient }
  let servers = await MainActor.run { ServerManager().servers }
  guard let first = servers.first else { return nil }
  return await NavidromeClientStore.shared.client(for: first)
}
