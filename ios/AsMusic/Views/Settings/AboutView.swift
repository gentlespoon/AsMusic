//
//  AboutView.swift
//  AsMusic
//
//  Created by An So on 2026-04-02.
//

import SwiftUI

private enum AboutConstants {
  /// Shown in the mail composer subject line; change the address if you use a different inbox.
  static let feedbackEmail = "support@angdasoft.com"
  static let repositoryURL = URL(string: "https://github.com/gentlespoon/asmusic")!
  static let issuesURL = URL(string: "https://github.com/gentlespoon/asmusic/issues")!
}

struct AboutView: View {
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

  private var feedbackMailURL: URL? {
    guard var components = URLComponents(string: "mailto:\(AboutConstants.feedbackEmail)") else {
      return nil
    }
    components.queryItems = [URLQueryItem(name: "subject", value: "AsMusic feedback")]
    return components.url
  }

  var body: some View {
    List {
      Section {
        VStack(spacing: 14) {
          AppIconOrPlaceholderView()

          Text("AsMusic")
            .font(.title2.weight(.semibold))

          Text(
            "Play your personal library from Navidrome, Subsonic, and compatible servers—with a focused, native iOS experience."
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .fixedSize(horizontal: false, vertical: true)

          Text("Made by An So © 2026")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
            .listRowBackground(Color.clear)
        }
        .frame(maxWidth: .infinity)
      }
      .listRowBackground(Color.clear)

      Section("Version") {
        LabeledContent("Build", value: "\(appVersion) (\(appBuild))")
      }

      Section("Support") {
        if let feedbackMailURL {
          Link(destination: feedbackMailURL) {
            Label {
              Text("Send feedback")
            } icon: {
              Image(systemName: "envelope")
            }
          }
        }

        Link(destination: AboutConstants.issuesURL) {
          Label("Report an issue on GitHub", systemImage: "ladybug")
        }

        Link(destination: AboutConstants.repositoryURL) {
          Label("Repository", systemImage: "chevron.left.forwardslash.chevron.right")
        }
      }
      .foregroundStyle(.primary)
    }
    .navigationTitle("About")
    .navigationBarTitleDisplayMode(.inline)
  }
}

#Preview {
  NavigationStack {
    AboutView()
  }
}
