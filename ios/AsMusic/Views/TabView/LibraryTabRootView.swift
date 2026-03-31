//
//  LibraryTabRootView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct LibraryTabRootView: View {
  @State private var selectionStore = SelectedLibraryStore.shared

  var body: some View {
    Group {
      if let selection = selectionStore.selection {
        LibraryResolvedView(selection: selection)
          .id("\(selection.serverID.uuidString):\(selection.folderID)")
      } else {
        NavigationStack {
          ContentUnavailableView(
            "No Library Selected",
            systemImage: "music.note.house",
            description: Text("Choose a library in Settings → Libraries.")
          )
          .navigationTitle("Library")
        }
      }
    }
    .onAppear {
      selectionStore.validateAgainstSavedServers(ServerManager().servers)
    }
  }
}

private struct LibraryResolvedView: View {
  let selection: SelectedLibrary

  @State private var client: AsNavidromeClient?

  var body: some View {
    Group {
      if let client {
        NavigationStack {
          LibraryView(libraryName: selection.folderName, client: client)
        }
        .environment(\.libraryClient, client)
      } else {
        NavigationStack {
          ProgressView("Connecting…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Library")
        }
      }
    }
    .task(id: "\(selection.serverID.uuidString):\(selection.folderID)") {
      await resolveClient()
    }
  }

  private func resolveClient() async {
    client = nil
    let servers = ServerManager().servers
    guard let server = servers.first(where: { $0.id == selection.serverID }) else {
      SelectedLibraryStore.shared.clearSelection()
      return
    }
    client = await NavidromeClientStore.shared.client(for: server)
  }
}
