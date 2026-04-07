//
//  LibraryView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import AsNavidromeKit
import SwiftUI

struct LibraryView: View {
  let libraryName: String
  let client: AsNavidromeClient

  @State private var refreshCoordinator = LibraryRefreshCoordinator.shared
  @State private var allSongsCount = 0
  @State private var artistsCount = 0
  @State private var albumsCount = 0
  @State private var playlistsCount = 0
  @State private var favoritesCount = 0
  @State private var downloadedCount = 0
  @State private var downloadingCount = 0

  var body: some View {
    List {
      Section {
        NavigationLink {
          SongsView()
        } label: {
          HStack {
            Label("All Songs", systemImage: "music.note")
            Spacer()
            Text("\(allSongsCount)")
          }
        }
        NavigationLink {
          ArtistsView()
        } label: {
          HStack {
            Label("Artists", systemImage: "music.mic")
            Spacer()
            Text("\(artistsCount)")
          }
        }
        NavigationLink {
          AlbumsView()
        } label: {
          HStack {
            Label("Albums", systemImage: "square.stack")
            Spacer()
            Text("\(albumsCount)")
          }
        }
        NavigationLink {
          PlaylistView()
        } label: {
          HStack {
            Label("Playlists", systemImage: "music.note.list")
            Spacer()
            Text("\(playlistsCount)")
          }
        }
        NavigationLink {
          FavoritesView(client: client)
        } label: {
          HStack {
            Label("Favorites", systemImage: "heart.fill")
            Spacer()
            Text("\(favoritesCount)")
          }
        }
      }
      .foregroundStyle(.primary)

      Section {
        NavigationLink {
          SongsView(navigationTitle: "Downloaded", listSource: .downloaded)
        } label: {
          HStack {
            Label("Downloaded", systemImage: "arrow.down.circle")
            Spacer()
            Text("\(downloadedCount)")
          }
        }
        NavigationLink {
          SongsView(navigationTitle: "Downloading", listSource: .downloading)
        } label: {
          HStack {
            Label("Downloading", systemImage: "arrow.down.circle.dotted")
            Spacer()
            Text("\(downloadingCount)")
          }
        }
      }
      .foregroundStyle(.primary)
      
      Section {
        EmptyView()
      } header: {
        EmptyView()
      } footer: {
        VStack(alignment: .leading) {
          Text(
          """
          Empty library? Missing songs?
            Pull to reload from server.
          
          How to use Player Bar?
            Short tap            play/pause
            Swipe horizontally   skip track
            Swipe up             show player
            Hold and drag        seek
          """)
          .font(.caption2)
          
        }
        .font(.caption2)
        .monospaced(true)
      }
      
    }
    .navigationTitle(libraryName)
    .refreshable {
      await reloadLibraryContents()
    }
    .task {
      await refreshCounts()
    }
    .task(id: refreshCoordinator.generation) {
      await refreshCounts()
    }
    .onReceive(
      NotificationCenter.default.publisher(
        for: DownloadManager.downloadingSongsDidChangeNotification)
    ) { _ in
      Task {
        downloadingCount = await DownloadManager.downloadingSongs().count
      }
    }
    .onReceive(
      NotificationCenter.default.publisher(for: DownloadManager.downloadDidFinishNotification)
    ) { _ in
      Task {
        let downloaded = await DownloadManager.localDownloadedSongs(for: client)
        downloadedCount = downloaded.songs.count
        downloadingCount = await DownloadManager.downloadingSongs().count
      }
    }
  }

  private func reloadLibraryContents() async {
    do {
      try await LibrarySongCacheReload.refreshCachedLibraryFromServer(client: client)
    } catch {
      // Pull-to-refresh has no dedicated error UI; child screens show load failures.
    }
  }

  private func refreshCounts() async {
    guard let scope = await LibrarySongCacheScope.current(for: client) else {
      allSongsCount = 0
      artistsCount = 0
      albumsCount = 0
      playlistsCount = 0
      favoritesCount = 0
      downloadedCount = 0
      downloadingCount = await DownloadManager.downloadingSongs().count
      return
    }

    let songs =
      await SongCacheStore.shared.loadSongs(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      ) ?? []
    allSongsCount = songs.count
    favoritesCount = songs.reduce(into: 0) { count, song in
      if song.starred != nil {
        count += 1
      }
    }
    artistsCount =
      await ArtistCacheStore.shared.loadArtists(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )?.count ?? 0
    albumsCount =
      await AlbumCacheStore.shared.loadAlbums(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )?.count ?? 0
    playlistsCount =
      await PlaylistSummaryCacheStore.shared.loadPlaylists(
        serverID: scope.serverID,
        libraryID: scope.libraryID
      )?.count ?? 0

    let downloaded = await DownloadManager.localDownloadedSongs(for: client)
    downloadedCount = downloaded.songs.count
    downloadingCount = await DownloadManager.downloadingSongs().count
  }
}

private struct LibraryClientKey: EnvironmentKey {
  static let defaultValue: AsNavidromeClient? = nil
}

extension EnvironmentValues {
  var libraryClient: AsNavidromeClient? {
    get { self[LibraryClientKey.self] }
    set { self[LibraryClientKey.self] = newValue }
  }
}
