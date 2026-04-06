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

struct PlayingQueueSheetView: View {
  @Environment(MusicPlayerController.self) private var playback
  @Environment(\.dismiss) private var dismiss
  @State private var queueScrollToCurrentTick = 0
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
          ScrollViewReader { proxy in
            List {
              ForEach(Array(playback.nowPlayingQueue.enumerated()), id: \.element.rowId) {
                index, _ in
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
            .onAppear {
              scrollQueueToCurrentItem(proxy: proxy)
            }
            .onChange(of: queueScrollToCurrentTick) { _, _ in
              scrollQueueToCurrentItem(proxy: proxy)
            }
          }
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
              queueScrollToCurrentTick &+= 1
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

  private func scrollQueueToCurrentItem(proxy: ScrollViewProxy) {
    guard let index = playback.currentQueueIndex else { return }
    Task { @MainActor in
      try? await Task.sleep(nanoseconds: 120_000_000)
      withAnimation(.easeInOut(duration: 0.28)) {
        proxy.scrollTo(index, anchor: .center)
      }
    }
  }
}

#Preview {
  PlayingQueueSheetView()
    .environment(MusicPlayerController.previewMockedController())
}
