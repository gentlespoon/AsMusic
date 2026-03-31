//
//  PlayerArtworkView.swift
//  AsMusic
//

import SwiftUI

struct PlayerArtworkView: View {
  let artworkURL: URL?

  var body: some View {
    Group {
      if let artworkURL {
        AsyncImage(url: artworkURL) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .scaledToFill()
          case .failure, .empty:
            placeholder
          @unknown default:
            placeholder
          }
        }
      } else {
        placeholder
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .clipShape(RoundedRectangle(cornerRadius: 12))
  }
}

private extension PlayerArtworkView {
  var placeholder: some View {
    RoundedRectangle(cornerRadius: 12)
      .fill(.ultraThinMaterial)
      .overlay {
        Image(systemName: "music.note")
          .font(.system(size: 64))
          .foregroundStyle(.secondary)
      }
  }
}

#Preview {
  PlayerArtworkView(artworkURL: URL(string: ""))
}
