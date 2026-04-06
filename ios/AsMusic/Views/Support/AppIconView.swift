//
//  AppIconView.swift
//  AsMusic
//

import SwiftUI
import UIKit

enum AppIconImage {
  static func uiImage(userInterfaceStyle: UIUserInterfaceStyle) -> UIImage? {
    let traits = UITraitCollection(userInterfaceStyle: userInterfaceStyle)
    if let icons = Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons") as? [String: Any],
      let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
      let files = primary["CFBundleIconFiles"] as? [String]
    {
      for name in files.reversed() {
        if let image = UIImage(named: name, in: nil, compatibleWith: traits) { return image }
      }
    }
    return UIImage(named: "AppIcon", in: nil, compatibleWith: traits)
  }
}

/// Rounded app icon from the bundle when available, otherwise the standard music-house SF Symbol.
struct AppIconOrPlaceholderView: View {
  @Environment(\.colorScheme) private var colorScheme

  var size: CGFloat = 72
  var cornerRadius: CGFloat = 16
  var symbolPointSize: CGFloat = 44

  var body: some View {
    let style: UIUserInterfaceStyle = colorScheme == .dark ? .dark : .light
    Group {
      if let uiImage = AppIconImage.uiImage(userInterfaceStyle: style) {
        Image(uiImage: uiImage)
          .resizable()
          .interpolation(.high)
          .aspectRatio(contentMode: .fit)
      } else {
        Image(systemName: "music.note.house.fill")
          .font(.system(size: symbolPointSize))
          .symbolRenderingMode(.hierarchical)
          .foregroundStyle(.tint)
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    .accessibilityHidden(true)
  }
}
