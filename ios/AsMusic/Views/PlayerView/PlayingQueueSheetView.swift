//
//  PlayingQueueSheetView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import SwiftUI
import UIKit

/// Finds the enclosing list cell and hides the system reorder “grip” while edit mode stays active for drag-to-reorder.
private struct ListRowReorderGripHider: UIViewRepresentable {
  func makeUIView(context: Context) -> UIView {
    let v = UIView()
    v.isUserInteractionEnabled = false
    return v
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.scheduleHide(anchor: uiView)
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  final class Coordinator {
    func scheduleHide(anchor: UIView) {
      let hide = { [weak anchor] in
        guard let anchor else { return }
        hideReorderGrip(anchoredAt: anchor)
      }
      DispatchQueue.main.async(execute: hide)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.06, execute: hide)
    }
  }
}

private func hideReorderGrip(anchoredAt view: UIView) {
  var current: UIView? = view
  while let c = current {
    if let cell = c as? UITableViewCell {
      cell.showsReorderControl = false
      stripReorderDecorationImages(in: cell)
      return
    }
    if let cell = c as? UICollectionViewListCell {
      stripReorderDecorationImages(in: cell)
      return
    }
    current = c.superview
  }
}

private func stripReorderDecorationImages(in root: UIView) {
  let typeName = String(describing: type(of: root))
  if typeName.contains("Reorder") {
    for sub in root.subviews {
      if sub is UIImageView {
        sub.isHidden = true
      }
      stripReorderDecorationImages(in: sub)
    }
    return
  }
  for sub in root.subviews {
    stripReorderDecorationImages(in: sub)
  }
}

/// SwiftUI `ScrollViewProxy.scrollTo` on a very large `List` can be extremely slow; jump the underlying
/// `UITableView` / list `UICollectionView` directly with `animated: false` instead.
private struct PlayingQueueUIKitScrollAnchor: UIViewRepresentable {
  var targetRow: Int
  var expectedRowCount: Int
  var scrollGeneration: Int

  func makeUIView(context: Context) -> UIView {
    let v = UIView()
    v.isUserInteractionEnabled = false
    v.backgroundColor = .clear
    return v
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.scheduleScroll(
      anchor: uiView,
      targetRow: targetRow,
      expectedRowCount: expectedRowCount,
      requestID: scrollGeneration
    )
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  final class Coordinator {
    private var lastScrollSignature: (requestID: Int, row: Int)?
    private weak var cachedTable: UITableView?
    private weak var cachedCollection: UICollectionView?
    private var cachedExpectedRows: Int?

    func scheduleScroll(anchor: UIView, targetRow: Int, expectedRowCount: Int, requestID: Int) {
      guard targetRow >= 0, expectedRowCount > 0, targetRow < expectedRowCount else { return }
      let signature = (requestID: requestID, row: targetRow)
      if let last = lastScrollSignature, last.requestID == signature.requestID, last.row == signature.row {
        return
      }
      lastScrollSignature = signature

      let run = { [weak self] in
        guard let self else { return }
        if let table = self.resolveTable(anchor: anchor, expectedRowCount: expectedRowCount, targetRow: targetRow) {
          if let section = Self.bestTableSection(table: table, expectedRowCount: expectedRowCount) {
            let rows = table.numberOfRows(inSection: section)
            guard targetRow < rows else { return }
            table.scrollToRow(
              at: IndexPath(row: targetRow, section: section),
              at: .middle,
              animated: false
            )
          }
          return
        }
        if let collection = self.resolveCollection(anchor: anchor, expectedRowCount: expectedRowCount, targetRow: targetRow) {
          if let section = Self.bestCollectionSection(collection: collection, expectedRowCount: expectedRowCount) {
            let items = collection.numberOfItems(inSection: section)
            guard targetRow < items else { return }
            let indexPath = IndexPath(item: targetRow, section: section)
            collection.scrollToItem(at: indexPath, at: .centeredVertically, animated: false)
          }
        }
      }

      DispatchQueue.main.async(execute: run)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: run)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.28, execute: run)
    }

    private func resolveTable(anchor: UIView, expectedRowCount: Int, targetRow: Int) -> UITableView? {
      if let nearby = Self.nearestTableView(ascendingFrom: anchor) {
        let primary = Self.tablePrimaryRowCount(nearby)
        let tolerance = max(1, min(64, expectedRowCount / 128))
        if primary == 0 || abs(primary - expectedRowCount) <= tolerance {
          return nearby
        }
      }
      if let cached = cachedTable, cached.window != nil, cachedExpectedRows == expectedRowCount {
        if let section = Self.bestTableSection(table: cached, expectedRowCount: expectedRowCount) {
          let rows = cached.numberOfRows(inSection: section)
          if abs(rows - expectedRowCount) <= 1 { return cached }
        }
      }
      cachedTable = nil
      cachedExpectedRows = nil

      let window = Self.hostWindow(containing: anchor)
      guard let table = Self.findBestTable(in: window, expectedRowCount: expectedRowCount)
      else { return nil }
      cachedTable = table
      cachedExpectedRows = expectedRowCount
      return table
    }

    private func resolveCollection(anchor: UIView, expectedRowCount: Int, targetRow: Int) -> UICollectionView? {
      if let nearby = Self.nearestCollectionView(ascendingFrom: anchor) {
        let primary = Self.collectionPrimaryItemCount(nearby)
        let tolerance = max(1, min(64, expectedRowCount / 128))
        if primary == 0 || abs(primary - expectedRowCount) <= tolerance {
          return nearby
        }
      }
      if let cached = cachedCollection, cached.window != nil, cachedExpectedRows == expectedRowCount {
        if let section = Self.bestCollectionSection(collection: cached, expectedRowCount: expectedRowCount) {
          let items = cached.numberOfItems(inSection: section)
          if abs(items - expectedRowCount) <= 1 { return cached }
        }
      }
      cachedCollection = nil

      let window = Self.hostWindow(containing: anchor)
      guard let collection = Self.findBestCollection(in: window, expectedRowCount: expectedRowCount)
      else { return nil }
      cachedCollection = collection
      return collection
    }

    private static func hostWindow(containing view: UIView) -> UIWindow? {
      if let w = view.window { return w }
      var v: UIView? = view.superview
      while let cur = v {
        if let w = cur as? UIWindow { return w }
        v = cur.superview
      }
      return UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .filter { $0.activationState == .foregroundActive }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)
        ?? UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)
    }

    private static func nearestTableView(ascendingFrom view: UIView) -> UITableView? {
      var v: UIView? = view.superview
      while let cur = v {
        if let t = cur as? UITableView { return t }
        v = cur.superview
      }
      return nil
    }

    private static func nearestCollectionView(ascendingFrom view: UIView) -> UICollectionView? {
      var v: UIView? = view.superview
      while let cur = v {
        if let c = cur as? UICollectionView { return c }
        v = cur.superview
      }
      return nil
    }

    private static func bestTableSection(table: UITableView, expectedRowCount: Int) -> Int? {
      guard table.numberOfSections > 0 else { return nil }
      var bestSection = 0
      var bestScore = Int.max
      for s in 0..<table.numberOfSections {
        let rows = table.numberOfRows(inSection: s)
        let score = abs(rows - expectedRowCount)
        if score < bestScore {
          bestScore = score
          bestSection = s
        }
      }
      return bestSection
    }

    private static func bestCollectionSection(collection: UICollectionView, expectedRowCount: Int) -> Int? {
      guard collection.numberOfSections > 0 else { return nil }
      var bestSection = 0
      var bestScore = Int.max
      for s in 0..<collection.numberOfSections {
        let items = collection.numberOfItems(inSection: s)
        let score = abs(items - expectedRowCount)
        if score < bestScore {
          bestScore = score
          bestSection = s
        }
      }
      return bestSection
    }

    private static func tablePrimaryRowCount(_ table: UITableView) -> Int {
      guard table.numberOfSections > 0 else { return 0 }
      return (0..<table.numberOfSections).map { table.numberOfRows(inSection: $0) }.max() ?? 0
    }

    private static func collectionPrimaryItemCount(_ collection: UICollectionView) -> Int {
      guard collection.numberOfSections > 0 else { return 0 }
      return (0..<collection.numberOfSections).map { collection.numberOfItems(inSection: $0) }.max() ?? 0
    }

    private static func forEachHierarchyRoot(in window: UIWindow?, visit: (UIView) -> Void) {
      guard let root = window?.rootViewController else { return }
      func walk(_ vc: UIViewController) {
        if let v = vc.view { visit(v) }
        for child in vc.children {
          walk(child)
        }
        if let presented = vc.presentedViewController {
          walk(presented)
        }
      }
      walk(root)
    }

    private static func findBestTable(in window: UIWindow?, expectedRowCount: Int) -> UITableView? {
      var candidates: [UITableView] = []
      forEachHierarchyRoot(in: window) { root in
        collectTables(in: root, into: &candidates)
      }
      return candidates.min(by: { lhs, rhs in
        let dl = abs(tablePrimaryRowCount(lhs) - expectedRowCount)
        let dr = abs(tablePrimaryRowCount(rhs) - expectedRowCount)
        if dl != dr { return dl < dr }
        return tablePrimaryRowCount(lhs) > tablePrimaryRowCount(rhs)
      })
    }

    private static func findBestCollection(in window: UIWindow?, expectedRowCount: Int) -> UICollectionView? {
      var candidates: [UICollectionView] = []
      forEachHierarchyRoot(in: window) { root in
        collectCollections(in: root, into: &candidates)
      }
      return candidates.min(by: { lhs, rhs in
        let dl = abs(collectionPrimaryItemCount(lhs) - expectedRowCount)
        let dr = abs(collectionPrimaryItemCount(rhs) - expectedRowCount)
        if dl != dr { return dl < dr }
        return collectionPrimaryItemCount(lhs) > collectionPrimaryItemCount(rhs)
      })
    }

    private static func collectTables(in view: UIView, into out: inout [UITableView]) {
      if let table = view as? UITableView {
        out.append(table)
      }
      for sub in view.subviews {
        collectTables(in: sub, into: &out)
      }
    }

    private static func collectCollections(in view: UIView, into out: inout [UICollectionView]) {
      if let collection = view as? UICollectionView {
        out.append(collection)
      }
      for sub in view.subviews {
        collectCollections(in: sub, into: &out)
      }
    }
  }
}

struct PlayingQueueSheetView: View {
  @Environment(MusicPlayerController.self) private var playback
  @Environment(\.dismiss) private var dismiss
  /// Bumped on sheet open and shuffle so the UIKit scroller retries when the backing table reorders.
  @State private var queueScrollGeneration = 0
  @State private var editMode: EditMode = .inactive
  @State private var isConfirmingClearQueue = false

  private var reorderActivatedGesture: some Gesture {
    LongPressGesture(minimumDuration: 0.5)
      .onEnded { _ in
        guard editMode == .inactive else { return }
        withAnimation(.easeInOut(duration: 0.2)) {
          editMode = .active
        }
      }
  }

  var body: some View {
    NavigationStack {
      Group {
        if playback.nowPlayingQueue.isEmpty {
          ContentUnavailableView(
            "Queue Empty",
            systemImage: "music.note.list",
            description: Text("Play a song to build the queue.")
          )
        } else {
          let queueCount = playback.nowPlayingQueue.count
          List {
              // Range + index id avoids allocating `Array(enumerated())` (O(n) per refresh), which
              // was very slow for multi-thousand queues whenever `MusicPlayerController` invalidated the view.
              ForEach(0..<queueCount, id: \.self) { index in
                let meta = playback.metadataForQueueIndex(index)
                Button {
                  Task { await playback.jumpToQueueIndex(index) }
                } label: {
                  HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                      Text(meta?.title ?? "Unknown Title")
                        .foregroundStyle(.primary)
                      if let artist = meta?.artist, !artist.isEmpty {
                        Text(artist)
                          .font(.caption)
                          .foregroundStyle(.secondary)
                      }
                    }
                    Spacer(minLength: 8)
                    if playback.currentQueueIndex == index {
                      Image(systemName: "speaker.wave.2.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    Image(systemName: "line.3.horizontal")
                      .font(.caption.weight(.semibold))
                      .foregroundStyle(.tertiary)
                  }
                }
                .buttonStyle(.plain)
                .id(index)
                .background {
                  ListRowReorderGripHider()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .simultaneousGesture(reorderActivatedGesture)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                  Button {
                    playback.moveQueueItemToPlayNext(at: index)
                  } label: {
                    Label("Play Next", systemImage: "text.insert")
                  }
                  .tint(.orange)

                  Button {
                    playback.addQueueItemToEnd(from: index)
                  } label: {
                    Label("Add to Queue", systemImage: "text.line.last.and.arrowtriangle.forward")
                  }
                  .tint(.blue)

                  Button(role: .destructive) {
                    Task { await playback.removeQueueItem(at: index) }
                  } label: {
                    Label("Delete from Queue", systemImage: "trash.fill")
                  }
                }
              }
              .onMove { from, to in
                playback.moveQueue(fromOffsets: from, toOffset: to)
              }
            }
            .environment(\.editMode, $editMode)
            .background(alignment: .center) {
              PlayingQueueUIKitScrollAnchor(
                targetRow: playback.currentQueueIndex ?? -1,
                expectedRowCount: queueCount,
                scrollGeneration: queueScrollGeneration
              )
            }
            .onAppear { queueScrollGeneration &+= 1 }
        }
      }
      .navigationTitle("Now Playing")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          if editMode.isEditing {
            Button("Done") {
              editMode = .inactive
            }
          }
        }
        ToolbarItem(placement: .cancellationAction) {
          Button {
            dismiss()
          } label: {
            Label("Done", systemImage: "xmark")
          }
        }
        ToolbarItemGroup(placement: .status) {
          HStack {
            Button {
              playback.reshuffleQueuePreservingCurrentTrack()
              queueScrollGeneration &+= 1
            } label: {
              VStack {
                Label("Shuffle", systemImage: "shuffle")
                Text("Shuffle")
                  .font(.caption2)
              }
            }
            .disabled(playback.nowPlayingQueue.count <= 1)
            
            Button {
              playback.toggleLoopCurrentQueue()
            } label: {
              VStack {
                Label(
                  "Loop queue",
                  systemImage: "repeat")
                Text("Loop queue")
                  .font(.caption2)
              }
              .foregroundColor(playback.loopCurrentQueue ? .accentColor : .secondary)
            }
            
            Button {
              playback.toggleLoopCurrentSong()
            } label: {
              VStack {
                Label(
                  "Loop song",
                  systemImage: "repeat.1")
                Text("Loop song")
                  .font(.caption2)
              }
              .foregroundColor(playback.loopCurrentSong ? .accentColor : .secondary)
            }
          }
          .padding(.horizontal, 24)
        }
        ToolbarItemGroup(placement: .destructiveAction) {
          Button {
            isConfirmingClearQueue = true
          } label: {
            Label("Clear queue", systemImage: "trash")
          }
          .tint(.red)
          .disabled(playback.nowPlayingQueue.count <= 1)
        }
      }
      .confirmationDialog(
        "Clear queue?",
        isPresented: $isConfirmingClearQueue,
        titleVisibility: .visible
      ) {
        Button("Clear", role: .destructive) {
          playback.clearQueueExceptCurrent()
        }
        Button("Cancel", role: .cancel) {}
      } message: {
        Text("All tracks except the one now playing will be removed.")
      }
    }
  }
}

#Preview {
  PlayingQueueSheetView()
    .environment(MusicPlayerController.previewMockedController())
}
