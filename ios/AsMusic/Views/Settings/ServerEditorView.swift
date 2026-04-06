//
//  ServerEditorView.swift
//  AsMusic
//

import SwiftUI

struct ServerEditorView: View {
  @Environment(NavidromeSession.self) private var navidromeSession
  @Environment(\.dismiss) private var dismiss

  let editingServer: Server?
  let onSave: (UUID?, String, String, String) -> Void

  @State private var hostname = ""
  @State private var username = ""
  @State private var password = ""
  @State private var saveErrorMessage: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("", text: $hostname)
            .autocapitalization(.none)
            .autocorrectionDisabled(true)
        } header: {
          Text("Server URL")
        } footer: {
          Text(
            """
            https://your-server.com:4533
            Include https:// or http://. Port is optional.
            """
          )
          .font(.caption)
          .foregroundStyle(.primary)
        }
        Section {
          TextField("", text: $username)
            .autocapitalization(.none)
            .autocorrectionDisabled(true)
        } header: {
          Text("Username")
        }
        Section {
          SecureField("", text: $password)
            .autocapitalization(.none)
            .autocorrectionDisabled(true)
        } header: {
          Text("Password")
        } footer: {
          Text("Save verifies the connection, then stores this server.")
            .font(.caption)
        }

        if let saveErrorMessage {
          Text(saveErrorMessage)
            .font(.footnote)
            .foregroundStyle(.red)
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
          Button {
            Task {
              await verifyConnectionAndSave()
            }
          } label: {
            if navidromeSession.isConnecting {
              HStack(spacing: 6) {
                ProgressView()
                Text("Verifying…")
              }
            } else {
              Text("Save")
            }
          }
          .disabled(
            navidromeSession.isConnecting
              || hostname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              || username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
          )
        }
      }
      .onChange(of: hostname) { _, _ in saveErrorMessage = nil }
      .onChange(of: username) { _, _ in saveErrorMessage = nil }
      .onChange(of: password) { _, _ in saveErrorMessage = nil }
      .onAppear {
        guard let editingServer else { return }
        hostname = editingServer.hostname
        username = editingServer.username
        password = editingServer.password
      }
    }
  }

  private func verifyConnectionAndSave() async {
    saveErrorMessage = nil
    let didConnect = await navidromeSession.testAndSetClient(
      hostname: hostname,
      username: username,
      password: password
    )
    guard didConnect else {
      saveErrorMessage =
        navidromeSession.lastConnectionError ?? "Unable to connect to server."
      return
    }
    onSave(editingServer?.id, hostname, username, password)
    dismiss()
  }
}
