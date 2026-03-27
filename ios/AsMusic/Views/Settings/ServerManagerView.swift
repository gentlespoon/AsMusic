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

private struct ServerEditorView: View {
  @Environment(NavidromeSession.self) private var navidromeSession
  @Environment(\.dismiss) private var dismiss

  let editingServer: Server?
  let onSave: (UUID?, String, String, String) -> Void

  @State private var hostname = ""
  @State private var username = ""
  @State private var password = ""
  @State private var isConnectionVerified = false
  @State private var testMessage: String?
  @State private var testMessageIsError = false

  var body: some View {
    NavigationStack {
      Form {
        TextField("Hostname", text: $hostname)
        TextField("Username", text: $username)
        SecureField("Password", text: $password)

        Button {
          Task {
            await testServerConnection()
          }
        } label: {
          if navidromeSession.isConnecting {
            HStack {
              ProgressView()
              Text("Testing Connection...")
            }
          } else {
            Text("Test Server Connection")
          }
        }
        .disabled(
          navidromeSession.isConnecting
            || hostname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        )

        if let testMessage {
          Text(testMessage)
            .font(.footnote)
            .foregroundStyle(testMessageIsError ? .red : .green)
        }
      }
      .navigationTitle(editingServer == nil ? "Add Server" : "Edit Server")
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button("Cancel") {
            dismiss()
          }
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button("Save") {
            onSave(editingServer?.id, hostname, username, password)
            dismiss()
          }
          .disabled(
            !isConnectionVerified
              || hostname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              || username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              || navidromeSession.isConnecting
          )
        }
      }
      .onChange(of: hostname) { _, _ in resetVerificationState() }
      .onChange(of: username) { _, _ in resetVerificationState() }
      .onChange(of: password) { _, _ in resetVerificationState() }
      .onAppear {
        guard let editingServer else { return }
        hostname = editingServer.hostname
        username = editingServer.username
        password = editingServer.password
      }
    }
  }

  private func resetVerificationState() {
    isConnectionVerified = false
    testMessage = nil
  }

  private func testServerConnection() async {
    testMessage = nil
    let didConnect = await navidromeSession.testAndSetClient(
      hostname: hostname,
      username: username,
      password: password
    )
    isConnectionVerified = didConnect
    if didConnect {
      testMessage = "Connection successful. You can now save this server."
      testMessageIsError = false
    } else {
      testMessage = navidromeSession.lastConnectionError ?? "Unable to connect to server."
      testMessageIsError = true
    }
  }
}
