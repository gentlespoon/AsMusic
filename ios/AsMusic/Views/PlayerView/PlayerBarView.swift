//
//  PlayerBarView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import SwiftUI

struct PlayerBarView: View {
  @Environment(MusicPlayerController.self) private var playback

  // Carousel / layout
  @State private var carouselWidth: CGFloat = 0
  @State private var horizontalDrag: CGFloat = 0
  @State private var verticalDrag: CGFloat = 0
  @State private var isCarouselFinishing = false

  // Smooth progress (between AVPlayer ~0.5s samples)
  @State private var smoothPlaybackAnchorDate: Date = .now
  @State private var smoothPlaybackAnchorValue: Double = 0

  // Bar gesture: quick horizontal = track carousel; long-press then drag = seek
  private enum BarDragPhase {
    case undecided
    case carousel
    case seeking
  }

  @State private var barDragPhase: BarDragPhase = .undecided
  @State private var barGestureStartTime: Date?
  @State private var seekPivotTranslationX: CGFloat = 0
  @State private var seekPivotTime: Double = 0
  @State private var scrubDisplayTime: Double?
  @State private var lastScrubSeekAt: Date = .distantPast

  private enum Bar {
    static let swipeThreshold: CGFloat = 28
    static let tapMaxDistance: CGFloat = 10
    static let edgeRubberBand: CGFloat = 0.22
    static let horizontalPadding: CGFloat = 12
    static let longPressSeconds: TimeInterval = 0.38
    static let quickSwipeCommitSlop: CGFloat = 12
    static let scrubSeekThrottle: TimeInterval = 0.12
    static let spring = Animation.spring(response: 0.35, dampingFraction: 0.82)
    static let carouselFinishDelayNs: UInt64 = 320_000_000
  }

  private var nextQueueMetadata: PlaybackTrackMetadata? {
    guard let idx = playback.currentQueueIndex,
      idx + 1 < playback.nowPlayingQueue.count
    else { return nil }
    return playback.metadataForQueueIndex(idx + 1)
  }

  private var previousQueueMetadata: PlaybackTrackMetadata? {
    guard let idx = playback.currentQueueIndex, idx > 0 else { return nil }
    return playback.metadataForQueueIndex(idx - 1)
  }

  var body: some View {
    playingTitle
  }

  // MARK: - Main stack

  private var playingTitle: some View {
    GeometryReader { geo in
      let barWidth = geo.size.width
      let titleWidth = max(0, barWidth - 2 * Bar.horizontalPadding)

      ZStack(alignment: .leading) {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !playback.isPlaying)) {
          timeline in
          progressBar(
            containerSize: geo.size,
            displayedTime: scrubDisplayTime ?? displayedPlaybackTime(at: timeline.date))
        }

        if let prev = previousQueueMetadata {
          trackTitleRow(metadata: prev, contentWidth: titleWidth)
            .frame(width: barWidth, alignment: .center)
            .offset(x: -barWidth + horizontalDrag)
        }
        if let next = nextQueueMetadata {
          trackTitleRow(metadata: next, contentWidth: titleWidth)
            .frame(width: barWidth, alignment: .center)
            .offset(x: barWidth + horizontalDrag)
        }
        trackTitleRow(
          metadata: playback.currentQueueIndex.flatMap { playback.metadataForQueueIndex($0) }
            ?? playback.currentMetadata,
          contentWidth: titleWidth)
          .frame(width: barWidth, alignment: .center)
          .offset(x: horizontalDrag)
      }
      .frame(width: barWidth, alignment: .leading)
      .clipped()
      .offset(y: verticalDrag)
      .onAppear {
        carouselWidth = barWidth
        syncSmoothPlaybackAnchor()
      }
      .onChange(of: barWidth) { _, new in carouselWidth = new }
      .onChange(of: playback.currentTime) { _, _ in syncSmoothPlaybackAnchor() }
      .onChange(of: playback.isPlaying) { _, playing in
        if playing { syncSmoothPlaybackAnchor() }
      }
    }
    .frame(maxWidth: .infinity)
    .contentShape(Rectangle())
    .gesture(barDragGesture)
  }

  private var barDragGesture: some Gesture {
    DragGesture(minimumDistance: 0)
      .onChanged { handleBarDragChanged($0) }
      .onEnded { handleBarDragEnded($0) }
  }

  @ViewBuilder
  private func trackTitleRow(metadata: PlaybackTrackMetadata?, contentWidth: CGFloat) -> some View {
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
    .padding(.horizontal, Bar.horizontalPadding)
  }

  private func progressBar(containerSize: CGSize, displayedTime: Double) -> some View {
    let w = max(containerSize.width, 0)
    let h = max(containerSize.height, 0)
    let d = playback.duration
    let playedFraction: CGFloat =
      d > 0
      ? CGFloat(min(1, max(0, displayedTime / d))) : 0

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

  // MARK: - Playback

  private func displayedPlaybackTime(at date: Date) -> Double {
    let d = playback.duration
    if d <= 0 { return 0 }
    if !playback.isPlaying {
      return min(max(0, playback.currentTime), d)
    }
    let t = smoothPlaybackAnchorValue + date.timeIntervalSince(smoothPlaybackAnchorDate)
    return min(max(0, t), d)
  }

  private func syncSmoothPlaybackAnchor() {
    smoothPlaybackAnchorValue = playback.currentTime
    smoothPlaybackAnchorDate = Date()
  }

  private func applyScrubSeek(time: Double) {
    let d = playback.duration
    guard d > 0 else { return }
    let clamped = min(max(0, time), d)
    scrubDisplayTime = clamped
    let now = Date()
    if now.timeIntervalSince(lastScrubSeekAt) >= Bar.scrubSeekThrottle {
      lastScrubSeekAt = now
      playback.seek(to: clamped)
    }
  }

  // MARK: - Bar drag

  private func handleBarDragChanged(_ value: DragGesture.Value) {
    guard !isCarouselFinishing else { return }
    let h = value.translation.width
    let v = value.translation.height

    if barGestureStartTime == nil {
      barGestureStartTime = Date()
    }
    let elapsed = Date().timeIntervalSince(barGestureStartTime ?? Date())

    switch barDragPhase {
    case .seeking:
      updateSeekDrag(translation: value.translation.width)
    case .carousel:
      updateCarouselDrag(horizontal: h, vertical: v)
    case .undecided:
      if tryCommitQuickSwipeToCarousel(h: h, v: v, elapsed: elapsed) {
        return
      }
      if tryEnterSeekModeIfLongPressElapsed(value: value, elapsed: elapsed) {
        return
      }
      updateUndecidedDragPreview(horizontal: h, vertical: v)
    }
  }

  private func handleBarDragEnded(_ value: DragGesture.Value) {
    guard !isCarouselFinishing else { return }

    let h = value.translation.width
    let v = value.translation.height
    let dist = hypot(h, v)
    let barW = max(carouselWidth, 1)
    let elapsed = barGestureStartTime.map { Date().timeIntervalSince($0) } ?? 0
    let phase = barDragPhase

    switch phase {
    case .seeking:
      let d = playback.duration
      if d > 0 {
        let final = scrubDisplayTime ?? playback.currentTime
        playback.seek(to: min(max(0, final), d))
        syncSmoothPlaybackAnchor()
      }
      resetBarGestureState()
      springResetDrag()

    case .carousel:
      resetBarGestureState()
      if wantsPresentPlayer(h: h, v: v) {
        handlePresentPlayer()
        return
      }
      if wantsSkipNext(h: h, v: v) {
        runCarouselFinish(skipNext: true, barWidth: barW)
        return
      }
      if wantsSkipPrevious(h: h, v: v) {
        runCarouselFinish(skipNext: false, barWidth: barW)
        return
      }
      springResetDrag()

    case .undecided:
      resetBarGestureState()
      if dist <= Bar.tapMaxDistance, elapsed < Bar.longPressSeconds {
        playback.togglePlayPause()
        springResetDrag()
        return
      }
      if wantsPresentPlayer(h: h, v: v) {
        handlePresentPlayer()
        return
      }
      springResetDrag()
    }
  }

  private func resetBarGestureState() {
    barDragPhase = .undecided
    barGestureStartTime = nil
    scrubDisplayTime = nil
  }

  private func springResetDrag() {
    verticalDrag = 0
    withAnimation(Bar.spring) {
      horizontalDrag = 0
    }
  }

  private func handlePresentPlayer() {
    playback.presentPlayer()
    springResetDrag()
  }

  private func wantsPresentPlayer(h: CGFloat, v: CGFloat) -> Bool {
    abs(h) <= abs(v) && v < -Bar.swipeThreshold
  }

  private func wantsSkipNext(h: CGFloat, v: CGFloat) -> Bool {
    abs(h) > abs(v) && h < -Bar.swipeThreshold && playback.hasNextInQueue
  }

  private func wantsSkipPrevious(h: CGFloat, v: CGFloat) -> Bool {
    abs(h) > abs(v) && h > Bar.swipeThreshold && playback.hasPreviousInQueue
  }

  private func tryCommitQuickSwipeToCarousel(h: CGFloat, v: CGFloat, elapsed: TimeInterval) -> Bool {
    guard elapsed < Bar.longPressSeconds,
      abs(h) > Bar.quickSwipeCommitSlop,
      abs(h) > abs(v)
    else { return false }
    barDragPhase = .carousel
    applyHorizontalCarouselDrag(h)
    return true
  }

  private func tryEnterSeekModeIfLongPressElapsed(value: DragGesture.Value, elapsed: TimeInterval)
    -> Bool
  {
    guard elapsed >= Bar.longPressSeconds, playback.duration > 0 else { return false }
    barDragPhase = .seeking
    seekPivotTranslationX = value.translation.width
    seekPivotTime = playback.currentTime
    lastScrubSeekAt = .distantPast
    applyScrubSeek(time: seekPivotTime)
    return true
  }

  private func updateSeekDrag(translation: CGFloat) {
    guard playback.duration > 0 else { return }
    let barW = max(carouselWidth, 1)
    let deltaX = translation - seekPivotTranslationX
    let t = seekPivotTime + Double(deltaX) / Double(barW) * playback.duration
    applyScrubSeek(time: t)
  }

  private func updateCarouselDrag(horizontal h: CGFloat, vertical v: CGFloat) {
    if abs(h) > abs(v) {
      applyHorizontalCarouselDrag(h)
    } else {
      horizontalDrag = 0
      verticalDrag = v
    }
  }

  private func applyHorizontalCarouselDrag(_ h: CGFloat) {
    verticalDrag = 0
    if h < 0 {
      horizontalDrag = playback.hasNextInQueue ? h : h * Bar.edgeRubberBand
    } else if h > 0 {
      horizontalDrag = playback.hasPreviousInQueue ? h : h * Bar.edgeRubberBand
    }
  }

  private func updateUndecidedDragPreview(horizontal h: CGFloat, vertical v: CGFloat) {
    if abs(v) >= abs(h) {
      horizontalDrag = 0
      verticalDrag = v
    } else {
      verticalDrag = 0
      horizontalDrag = 0
    }
  }

  private func runCarouselFinish(skipNext: Bool, barWidth: CGFloat) {
    isCarouselFinishing = true
    let endOffset: CGFloat = skipNext ? -barWidth : barWidth
    withAnimation(Bar.spring) {
      horizontalDrag = endOffset
    }
    Task { @MainActor in
      try? await Task.sleep(nanoseconds: Bar.carouselFinishDelayNs)
      if skipNext {
        await playback.skipToNext()
      } else {
        await playback.skipToPrevious()
      }
      withAnimation(nil) {
        horizontalDrag = 0
      }
      isCarouselFinishing = false
    }
  }
}

#Preview {
  PlayerBarView()
    .environment(MusicPlayerController.previewMockedController())
}
