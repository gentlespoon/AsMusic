//
//  LibrarySongFetchSupport.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

// MARK: - Cache scope (shared with `SongCacheStore`)

enum LibrarySongCacheScope {
  static func current(for client: AsNavidromeClient) async -> (serverID: UUID, libraryID: String)? {
    let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
      SelectedLibraryStore.shared.selection
    }
    guard let selection else {
      return nil
    }
    let servers = await MainActor.run { ServerManager().servers }
    guard let server = servers.first(where: { $0.id == selection.serverID }) else {
      return nil
    }
    guard server.hostname == client.host, server.username == client.username else {
      return nil
    }
    return (selection.serverID, selection.folderID)
  }
}

// MARK: - Fetch (single source for library song list)

enum LibrarySongFetch {
  /// Loads the library song list and a map from song id to client (for album drill-down rows that reuse `SongsView`).
  static func loadSongs(
    client: AsNavidromeClient,
    onSongProgress: (@Sendable (Int) -> Void)? = nil
  ) async throws -> (
    songs: [Song],
    songClientsByID: [String: AsNavidromeClient]
  ) {
    let songs = try await client.song.getSongs(onProgress: onSongProgress)
    let map = Dictionary(uniqueKeysWithValues: songs.map { ($0.id, client) })
    return (songs, map)
  }
}

// MARK: - Full library cache refresh (LibraryView pull-to-refresh, LibrariesView selection)

enum LibrarySongCacheReload {
  /// Fetches library content for the current selection, updates caches, then notifies library UI (counts, lists).
  static func refreshCachedLibraryFromServer(client: AsNavidromeClient) async throws {
    try await fetchAndSave(client: client)
    await MainActor.run {
      LibraryRefreshCoordinator.shared.bump()
    }
  }

  static func fetchAndSave(client: AsNavidromeClient) async throws {
    guard let scope = await LibrarySongCacheScope.current(for: client) else { return }
    await MainActor.run {
      LibraryRefreshCoordinator.shared.beginLibraryReloadFromServer()
    }
    let onSongProgress: @Sendable (Int) -> Void = { count in
      Task { @MainActor in
        LibraryRefreshCoordinator.shared.reportSongsLoadedFromServer(count)
      }
    }
    do {
      async let songsResult = LibrarySongFetch.loadSongs(
        client: client,
        onSongProgress: onSongProgress
      )
      async let playlistsResult = client.getPlaylists()

      let (songs, _) = try await songsResult
      await MainActor.run {
        LibraryRefreshCoordinator.shared.setServerReloadStep(.loadingPlaylists)
      }
      let playlists = try await playlistsResult
      await MainActor.run {
        LibraryRefreshCoordinator.shared.setServerReloadStep(.savingCaches)
      }

      await SongCacheStore.shared.saveSongs(
        songs,
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )
      await PlaylistSummaryCacheStore.shared.savePlaylists(
        playlists,
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )
      let artists = LibraryIndexFromSongs.artists(from: songs)
      let albums = LibraryIndexFromSongs.albums(from: songs)
      let albumIDsByArtistID = Dictionary(
        uniqueKeysWithValues: artists.map { artist in
          (artist.id, LibraryIndexFromSongs.albums(for: artist, from: songs).map(\.id))
        }
      )
      let songIDsByAlbumID = Dictionary(
        uniqueKeysWithValues: albums.map { album in
          (album.id, LibraryIndexFromSongs.songs(in: album, from: songs).map(\.id))
        }
      )

      await ArtistCacheStore.shared.replaceArtists(
        artists,
        albumIDsByArtistID: albumIDsByArtistID,
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )
      await AlbumCacheStore.shared.replaceAlbums(
        albums,
        songIDsByAlbumID: songIDsByAlbumID,
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )
    } catch {
      await MainActor.run {
        LibraryRefreshCoordinator.shared.endLibraryReloadFromServer()
      }
      throw error
    }
    await MainActor.run {
      LibraryRefreshCoordinator.shared.endLibraryReloadFromServer()
    }
  }
}
