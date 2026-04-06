//
//  OnboardingView.swift
//  AsMusic
//

import SwiftUI

struct OnboardingView: View {
  @Environment(NavidromeSession.self) private var navidromeSession
  @AppStorage(AppUserDefaultsKey.Onboarding.completed) private var hasCompletedOnboarding = false

  @State private var serverManager = ServerManager()
  @State private var selectionStore = SelectedLibraryStore.shared
  @State private var step: Step = .welcome
  @State private var isServerEditorPresented = false

  private var appVersion: String {
    (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String)?.trimmingCharacters(
      in: .whitespacesAndNewlines
    )
    .nilIfEmpty ?? "—"
  }

  private var appBuild: String {
    (Bundle.main.infoDictionary?["CFBundleVersion"] as? String)?.trimmingCharacters(
      in: .whitespacesAndNewlines
    )
    .nilIfEmpty ?? "—"
  }

  var body: some View {
    let librarySelection = selectionStore.selection
    NavigationStack {
      Group {
        switch step {
        case .welcome:
          welcomeContent
        case .addServer:
          addServerContent
        case .chooseLibrary:
          LibrariesView()
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .navigationTitle(step.navigationTitle)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          if step != .welcome {
            Button("Back") {
              goBack()
            }
          }
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button("Skip") {
            hasCompletedOnboarding = true
          }
        }
      }
    }
    .sheet(isPresented: $isServerEditorPresented) {
      ServerEditorView(
        editingServer: nil,
        onSave: { _, hostname, username, password in
          serverManager.add(hostname: hostname, username: username, password: password)
        }
      )
      .environment(navidromeSession)
    }
    .onAppear {
      syncStepToAccountState()
    }
    .onChange(of: serverManager.servers.count) { oldCount, newCount in
      if step == .addServer, newCount > oldCount {
        step = .chooseLibrary
      }
      syncStepToAccountState()
    }
    .onChange(of: librarySelection) { _, newValue in
      guard step == .chooseLibrary, newValue != nil else { return }
      hasCompletedOnboarding = true
    }
  }

  private var welcomeContent: some View {
    ScrollView {
      VStack(spacing: 20) {
        AppIconOrPlaceholderView(size: 88, cornerRadius: 20, symbolPointSize: 52)
          .padding(.top, 24)

        Text("Welcome to AsMusic")
          .font(.title2.weight(.semibold))
          .multilineTextAlignment(.center)

        Text(
          "Connect a Navidrome or Subsonic-compatible server, pick a music library, and start listening."
        )
        .font(.body)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)

        Button {
          advanceFromWelcome()
        } label: {
          Text("Continue")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .padding(.top, 8)

        Spacer()

        VStack {
          Text("Made by An So © 2026")
            .font(.caption)
          Text("\(appVersion) (\(appBuild))")
            .font(.caption2)
        }
        .foregroundColor(.secondary)
        .listRowBackground(Color.clear)

      }
      .padding(.horizontal, 24)
      .padding(.bottom, 32)
    }
  }

  private var addServerContent: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        Text(
          "Add the URL, username, and password for your server. Use Test Server Connection before saving."
        )
        .font(.body)
        .foregroundStyle(.secondary)

        Button {
          isServerEditorPresented = true
        } label: {
          Label("Add server", systemImage: "plus.circle.fill")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)

        if serverManager.servers.isEmpty {
          Text("You need at least one saved server before choosing a library.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        } else {
          Button {
            step = .chooseLibrary
          } label: {
            Text("Continue")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
        }
      }
      .padding(.horizontal, 24)
      .padding(.vertical, 20)
    }
  }

  private func advanceFromWelcome() {
    if serverManager.servers.isEmpty {
      step = .addServer
    } else {
      step = .chooseLibrary
    }
  }

  private func goBack() {
    switch step {
    case .welcome:
      break
    case .addServer:
      step = .welcome
    case .chooseLibrary:
      step = serverManager.servers.isEmpty ? .welcome : .addServer
    }
  }

  /// If the user already has servers (e.g. added in Settings) or finishes setup out of order, jump to the right page.
  private func syncStepToAccountState() {
    if selectionStore.selection != nil {
      hasCompletedOnboarding = true
      return
    }
    if step == .chooseLibrary, serverManager.servers.isEmpty {
      step = .addServer
    }
  }

  private enum Step {
    case welcome
    case addServer
    case chooseLibrary

    var navigationTitle: String {
      switch self {
      case .welcome:
        return "Welcome"
      case .addServer:
        return "Server"
      case .chooseLibrary:
        return "Libraries"
      }
    }
  }
}

#Preview {
  OnboardingView()
    .environment(NavidromeSession())
}
