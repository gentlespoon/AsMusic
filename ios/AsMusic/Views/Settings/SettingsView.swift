//
//  SettingsView.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import SwiftUI

struct SettingsView: View {
  @AppStorage("app.appearance") private var appAppearanceRaw = AppAppearance.system.rawValue

  var body: some View {
    List {

      Section("Appearance") {
        Picker("Color Scheme", selection: $appAppearanceRaw) {
          ForEach(AppAppearance.allCases) { appearance in
            Text(appearance.title).tag(appearance.rawValue)
          }
        }
        .pickerStyle(.segmented)
      }
      Section("Libraries") {
        NavigationLink("Server Manager") {
          ServerManagerView()
        }
        NavigationLink("Libraries") {
          LibrariesView()
        }
      }
    }
    .navigationTitle("Settings")
  }
}
