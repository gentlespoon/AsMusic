//
//  MarqueeTextLine.swift
//  AsMusic
//
//  Shared horizontally scrolling text when content overflows (e.g. player bar, full player).
//

import SwiftUI
import UIKit

enum MarqueeLineStyle {
  case title
  case album
  case artist
  case placeholder
  /// Full-screen player sheet — track name.
  case playerSheetTitle
  /// Full-screen player sheet — artist line (`NavigationLink` can wrap the marquee view).
  case playerSheetArtist
  /// Full-screen player sheet — album line.
  case playerSheetAlbum

  fileprivate var uiTextStyle: UIFont.TextStyle {
    switch self {
    case .title, .playerSheetArtist, .playerSheetAlbum: return .subheadline
    case .album, .placeholder: return .caption1
    case .artist: return .caption2
    case .playerSheetTitle: return .title3
    }
  }

  fileprivate var uiWeight: UIFont.Weight {
    switch self {
    case .title: return .bold
    case .album: return .semibold
    case .artist, .placeholder: return .regular
    case .playerSheetTitle: return .semibold
    case .playerSheetArtist: return .regular
    case .playerSheetAlbum: return .semibold
    }
  }

  func measureWidth(for text: String) -> CGFloat {
    let base = UIFont.preferredFont(forTextStyle: uiTextStyle)
    let metrics = UIFontMetrics(forTextStyle: uiTextStyle)
    let font = metrics.scaledFont(for: UIFont.systemFont(ofSize: base.pointSize, weight: uiWeight))
    return ceil((text as NSString).size(withAttributes: [.font: font]).width)
  }

  @ViewBuilder
  func textView(_ text: String) -> some View {
    switch self {
    case .title:
      Text(text).font(.subheadline.weight(.bold))
    case .album:
      Text(text).font(.caption).fontWeight(.semibold)
    case .artist:
      Text(text).font(.caption2)
    case .placeholder:
      Text(text).font(.caption)
    case .playerSheetTitle:
      Text(text).font(.title3).fontWeight(.semibold).multilineTextAlignment(.center)
    case .playerSheetArtist:
      Text(text).font(.subheadline).multilineTextAlignment(.center)
    case .playerSheetAlbum:
      Text(text).font(.subheadline).fontWeight(.medium).multilineTextAlignment(.center)
    }
  }
}

struct MarqueeTextLine: View {
  let text: String
  let lineStyle: MarqueeLineStyle
  let contentWidth: CGFloat

  private let gap: CGFloat = 32
  private let speed: CGFloat = 42

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private var measuredWidth: CGFloat {
    lineStyle.measureWidth(for: text)
  }

  private var needsMarquee: Bool {
    contentWidth > 1 && measuredWidth > contentWidth + 0.5
  }

  private var cycle: CGFloat {
    measuredWidth + gap
  }

  /// Only clamp to a fixed width once we know it (`PlayerSheetView` starts at 0 before `GeometryReader` reports).
  private var hasKnownContainerWidth: Bool {
    contentWidth > 1
  }

  var body: some View {
    lineCore.marqueeLineContainer(contentWidth: contentWidth, hasKnownWidth: hasKnownContainerWidth)
  }

  @ViewBuilder
  private var lineCore: some View {
    if needsMarquee && !reduceMotion {
      TimelineView(.animation(minimumInterval: 1 / 60, paused: false)) { timeline in
        let t = timeline.date.timeIntervalSinceReferenceDate
        let segment = Double(cycle)
        let p = CGFloat((t * Double(speed)).truncatingRemainder(dividingBy: segment))
        HStack(spacing: gap) {
          lineStyle.textView(text)
          lineStyle.textView(text)
        }
        .fixedSize(horizontal: true, vertical: false)
        .offset(x: -p)
      }
    } else {
      lineStyle.textView(text)
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .truncationMode(.tail)
        .frame(maxWidth: .infinity)
    }
  }
}

private extension View {
  /// Uses a flexible width until `contentWidth` is measured so lines are visible (e.g. in sheets on first layout).
  func marqueeLineContainer(contentWidth: CGFloat, hasKnownWidth: Bool) -> some View {
    Group {
      if hasKnownWidth {
        frame(width: contentWidth, alignment: .leading)
      } else {
        frame(maxWidth: .infinity)
      }
    }
    .clipped()
  }
}
