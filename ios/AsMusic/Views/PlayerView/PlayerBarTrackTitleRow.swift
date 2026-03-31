//
//  PlayerBarTrackTitleRow.swift
//  AsMusic
//

import SwiftUI

struct PlayerBarTrackTitleRow: View {
  let metadata: PlaybackTrackMetadata?
  let contentWidth: CGFloat

  var body: some View {
    VStack(spacing: 0) {
      if let meta = metadata, !meta.title.isEmpty {
        MarqueeTextLine(text: meta.title, lineStyle: .title, contentWidth: contentWidth)
        if let album = meta.album, !album.isEmpty {
          MarqueeTextLine(text: album, lineStyle: .album, contentWidth: contentWidth)
        }
        if let artist = meta.artist, !artist.isEmpty {
          MarqueeTextLine(text: artist, lineStyle: .artist, contentWidth: contentWidth)
        }
      } else {
        MarqueeTextLine(
          text: " - Not Playing -", lineStyle: .placeholder, contentWidth: contentWidth)
      }
    }
    .frame(maxHeight: .infinity)
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity)
    .padding(.horizontal, 12)
  }
}
