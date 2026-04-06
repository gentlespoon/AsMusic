//
//  SongsListRowView.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct SongsListRowView: View {
  let song: Song
  let showsDownloadProgressBar: Bool
  let downloadProgress: Double?
  let canQueue: Bool
  let isDownloadingMode: Bool
  let isLocalDownloadedMode: Bool
  let onPlay: () -> Void
  let onRemoveFromDownloading: () async -> Void
  let onPlayNext: () -> Void
  let onAddToQueue: () -> Void
  let onRequestDeleteDownload: () -> Void

  var body: some View {
    Group {
      if canQueue {
        Button {
          onPlay()
        } label: {
          SongRowContentView(
            song: song,
            showsDownloadProgressBar: showsDownloadProgressBar,
            downloadProgress: downloadProgress
          )
        }
      } else {
        SongRowContentView(
          song: song,
          showsDownloadProgressBar: showsDownloadProgressBar,
          downloadProgress: downloadProgress
        )
      }
    }
    .buttonStyle(.plain)
    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
      if isDownloadingMode {
        Button(role: .destructive) {
          Task {
            await onRemoveFromDownloading()
          }
        } label: {
          Label("Remove from Downloading", systemImage: "xmark.circle")
        }
      } else {
        Button {
          guard canQueue else { return }
          onPlayNext()
        } label: {
          Label("Play Next", systemImage: "text.insert")
        }
        .tint(.orange)
        .disabled(!canQueue)

        Button {
          guard canQueue else { return }
          onAddToQueue()
        } label: {
          Label("Add to Queue", systemImage: "text.line.last.and.arrowtriangle.forward")
        }
        .tint(.blue)
        .disabled(!canQueue)

        if isLocalDownloadedMode {
          Button(role: .destructive) {
            onRequestDeleteDownload()
          } label: {
            Label("Delete Download", systemImage: "trash")
          }
        }
      }
    }
  }
}
