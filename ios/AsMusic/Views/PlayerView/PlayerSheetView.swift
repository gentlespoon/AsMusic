//
//  PlayerSheetView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AVFoundation
import AsNavidromeKit
import MediaPlayer
import SwiftUI
import UIKit

struct PlayerSheetView: View {
  @Environment(MusicPlayerController.self) private var playback
  @State private var selectedLibraryStore = SelectedLibraryStore.shared
  @State private var libraryClient: AsNavidromeClient?
  @State private var resolvedArtworkURL: URL?
  @State private var marqueeContentWidth: CGFloat = 0
  @State private var isStarActionInFlight = false

  private var loadTaskID: String {
    "\(playback.currentSourceURL?.absoluteString ?? "")|\(playback.currentCacheRelativePath ?? "")"
  }

  private var isPlaying: Bool {
    playback.isPlaying
  }

  private var isReady: Bool {
    playback.isReady
  }

  /// Prefer the current queue row’s metadata (built from `Song` when enqueued); matches format/bitrate from the library.
  private var activeMetadata: PlaybackTrackMetadata? {
    if let idx = playback.currentQueueIndex, let resolved = playback.metadataForQueueIndex(idx) {
      return resolved
    }
    return playback.currentMetadata
  }

  private var librarySelectionKey: String {
    guard let s = selectedLibraryStore.selection else { return "" }
    return "\(s.serverID.uuidString)|\(s.folderID)"
  }

  private var artworkID: String? {
    let id = activeMetadata?.artworkID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return id.isEmpty ? nil : id
  }

  private var artworkRequestKey: String {
    "\(librarySelectionKey)|\(artworkID ?? "")"
  }

  private var artworkClientKey: String {
    guard let libraryClient else { return "" }
    return "\(libraryClient.host)|\(libraryClient.username)"
  }

  /// Center label under the scrubber: codec/container and nominal bitrate from library metadata.
  private var formatAndBitrateCaption: String? {
    guard let meta = activeMetadata else { return nil }
    let trimmed = meta.suffix?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let formatLabel = trimmed.isEmpty ? nil : trimmed.uppercased()
    let rateLabel = meta.bitRate.map { "\($0)" }
    switch (formatLabel, rateLabel) {
    case (nil, nil): return nil
    case (let f?, nil): return f
    case (nil, let r?): return r
    case (let f?, let r?): return "\(f) · \(r)"
    }
  }

  var body: some View {
    if let currentURL = playback.currentSourceURL {
      NavigationStack {
        VStack(spacing: 12) {
          if let loadError = playback.loadError {
            VStack(spacing: 12) {
              Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
              Text(loadError)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            }
            .padding()
          } else if playback.player == nil {
            VStack(spacing: 8) {
              ProgressView()
              Text(playback.isBuffering ? "Buffering…" : "Loading…")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
          } else {
            
            PlayerArtworkView(artworkURL: resolvedArtworkURL)
              .frame(maxWidth: .infinity)
              .aspectRatio(1, contentMode: .fit)
              .padding(16)

            if let meta = activeMetadata {
              VStack(spacing: 12) {
                MarqueeTextLine(
                  text: meta.title.isEmpty ? "Untitled" : meta.title,
                  lineStyle: .playerSheetTitle,
                  contentWidth: marqueeContentWidth
                )

                if let artistNav = meta.navigableArtist {
                  if libraryClient != nil {
                    NavigationLink(
                      value: PlayerLibraryRoute.artist(id: artistNav.id, name: artistNav.name)
                    ) {
                      MarqueeTextLine(
                        text: artistNav.name,
                        lineStyle: .playerSheetArtist,
                        contentWidth: marqueeContentWidth
                      )
                      .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                  } else {
                    MarqueeTextLine(
                      text: artistNav.name,
                      lineStyle: .playerSheetArtist,
                      contentWidth: marqueeContentWidth
                    )
                    .foregroundStyle(.secondary)
                  }
                }

                if let albumNav = meta.navigableAlbum {
                  if libraryClient != nil {
                    NavigationLink(
                      value: PlayerLibraryRoute.album(
                        id: albumNav.id, title: albumNav.title, artistLine: albumNav.artistLine)
                    ) {
                      MarqueeTextLine(
                        text: albumNav.title,
                        lineStyle: .playerSheetAlbum,
                        contentWidth: marqueeContentWidth
                      )
                    }
                    .buttonStyle(.plain)
                  } else {
                    MarqueeTextLine(
                      text: albumNav.title,
                      lineStyle: .playerSheetAlbum,
                      contentWidth: marqueeContentWidth
                    )
                  }
                }
              }
              .frame(maxWidth: .infinity)
              .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
              } action: { _, newWidth in
                if newWidth > 1 {
                  marqueeContentWidth = newWidth
                }
              }
              .padding(.horizontal, 24)
            }

            if playback.duration > 0 {
              VStack(spacing: 0) {
                Slider(
                  value: Binding(
                    get: { playback.currentTime },
                    set: { playback.seek(to: $0) }
                  ),
                  in: 0...playback.duration
                )
                .sliderThumbVisibility(.hidden)
                .padding(.horizontal, 16)
                .frame(maxHeight: 16)
                
                HStack {
                  Text(formatTime(playback.currentTime))
                  Spacer()
                  if let caption = formatAndBitrateCaption {
                    Text(caption)
                      .lineLimit(1)
                      .minimumScaleFactor(0.75)
                  }
                  Spacer()
                  Text(formatTime(playback.duration))
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
              }
            }

            HStack(spacing: 40) {
              Button {
                let target = !playback.currentTrackIsStarred
                isStarActionInFlight = true
                Task {
                  await playback.setCurrentTrackStarred(target)
                  await MainActor.run {
                    isStarActionInFlight = false
                  }
                }
              } label: {
                Image(systemName: playback.currentTrackIsStarred ? "star.fill" : "star")
                  .font(.title2)
              }
              .disabled(playback.currentQueueItem == nil || isStarActionInFlight)
              
              Button {
                Task { await playback.skipToPrevious() }
              } label: {
                Image(systemName: "backward.fill")
                  .font(.title2)
              }
              .disabled(!playback.hasPreviousInQueue)

              Button {
                playback.togglePlayPause()
              } label: {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                  .font(.title)
              }
              .disabled(!isReady)

              Button {
                Task { await playback.skipToNext() }
              } label: {
                Image(systemName: "forward.fill")
                  .font(.title2)
              }
              .disabled(!playback.hasNextInQueue)
            }
            .padding(.vertical, 24)
            .tint(.primary)

            HStack(spacing: 10) {
              Image(systemName: "speaker.fill")
                .font(.caption)
              SystemVolumeSlider()
                .frame(height: 24)
              Image(systemName: "speaker.wave.3.fill")
                .font(.caption)
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, 16)
            
            Spacer()
          }
        }
        .navigationTitle("Now Playing")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: PlayerLibraryRoute.self) { route in
          Group {
            if let client = libraryClient {
              switch route {
              case .artist(let id, let name):
                AlbumsView(artist: Artist(id: id, name: name))
                  .environment(\.libraryClient, client)
              case .album(let id, let title, let artistLine):
                PlayerCachedAlbumSongsView(
                  albumId: id, albumTitle: title, artistLine: artistLine, client: client)
              }
            } else {
              ContentUnavailableView(
                "Library Unavailable",
                systemImage: "music.note.house",
                description: Text("Choose a library in Settings.")
              )
            }
          }
        }
      }
      .task(id: loadTaskID) {
        let meta = activeMetadata
        await playback.load(
          url: currentURL,
          cacheRelativePath: playback.currentCacheRelativePath,
          metadata: meta
        )
      }
      .task(id: librarySelectionKey) {
        libraryClient = await Self.resolveLibraryClient()
      }
      .task(id: "\(artworkRequestKey)|\(artworkClientKey)") {
        guard let client = libraryClient, let artworkID else {
          resolvedArtworkURL = nil
          return
        }
        let remoteArtworkURL = client.media.coverArt(forID: artworkID, size: 600)
        resolvedArtworkURL = await ArtworkFileCache.displayURL(for: remoteArtworkURL)
      }
    } else {
      ContentUnavailableView(
        "Nothing Playing",
        systemImage: "music.note",
        description: Text("Choose a song to open the player.")
      )
    }
  }

  private func formatTime(_ seconds: Double) -> String {
    let m = Int(seconds) / 60
    let s = Int(seconds) % 60
    return String(format: "%d:%02d", m, s)
  }

  @MainActor
  private static func resolveLibraryClient() async -> AsNavidromeClient? {
    guard let selection = SelectedLibraryStore.shared.selection else { return nil }
    let servers = ServerManager().servers
    guard let server = servers.first(where: { $0.id == selection.serverID }) else { return nil }
    return await NavidromeClientStore.shared.client(for: server)
  }
}

private enum PlayerLibraryRoute: Hashable {
  case artist(id: String, name: String)
  case album(id: String, title: String, artistLine: String?)
}

extension PlaybackTrackMetadata {
  fileprivate var navigableArtist: (id: String, name: String)? {
    let name = artist?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !name.isEmpty else { return nil }
    if let bucket = libraryArtistBucketId?.trimmingCharacters(in: .whitespacesAndNewlines),
      !bucket.isEmpty
    {
      return (bucket, name)
    }
    if let id = artistId?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
      return (id, name)
    }
    return ("name:\(name.lowercased())", name)
  }

  fileprivate var navigableAlbum: (id: String, title: String, artistLine: String?)? {
    let title = album?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !title.isEmpty else { return nil }
    let id = albumId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return (id, title, artist)
  }
}

private struct PlayerCachedAlbumSongsView: View {
  let albumId: String
  let albumTitle: String
  let artistLine: String?
  let client: AsNavidromeClient

  @State private var songs: [Song] = []
  @State private var songClientsByID: [String: AsNavidromeClient] = [:]

  var body: some View {
    Group {
      if songs.isEmpty {
        ProgressView("Loading album…")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        SongsView(songs: songs, navigationTitle: albumTitle, songClientsByID: songClientsByID)
      }
    }
    .environment(\.libraryClient, client)
    .task {
      await loadSongs()
    }
  }

  private func loadSongs() async {
    let cacheKey = LibrarySongCacheKey.current(for: client)
    guard let cached = await SongCacheStore.shared.loadSongs(for: cacheKey), !cached.isEmpty else {
      songs = []
      return
    }

    let derived = LibraryIndexFromSongs.albums(from: cached)
    let album: Album
    if !albumId.isEmpty, let match = derived.first(where: { $0.id == albumId }) {
      album = match
    } else if let match = derived.first(where: {
      $0.name.caseInsensitiveCompare(albumTitle) == .orderedSame
    }) {
      album = match
    } else {
      album = Album(
        id: albumId.isEmpty ? "player:\(albumTitle.lowercased())" : albumId, name: albumTitle,
        artist: artistLine)
    }

    let list = LibraryIndexFromSongs.songs(in: album, from: cached)
    songs = list
    songClientsByID = Dictionary(uniqueKeysWithValues: list.map { ($0.id, client) })
  }
}

private struct SystemVolumeSlider: UIViewRepresentable {
  func makeUIView(context: Context) -> MPVolumeView {
    let v = MPVolumeView(frame: .zero)
    configure(v)
    return v
  }

  func updateUIView(_ uiView: MPVolumeView, context: Context) {
    configure(uiView)
  }

  private func configure(_ volumeView: MPVolumeView) {
    hideRouteButton(in: volumeView)
    hideVolumeSliderThumb(in: volumeView)
  }

  private func hideRouteButton(in volumeView: MPVolumeView) {
    for subview in volumeView.subviews {
      guard let button = subview as? UIButton else { continue }
      let className = NSStringFromClass(type(of: button))
      if className.contains("RouteButton") {
        button.isHidden = true
        button.isUserInteractionEnabled = false
      }
    }
  }

  private func hideVolumeSliderThumb(in root: UIView) {
    if let slider = root as? UISlider {
      let clear = UIImage()
      slider.setThumbImage(clear, for: .normal)
      slider.setThumbImage(clear, for: .highlighted)
      slider.setThumbImage(clear, for: .selected)
      slider.setThumbImage(clear, for: .disabled)
    }
    for sub in root.subviews {
      hideVolumeSliderThumb(in: sub)
    }
  }
}

#Preview {
  PlayerSheetView()
    .environment(MusicPlayerController.previewMockedController())
}
