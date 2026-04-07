//
//  ServerManager.swift
//  AsMusic
//
//  Created by An So on 2026-03-14.
//

import SwiftUI

struct ServerManagerView: View {
  @Environment(NavidromeSession.self) private var navidromeSession
  @State private var serverManager = ServerManager()
  @State private var editorMode: EditorMode?
 
  var body: some View {
    NavigationStack {
      List {
        if serverManager.servers.isEmpty {
          ContentUnavailableView(
            "No Servers Yet",
            systemImage: "server.rack",
            description: Text("Tap + to add your first\n Navidrome/Subsonic server.")
          )
        } else {
          ForEach(serverManager.servers) { server in
            Button {
              editorMode = .edit(server)
            } label: {
              VStack(alignment: .leading, spacing: 4) {
                Text(server.hostname)
                  .font(.headline)
                Text(server.username)
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
          }
          .onDelete(perform: serverManager.delete)
        }
      }
      .navigationTitle("Servers")
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            editorMode = .add
          } label: {
            Image(systemName: "plus")
          }
        }
      }
      .sheet(item: $editorMode) { mode in
        switch mode {
        case .add:
          ServerEditorView(
            editingServer: nil,
            onSave: { _, hostname, username, password in
              serverManager.add(hostname: hostname, username: username, password: password)
            }
          )
        case .edit(let server):
          ServerEditorView(
            editingServer: server,
            onSave: { id, hostname, username, password in
              guard let id else { return }
              serverManager.update(
                id: id, hostname: hostname, username: username, password: password)
            }
          )
        }
      }
    }
  }
}

private enum EditorMode: Identifiable {
  case add
  case edit(Server)

  var id: String {
    switch self {
    case .add:
      return "add"
    case .edit(let server):
      return server.id.uuidString
    }
  }
}

#Preview {
  ServerManagerView()
    .environment(NavidromeSession())
}
