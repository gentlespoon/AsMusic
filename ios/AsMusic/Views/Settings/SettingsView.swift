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
      Section("General") {
        NavigationLink {
          AboutView()
        } label: {
          Label("About", systemImage: "info.circle")
        }
        NavigationLink {
          SettingsInterfaceView()
        } label: {
          Label("User Interface", systemImage: "paintpalette")
        }
      }.foregroundStyle(.primary)
      
      Section("Library") {
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
        NavigationLink {
          SettingsCacheView()
        } label: {
          Label("Cache", systemImage: "internaldrive")
        }
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
