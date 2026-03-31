//
//  PlayerBarProgressBar.swift
//  AsMusic
//

import SwiftUI

struct PlayerBarProgressBar: View {
  let containerSize: CGSize
  let displayedTime: Double
  let duration: Double

  var body: some View {
    let w = max(containerSize.width, 0)
    let h = max(containerSize.height, 0)
    let playedFraction: CGFloat =
      duration > 0
      ? CGFloat(min(1, max(0, displayedTime / duration))) : 0

    return ZStack(alignment: .leading) {
      Rectangle()
        .fill(Color.primary.opacity(0.05))
        .frame(width: w, height: h)
      Rectangle()
        .fill(Color.primary.opacity(0.1))
        .frame(width: w * playedFraction, height: h)
    }
    .frame(width: w, height: h)
    .allowsHitTesting(false)
  }
}
