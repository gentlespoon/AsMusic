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

  var body: some View {
    List {
      Section {
        NavigationLink {
          SongsView()
        } label: {
          Label("All Songs", systemImage: "music.note")
        }
        NavigationLink {
          ArtistsView()
        } label: {
          Label("Artists", systemImage: "music.mic")
        }
        NavigationLink {
          AlbumsView()
        } label: {
          Label("Albums", systemImage: "square.stack")
        }
        NavigationLink {
          PlaylistView()
        } label: {
          Label("Playlists", systemImage: "music.note.list")
        }
        NavigationLink {
          FavoritesView(client: client)
        } label: {
          Label("Favorites", systemImage: "heart.fill")
        }
      }
      Section {
        NavigationLink {
          SongsView(navigationTitle: "Downloaded", listSource: .localDownloaded)
        } label: {
          Label("Downloaded", systemImage: "arrow.down.circle")
        }
      }
    }
    .foregroundStyle(.primary)
    .navigationTitle(libraryName)
    .refreshable {
      await reloadLibraryContents()
    }
  }

  private func reloadLibraryContents() async {
    do {
      try await LibrarySongCacheReload.fetchAndSave(client: client)
      refreshCoordinator.bump()
    } catch {
      // Pull-to-refresh has no dedicated error UI; child screens show load failures.
    }
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
