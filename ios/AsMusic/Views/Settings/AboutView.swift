//
//  AboutView.swift
//  AsMusic
//
//  Created by An So on 2026-04-02.
//

import SwiftUI

struct AboutView: View {
  var body: some View {
    List {
      Section {
        EmptyView()
      } header: {
        EmptyView()
      } footer: {
        Text(
          """
            Made by An So © 2026
          
            Source code:
              https://github.com/gentlespoon/asmusic
          
            Feedback and issues:
              https://github.com/gentlespoon/asmusic/issues
          """
        )
        .font(.caption2)
        .monospaced(true)
      }
    }
  }
}
