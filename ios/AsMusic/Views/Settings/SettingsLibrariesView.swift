//
//  SettingsLibrariesView.swift
//  AsMusic
//
//  Created by An So on 2026-04-02.
//

import SwiftUI

struct SettingsLibrariesView: View {
  var body: some View {
    List {
      Section {
        EmptyView()
      } footer: {
        VStack(alignment: .leading) {
          Text("Add a Navidrome/Subsonic server to start listening.")
            .font(.caption)
          Text("You may add multiple servers/libraries.")
            .font(.caption)
        }
      }
      
      Section {
        NavigationLink {
          ServerManagerView()
        } label: {
          Label("Servers", systemImage: "server.rack")
        }
        NavigationLink {
          LibrariesView()
        } label: {
          Label("Libraries", systemImage: "books.vertical")
        }
      }
      .foregroundStyle(.primary)
    }
    .navigationTitle("Libraries")
    .navigationBarTitleDisplayMode(.inline)
  }
}

#Preview {
  NavigationStack {
    SettingsLibrariesView()
  }
}
