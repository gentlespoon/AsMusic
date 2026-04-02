//
//  SettingsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI

struct SettingsView: View {
  var body: some View {
    List {
      Section {
        NavigationLink {
          SettingsInterfaceView()
        } label: {
          Label("User Interface", systemImage: "paintpalette")
        }
        NavigationLink {
          SettingsLibrariesView()
        } label: {
          Label("Libraries", systemImage: "books.vertical")
        }
        NavigationLink {
          SettingsCacheView()
        } label: {
          Label("Cache", systemImage: "internaldrive")
        }
      }
      .foregroundStyle(.primary)

      NavigationLink {
        AboutView()
      } label: {
        Label("About AsMusic", systemImage: "info.circle")
      }
      .foregroundStyle(.primary)
    }
    .navigationTitle("Settings")
  }
}

#Preview {
  NavigationStack {
    SettingsView()
  }
}
