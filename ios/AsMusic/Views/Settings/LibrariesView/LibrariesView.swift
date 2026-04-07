//
//  LibrariesView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import AsNavidromeKit
import SwiftUI

struct LibrariesView: View {
  @State private var selectionStore = SelectedLibraryStore.shared
  @State private var serverManager = ServerManager()
  @State private var sections: [ServerFoldersSection] = []
  @State private var isLoading = false
  @State private var serverCheckProgress: ServerCheckProgress?

  var body: some View {
    List {
      Section {
        EmptyView()
      } footer: {
        VStack(alignment: .leading) {
          Text(
            """
              Select a library to start listening.
              Switching to a large library may take a while to load.
            """
          )
          .font(.caption)
        }
      }

      if let progress = serverCheckProgress {
        Section {
          HStack(alignment: .center, spacing: 12) {
            ProgressView()
            VStack(alignment: .leading, spacing: 4) {
              Text("Checking \(progress.hostname)")
                .font(.subheadline)
              Text("Server \(progress.currentIndex) of \(progress.total)")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
          }
          .accessibilityElement(children: .combine)
          .accessibilityLabel(
            "Checking server \(progress.currentIndex) of \(progress.total), \(progress.hostname)"
          )
        }
      }

      if sections.isEmpty, serverCheckProgress == nil, !isLoading {
        ContentUnavailableView(
          "No Library Data",
          systemImage: "music.note.house",
          description: Text("Add a server in Settings, then pull to refresh.")
        )
      } else {
        ForEach(sections) { section in
          Section(section.hostname) {
            if section.folders.isEmpty {
              Text("No music folders")
                .foregroundStyle(.secondary)
            } else {
              ForEach(section.folders) { folder in
                Button {
                  let alreadySelected = selectionStore.isSelected(
                    serverID: section.id,
                    folderID: folder.id
                  )
                  selectionStore.setSelection(serverID: section.id, folder: folder)
                  if !alreadySelected {
                    Task {
                      await reloadLibraryContents(forServerID: section.id)
                    }
                  }
                } label: {
                  HStack {
                    Text(folder.name)
                      .foregroundStyle(.primary)
                    Spacer()
                    if selectionStore.isSelected(serverID: section.id, folderID: folder.id) {
                      Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.tint)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    .refreshable {
      await loadMusicFolders()
    }
    .task {
      await loadMusicFolders()
    }
    .navigationTitle("Libraries")
    .onAppear {
      selectionStore.validateAgainstSavedServers(serverManager.servers)
    }
  }

  @MainActor
  private func loadMusicFolders() async {
    let servers = serverManager.servers
    if servers.isEmpty {
      sections = []
      isLoading = false
      serverCheckProgress = nil
      return
    }

    // Tuple list: `dict[key] = nil` removes keys; we must record “no row” per server without dropping ids.
    var cacheByServer: [(UUID, [MusicFolder]?)] = []
    for server in servers {
      let loaded = await LibraryFoldersCacheStore.shared.loadFolders(for: server.id)
      cacheByServer.append((server.id, loaded))
    }
    let anyCached = cacheByServer.contains { $0.1 != nil }

    if anyCached {
      sections = buildSections(
        servers: servers,
        folders: { id in
          cacheByServer.first(where: { $0.0 == id })?.1 ?? []
        }
      )
      isLoading = false
    } else {
      isLoading = true
    }

    defer {
      serverCheckProgress = nil
      isLoading = false
    }

    var fetchedSections: [ServerFoldersSection] = []
    for (index, server) in servers.enumerated() {
      serverCheckProgress = ServerCheckProgress(
        currentIndex: index + 1,
        total: servers.count,
        hostname: server.hostname
      )
      let client = await NavidromeClientStore.shared.client(for: server)
      do {
        let folders = try await client.library.getMusicFolders()
        await LibraryFoldersCacheStore.shared.saveFolders(folders, for: server.id)
        fetchedSections.append(
          ServerFoldersSection(
            id: server.id,
            hostname: server.hostname,
            folders: folders,
            errorMessage: nil
          ))
      } catch {
        let fallback: [MusicFolder]
        if let cached = cacheByServer.first(where: { $0.0 == server.id })?.1 {
          fallback = cached
        } else {
          fallback = await LibraryFoldersCacheStore.shared.loadFolders(for: server.id) ?? []
        }
        fetchedSections.append(
          ServerFoldersSection(
            id: server.id,
            hostname: server.hostname,
            folders: fallback,
            errorMessage: "Failed to load folders: \(error.localizedDescription)"
          ))
      }
    }

    sections = fetchedSections
  }

  private func reloadLibraryContents(forServerID serverID: UUID) async {
    guard let server = serverManager.servers.first(where: { $0.id == serverID }) else { return }
    let client = await NavidromeClientStore.shared.client(for: server)
    do {
      try await LibrarySongCacheReload.refreshCachedLibraryFromServer(client: client)
    } catch {
      // Same as LibraryView pull-to-refresh: no dedicated error surface here.
    }
  }

  private func buildSections(
    servers: [Server],
    folders: (UUID) -> [MusicFolder]
  ) -> [ServerFoldersSection] {
    var result: [ServerFoldersSection] = []
    for server in servers {
      result.append(
        ServerFoldersSection(
          id: server.id,
          hostname: server.hostname,
          folders: folders(server.id),
          errorMessage: nil
        ))
    }
    return result
  }
}

#Preview {
  NavigationStack {
    LibrariesView()
  }
}

private struct ServerFoldersSection: Identifiable {
  let id: UUID
  let hostname: String
  let folders: [MusicFolder]
  let errorMessage: String?
}

private struct ServerCheckProgress: Equatable {
  var currentIndex: Int
  var total: Int
  var hostname: String
}
