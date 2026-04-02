//
//  SettingsInterfaceView.swift
//  AsMusic
//
//  Created by An So on 2026-04-02.
//

import SwiftUI

struct SettingsInterfaceView: View {
  @AppStorage(AppUserDefaultsKey.UI.appearance) private var appAppearanceRaw =
    AppAppearance.system.rawValue
  @AppStorage(AppUserDefaultsKey.Feedback.hapticsEnabled) private var hapticFeedbackEnabled = true

  var body: some View {
    List {
      Section {
        HStack {
          Text("Appearance")
          Spacer()
          Picker("", selection: $appAppearanceRaw) {
            ForEach([AppAppearance.light, AppAppearance.system, AppAppearance.dark]) { appearance in
              Image(systemName: appearance.symbolName)
                .tag(appearance.rawValue)
                .accessibilityLabel(appearance.title)
            }
          }
          .fixedSize()
          .pickerStyle(.segmented)
        }
        Toggle("Haptic feedback", isOn: $hapticFeedbackEnabled)
      }
      .foregroundStyle(.primary)
    }
    .navigationTitle("User Interface")
    .navigationBarTitleDisplayMode(.inline)
  }
}

#Preview {
  NavigationStack {
    SettingsInterfaceView()
  }
}
