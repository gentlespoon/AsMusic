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
      await loadPlaylistsFromCache()
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
    guard let cacheKey = await resolvePlaylistCacheKey() else {
      errorMessage = "Add a server in Settings to load playlists."
      playlists = []
      return
    }

    isLoading = true
    defer { isLoading = false }

    if let cached = await PlaylistSummaryCacheStore.shared.loadPlaylists(
      serverID: cacheKey.serverID,
      libraryID: cacheKey.libraryID
    ) {
      playlists = cached
    } else {
      playlists = []
    }
    errorMessage = nil
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

    guard let context = await resolvePlaylistCacheContext() else {
      createPlaylistErrorMessage = "Add a server in Settings to create playlists."
      return
    }

    do {
      try await context.client.createPlaylist(name: name)
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
    do {
      playlists = try await deletePlaylistAndRefreshCache(
        playlistID: playlist.id,
        environmentClient: client
      )
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
        Text("\(count) \(count == 1 ? "song" : "songs")")
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

private struct PlaylistCacheContext {
  let client: AsNavidromeClient
  let serverID: UUID
  let libraryID: String
}

private struct PlaylistCacheKey {
  let serverID: UUID
  let libraryID: String
}

private func resolvePlaylistCacheKey() async -> PlaylistCacheKey? {
  let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
    SelectedLibraryStore.shared.selection
  }
  guard let selection else { return nil }
  return PlaylistCacheKey(serverID: selection.serverID, libraryID: selection.folderID)
}

private func resolvePlaylistCacheContext() async -> PlaylistCacheContext?
{
  let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
    SelectedLibraryStore.shared.selection
  }
  if let selection {
    let servers = await MainActor.run { ServerManager().servers }
    guard let server = servers.first(where: { $0.id == selection.serverID }) else { return nil }
    let client = await NavidromeClientStore.shared.client(for: server)
    return PlaylistCacheContext(client: client, serverID: selection.serverID, libraryID: selection.folderID)
  }
  return nil
}

