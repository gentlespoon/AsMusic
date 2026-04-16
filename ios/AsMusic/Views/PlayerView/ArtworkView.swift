//
//  ArtworkView.swift
//  AsMusic
//

import SwiftUI
import UIKit

struct ArtworkView: View {
  let artworkURL: URL?

  @State private var loadedImage: UIImage?

  var body: some View {
    Group {
      if let loadedImage {
        Image(uiImage: loadedImage)
          .resizable()
          .scaledToFill()
      } else {
        placeholder
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .clipShape(RoundedRectangle(cornerRadius: 12))
    .task(id: artworkURL?.absoluteString ?? "") {
      loadedImage = nil
      guard let artworkURL else { return }
      loadedImage = await ArtworkLoader.shared.uiImage(for: artworkURL)
    }
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
