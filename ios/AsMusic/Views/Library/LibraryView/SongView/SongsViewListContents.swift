//
//  SongsViewListContents.swift
//  AsMusic
//

import AsNavidromeKit
import SwiftUI

struct SongsViewListContents<Row: View>: View {
  let resolvedAlbumArtworkURL: URL?
  let isLibraryMode: Bool
  let isLocalDownloadedMode: Bool
  let isDownloadingMode: Bool
  let isLoading: Bool
  let displaySongs: [Song]
  let errorMessage: String?
  let filteredSongs: [Song]
  @ViewBuilder let songRow: (Song) -> Row

  var body: some View {
    if let artworkURL = resolvedAlbumArtworkURL {
      HStack(alignment: .center) {
        Spacer()
        ArtworkView(artworkURL: artworkURL)
          .frame(maxHeight: 180)
          .aspectRatio(1, contentMode: .fit)
        Spacer()
      }
    }

    if (isLibraryMode || isLocalDownloadedMode || isDownloadingMode) && isLoading && displaySongs.isEmpty {
      ProgressView(loadingLabel)
    } else if isLibraryMode, let errorMessage {
      ContentUnavailableView(
        "Unable to Load Songs",
        systemImage: "exclamationmark.triangle",
        description: Text(errorMessage)
      )
    } else if displaySongs.isEmpty {
      ContentUnavailableView(
        emptyTitle,
        systemImage: emptySystemImage,
        description: Text(emptyDescription)
      )
    } else if filteredSongs.isEmpty {
      ContentUnavailableView(
        "No Results",
        systemImage: "magnifyingglass",
        description: Text("No songs match your search.")
      )
    } else {
      ForEach(filteredSongs) { song in
        songRow(song)
      }
    }
  }

  private var loadingLabel: String {
    if isLocalDownloadedMode {
      return "Checking downloads…"
    }
    if isDownloadingMode {
      return "Checking downloading songs…"
    }
    return "Loading songs..."
  }

  private var emptyTitle: String {
    isLocalDownloadedMode ? "No Downloaded Songs" : "No Songs"
  }

  private var emptySystemImage: String {
    if isLocalDownloadedMode {
      return "arrow.down.circle"
    }
    if isDownloadingMode {
      return "arrow.down.circle.dotted"
    }
    return "music.note.list"
  }

  private var emptyDescription: String {
    if isLocalDownloadedMode {
      return "Songs you play are saved under Documents. Open Songs and play a track, then pull to refresh here."
    }
    if isDownloadingMode {
      return "No songs are currently downloading."
    }
    if isLibraryMode {
      return "No songs found for this library."
    }
    return "No songs in this album."
  }
}
