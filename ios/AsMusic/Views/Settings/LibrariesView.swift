//
//  LibrariesView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI
import AsNavidromeKit

struct LibrariesView: View {
  @State private var selectionStore = SelectedLibraryStore.shared
  @State private var serverManager = ServerManager()
  @State private var sections: [ServerFoldersSection] = []
  @State private var isLoading = false

  var body: some View {
    List {
      if isLoading && sections.isEmpty {
        ProgressView("Loading music folders...")
      } else if sections.isEmpty {
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
                  selectionStore.setSelection(serverID: section.id, folder: folder)
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

  private func loadMusicFolders() async {
    let servers = serverManager.servers
    if servers.isEmpty {
      sections = []
      isLoading = false
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
      sections = await buildSections(
        servers: servers,
        folders: { id in
          cacheByServer.first(where: { $0.0 == id })?.1 ?? []
        }
      )
      isLoading = false
    } else {
      isLoading = true
    }

    defer { isLoading = false }

    var fetchedSections: [ServerFoldersSection] = []
    for server in servers {
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

  private func buildSections(
    servers: [Server],
    folders: (UUID) -> [MusicFolder]
  ) async -> [ServerFoldersSection] {
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
