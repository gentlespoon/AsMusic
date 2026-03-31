//
//  SongRowContentView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct SongRowContentView: View {
  let song: Song

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(song.title)
      if let subtitle = songRowSubtitle(artist: song.artist, album: song.album) {
        Text(subtitle)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }

  /// Artist and album on one line; separator only when both are non-empty. `nil` if neither is usable.
  private func songRowSubtitle(artist: String?, album: String?) -> String? {
    let a = trimmedNonEmpty(artist)
    let b = trimmedNonEmpty(album)
    switch (a, b) {
    case (nil, nil): return nil
    case (let x?, nil): return x
    case (nil, let y?): return y
    case (let x?, let y?): return "\(x) · \(y)"
    }
  }

  private func trimmedNonEmpty(_ s: String?) -> String? {
    guard let t = s?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else { return nil }
    return t
  }
}
