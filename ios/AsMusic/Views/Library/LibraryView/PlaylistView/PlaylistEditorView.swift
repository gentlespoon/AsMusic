//
//  PlaylistEditorView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct PlaylistEditorView: View {
  let playlistID: String
  let playlistName: String
  let onSaved: () async -> Void

  @Environment(\.libraryClient) private var client
  @Environment(\.dismiss) private var dismiss

  @State private var songs: [Song] = []
  @State private var originalPlaylistEntries: [Song] = []
  @State private var selectedSongIDs: Set<String> = []
  @State private var originalSongIDs: Set<String> = []
  @State private var isLoading = false
  @State private var isSaving = false
  @State private var errorMessage: String?
  @State private var searchText = ""

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

  private var hasChanges: Bool {
    selectedSongIDs != originalSongIDs
  }

  var body: some View {
    List {
      if isLoading && songs.isEmpty {
        ProgressView("Loading songs...")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Playlist Editor",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if songs.isEmpty {
        ContentUnavailableView(
          "No Songs",
          systemImage: "music.note.list",
          description: Text("No songs found for this library.")
        )
      } else if filteredSongs.isEmpty {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No songs match your search.")
        )
      } else {
        ForEach(filteredSongs) { song in
          Button {
            toggleSelection(songID: song.id)
          } label: {
            HStack(spacing: 12) {
              SongRowContentView(song: song)
              Spacer(minLength: 8)
              if selectedSongIDs.contains(song.id) {
                Image(systemName: "checkmark.circle.fill")
                  .foregroundStyle(.tint)
              }
            }
          }
          .buttonStyle(.plain)
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter songs")
    .navigationTitle("Edit \(playlistName)")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        if isSaving {
          ProgressView()
        } else {
          Button("Done") {
            Task {
              await saveChanges()
            }
          }
          .disabled(!hasChanges)
        }
      }
    }
    .task {
      await loadEditorData()
    }
  }

  private func toggleSelection(songID: String) {
    if selectedSongIDs.contains(songID) {
      selectedSongIDs.remove(songID)
    } else {
      selectedSongIDs.insert(songID)
    }
  }

  private func loadEditorData() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to edit playlists."
      songs = []
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      let cachedSongs: [Song]
      if let scope = await LibrarySongCacheScope.current(for: apiClient) {
        cachedSongs = await SongCacheStore.shared.loadSongs(
          serverID: scope.serverID,
          libraryID: scope.libraryID
        ) ?? []
      } else {
        cachedSongs = []
      }
      async let allSongsRequest: [Song] = {
        if !cachedSongs.isEmpty { return cachedSongs }
        let (fetched, _) = try await LibrarySongFetch.loadSongs(client: apiClient)
        return fetched
      }()
      async let playlistRequest = apiClient.getPlaylist(id: playlistID)

      let (allSongs, playlistDetail) = try await (allSongsRequest, playlistRequest)
      let entries = playlistDetail.entry?.filter { $0.isDir != true } ?? []
      let ids = Set(entries.map(\.id))

      songs = allSongs
      originalPlaylistEntries = entries
      selectedSongIDs = ids
      originalSongIDs = ids
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func saveChanges() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to edit playlists."
      return
    }

    let songIDsToAdd = Array(selectedSongIDs.subtracting(originalSongIDs))
    let songIDsToRemove = originalSongIDs.subtracting(selectedSongIDs)
    let songIndexesToRemove = originalPlaylistEntries.enumerated().compactMap { index, song in
      songIDsToRemove.contains(song.id) ? index : nil
    }

    isSaving = true
    defer { isSaving = false }

    do {
      try await apiClient.updatePlaylist(
        id: playlistID,
        songIDsToAdd: songIDsToAdd,
        songIndexesToRemove: songIndexesToRemove
      )
      await onSaved()
      dismiss()
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

private func effectiveLibraryClient(_ environmentClient: AsNavidromeClient?) async
  -> AsNavidromeClient?
{
  return environmentClient
}
