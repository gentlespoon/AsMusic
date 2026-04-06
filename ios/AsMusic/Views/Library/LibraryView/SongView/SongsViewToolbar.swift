//
//  SongsViewToolbar.swift
//  AsMusic
//

import SwiftUI

struct SongsViewToolbar: ToolbarContent {
  let playableQueueIsEmpty: Bool
  let canDownloadVisibleSongs: Bool
  let onPlayInOrder: () -> Void
  let onPlayShuffled: () -> Void
  let onDownloadAll: () async -> Void
  let onPlayAllNext: () -> Void
  let onAddAllToQueue: () -> Void

  var body: some ToolbarContent {
    ToolbarItemGroup(placement: .topBarTrailing) {
      Button {
        onPlayInOrder()
      } label: {
        Label("Play in order", systemImage: "play.circle")
      }
      .disabled(playableQueueIsEmpty)

      Button {
        onPlayShuffled()
      } label: {
        Label("Play shuffled", systemImage: "shuffle")
      }
      .disabled(playableQueueIsEmpty)

      Menu {
        Button {
          Task {
            await onDownloadAll()
          }
        } label: {
          Label("Download all songs", systemImage: "arrow.down.circle")
        }
        .disabled(!canDownloadVisibleSongs)

        Divider()

        Button {
          onPlayAllNext()
        } label: {
          Label("Play all next", systemImage: "text.insert")
        }
        .disabled(playableQueueIsEmpty)

        Button {
          onAddAllToQueue()
        } label: {
          Label("Add all to queue", systemImage: "text.line.last.and.arrowtriangle.forward")
        }
        .disabled(playableQueueIsEmpty)
      } label: {
        Label("More actions", systemImage: "ellipsis.circle")
      }
    }
  }
}
