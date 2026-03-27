//
//  PlayerSheetView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import SwiftUI

struct PlayerSheetView: View {
  @Environment(MusicPlayerController.self) private var playback

  var body: some View {
    if let url = playback.currentSourceURL {
      NavigationStack {
        MusicPlayerView(
          url: url,
          cacheRelativePath: playback.currentCacheRelativePath,
          metadata: playback.currentMetadata
        )
        .navigationTitle(playback.currentMetadata?.title ?? "Not Playing")
        .navigationBarTitleDisplayMode(.inline)
      }
    } else {
      ContentUnavailableView(
        "Nothing Playing",
        systemImage: "music.note",
        description: Text("Choose a song to open the player.")
      )
    }
  }
}
