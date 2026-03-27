//
//  NowPlayingQueueSheetView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import SwiftUI

struct NowPlayingQueueSheetView: View {
  @Environment(MusicPlayerController.self) private var playback
  @Environment(\.dismiss) private var dismiss
  @State private var queueScrollToCurrentTick = 0

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
                index, item in
                Button {
                  Task { await playback.jumpToQueueIndex(index) }
                } label: {
                  HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                      Text(item.metadata.title)
                        .foregroundStyle(.primary)
                      if let artist = item.metadata.artist, !artist.isEmpty {
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
                  }
                }
                .buttonStyle(.plain)
                .id(index)
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                  Button(role: .destructive) {
                    Task { await playback.removeQueueItem(at: index) }
                  } label: {
                    Label("Remove", systemImage: "trash.fill")
                  }
                }
              }
              .onMove { from, to in
                playback.moveQueue(fromOffsets: from, toOffset: to)
              }
            }
            .environment(\.editMode, .constant(.active))
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
        ToolbarItem(placement: .cancellationAction) {
          Button {
            dismiss()
          } label: {
            Label("Done", systemImage: "xmark")
          }
        }
        ToolbarItemGroup(placement: .status) {
          Button {
            playback.reshuffleQueuePreservingCurrentTrack()
            queueScrollToCurrentTick &+= 1
          } label: {
            HStack {
              Label("Shuffle", systemImage: "shuffle")
              Text("Shuffle")
            }
          }
          .disabled(playback.nowPlayingQueue.count <= 1)
        }
        ToolbarItemGroup(placement: .destructiveAction) {
          Button {
            playback.clearQueueExceptCurrent()
          } label: {
            Label("Clear queue", systemImage: "trash")
          }
          .tint(.red)
          .disabled(playback.nowPlayingQueue.count <= 1)
        }
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
  NowPlayingQueueSheetView()
    .environment(MusicPlayerController())
}
