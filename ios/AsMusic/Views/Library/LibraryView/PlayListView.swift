//
//  PlayListView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct PlayListView: View {
  @Environment(\.libraryClient) private var client

  @State private var playlists: [PlaylistSummary] = []
  @State private var isLoading = false
  @State private var errorMessage: String?
  @State private var searchText = ""

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
          NavigationLink {
            PlaylistSongsView(playlistID: playlist.id, playlistName: playlist.name)
          } label: {
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
      }
    }
    .searchable(text: $searchText, prompt: "Filter playlists")
    .navigationTitle("Playlists")
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        Button("Create playlist", systemImage: "plus") {}
        Button("Update playlist", systemImage: "pencil") {}
        Button("Delete playlist", systemImage: "trash") {}
      }
    }
    .task {
      await loadPlaylists()
    }
    .refreshable {
      await loadPlaylists()
    }
  }

  private func loadPlaylists() async {
    guard let apiClient = await effectiveLibraryClient(client) else {
      errorMessage = "Add a server in Settings to load playlists."
      playlists = []
      return
    }

    isLoading = true
    defer { isLoading = false }

    do {
      playlists = try await apiClient.getPlaylists()
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

// MARK: - Playlist → SongsView

private struct PlaylistSongsView: View {
  let playlistID: String
  let playlistName: String

  @Environment(\.libraryClient) private var client

  @State private var songs: [Song] = []
  @State private var isLoading = true
  @State private var errorMessage: String?

  var body: some View {
    Group {
      if isLoading {
        ProgressView("Loading playlist…")
      } else if let errorMessage {
        ContentUnavailableView(
          "Unable to Load Playlist",
          systemImage: "exclamationmark.triangle",
          description: Text(errorMessage)
        )
      } else {
        SongsView(songs: songs, navigationTitle: playlistName)
      }
    }
    .navigationTitle(playlistName)
    .task {
      await loadDetail()
    }
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
      songs = detail.entry?.filter { $0.isDir != true } ?? []
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
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
