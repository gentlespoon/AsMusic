//
//  ArtworkView.swift
//  AsMusic
//

import SwiftUI

struct ArtworkView: View {
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

private extension ArtworkView {
  var placeholder: some View {
    RoundedRectangle(cornerRadius: 12)
      .fill(.ultraThinMaterial)
      .overlay {
        GeometryReader { proxy in
          let iconSize = min(proxy.size.width, proxy.size.height) * 0.4

          Image(systemName: "music.note")
            .resizable()
            .scaledToFit()
            .frame(width: iconSize, height: iconSize)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
  }
}

#Preview {
  ArtworkView(artworkURL: URL(string: ""))
}
