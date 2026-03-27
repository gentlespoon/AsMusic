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
      NavigationLink("Artists") {
        ArtistsView()
      }
      NavigationLink("Albums") {
        AlbumsView()
      }
      NavigationLink("Songs") {
        SongsView()
      }
      NavigationLink("Playlists") {
        PlayListView()
      }
      NavigationLink("Favorites") {
        LibraryPlaceholderView(title: "Favorites")
      }
      NavigationLink("Downloaded") {
        SongsView(navigationTitle: "Downloaded", listSource: .localDownloaded)
      }
    }
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

private struct LibraryPlaceholderView: View {
  let title: String

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "music.note")
        .font(.largeTitle)
        .foregroundStyle(.secondary)
      Text("\(title) placeholder")
        .font(.headline)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .navigationTitle(title)
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
