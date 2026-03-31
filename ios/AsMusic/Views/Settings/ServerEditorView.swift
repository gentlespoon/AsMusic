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
  @State private var isConnectionVerified = false
  @State private var testMessage: String?
  @State private var testMessageIsError = false

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
          Text("""
            https://your-server.com:4533
            https:// or http:// required")
            Port is optional.
          """)
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
        }

        Section {
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
        }

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
