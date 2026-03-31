//
//  PlayListView.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation
import SwiftUI

struct PlaylistView: View {
  @Environment(\.libraryClient) private var client

  @State private var playlists: [PlaylistSummary] = []
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""
  @State private var isCreatePlaylistPromptPresented = false
  @State private var newPlaylistName = ""
  @State private var createPlaylistErrorMessage: String?
  @State private var playlistPendingEdit: PlaylistSummary?
  @State private var playlistPendingDelete: PlaylistSummary?
  @State private var deletePlaylistErrorMessage: String?

  private var filteredPlaylists: [PlaylistSummary] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return playlists }
    let needle = query.lowercased()
    return playlists.filter { playlist in
      playlist.name.lowercased().contains(needle)
    }
  }

  var body: some View {
    List {
      if isLoading && playlists.isEmpty {
        ProgressView("Loading playlists…")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Playlists",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else if playlists.isEmpty {
        ContentUnavailableView(
          "No Playlists",
          systemImage: "music.note.list",
          description: Text("No playlists on this server.")
        )
      } else if filteredPlaylists.isEmpty {
        ContentUnavailableView(
          "No Results",
          systemImage: "magnifyingglass",
          description: Text("No playlists match your search.")
        )
      } else {
        ForEach(filteredPlaylists) { playlist in
          PlaylistRowView(
            playlist: playlist,
            onDelete: {
              playlistPendingDelete = playlist
            }
          )
        }
      }
    }
    .searchable(text: $searchText, prompt: "Filter playlists")
    .navigationTitle("Playlists")
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        Button("Create playlist", systemImage: "plus") {
          newPlaylistName = ""
          isCreatePlaylistPromptPresented = true
        }
      }
    }
    .alert("Create Playlist", isPresented: $isCreatePlaylistPromptPresented) {
      TextField("Playlist name", text: $newPlaylistName)
      Button("Cancel", role: .cancel) {}
      Button("Create") {
        Task {
          await createPlaylist()
        }
      }
    } message: {
      Text("Enter a name for the new playlist.")
    }
    .alert("Unable to Create Playlist", isPresented: createPlaylistErrorBinding) {
      Button("OK", role: .cancel) {
        createPlaylistErrorMessage = nil
      }
    } message: {
      Text(createPlaylistErrorMessage ?? "Unknown error.")
    }
    .confirmationDialog("Delete Playlist?", isPresented: isConfirmingDeleteBinding, titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        guard let playlist = playlistPendingDelete else { return }
        Task {
          await deletePlaylist(playlist)
          playlistPendingDelete = nil
        }
      }
      Button("Cancel", role: .cancel) {
        playlistPendingDelete = nil
      }
    } message: {
      Text("This will permanently delete \"\(playlistPendingDelete?.name ?? "this playlist")\".")
    }
    .alert("Unable to Delete Playlist", isPresented: deletePlaylistErrorBinding) {
      Button("OK", role: .cancel) {
        deletePlaylistErrorMessage = nil
      }
    } message: {
      Text(deletePlaylistErrorMessage ?? "Unknown error.")
    }
    .task {
      await loadPlaylistsFromCache()
    }
    .refreshable {
      await reloadPlaylistsFromServer()
    }
    .navigationDestination(item: $playlistPendingEdit) { playlist in
      PlaylistEditorView(
        playlistID: playlist.id,
        playlistName: playlist.name,
        onSaved: {
          await loadPlaylistsFromCache()
        }
      )
    }
  }

  private func loadPlaylistsFromCache() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to load playlists."
      playlists = []
      return
    }

    isLoading = true
    defer { isLoading = false }

    let cacheKey = PlaylistSummaryCacheKey.current(for: apiClient)
    if let cached = await PlaylistSummaryCacheStore.shared.loadPlaylists(for: cacheKey) {
      playlists = cached
      errorMessage = nil
    } else {
      playlists = []
    }
  }

  private func reloadPlaylistsFromServer() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to load playlists."
      playlists = []
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      playlists = try await apiClient.getPlaylists()
      let cacheKey = PlaylistSummaryCacheKey.current(for: apiClient)
      await PlaylistSummaryCacheStore.shared.savePlaylists(playlists, for: cacheKey)
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private var createPlaylistErrorBinding: Binding<Bool> {
    Binding(
      get: { createPlaylistErrorMessage != nil },
      set: { isPresented in
        if !isPresented {
          createPlaylistErrorMessage = nil
        }
      }
    )
  }

  private func createPlaylist() async {
    let name = newPlaylistName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty else {
      createPlaylistErrorMessage = "Playlist name cannot be empty."
      return
    }

    guard let apiClient = await effectiveLibraryClient(client) else {
      createPlaylistErrorMessage = "Add a server in Settings to create playlists."
      return
    }

    do {
      try await apiClient.createPlaylist(name: name)
      await loadPlaylistsFromCache()
    } catch {
      createPlaylistErrorMessage = error.localizedDescription
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

  private var isConfirmingDeleteBinding: Binding<Bool> {
    Binding(
      get: { playlistPendingDelete != nil },
      set: { isPresented in
        if !isPresented {
          playlistPendingDelete = nil
        }
      }
    )
  }

  private func deletePlaylist(_ playlist: PlaylistSummary) async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      deletePlaylistErrorMessage = "Add a server in Settings to delete playlists."
      return
    }

    do {
      try await apiClient.deletePlaylist(id: playlist.id)
      playlists.removeAll { $0.id == playlist.id }
      let cacheKey = PlaylistSummaryCacheKey.current(for: apiClient)
      await PlaylistSummaryCacheStore.shared.savePlaylists(playlists, for: cacheKey)
    } catch {
      deletePlaylistErrorMessage = error.localizedDescription
    }
  }
}

private struct PlaylistRowLabelView: View {
  let playlist: PlaylistSummary

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(playlist.name)
      if let count = playlist.songCount {
        Text("\(count) songs")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }
}

private struct PlaylistRowView: View {
  let playlist: PlaylistSummary
  let onDelete: () -> Void

  var body: some View {
    NavigationLink {
      PlaylistSongView(playlistID: playlist.id, playlistName: playlist.name)
    } label: {
      PlaylistRowLabelView(playlist: playlist)
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      Button("Delete", role: .destructive, action: onDelete)
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

