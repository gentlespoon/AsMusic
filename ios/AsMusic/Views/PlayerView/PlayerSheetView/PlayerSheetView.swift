//
//  PlayerSheetView.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import SwiftUI

struct PlayerSheetView: View {
  @Environment(MusicPlayerController.self) private var playback
  @Environment(\.dismiss) private var dismiss
  @State private var selectedLibraryStore = SelectedLibraryStore.shared
  @State private var libraryClient: AsNavidromeClient?
  @State private var resolvedArtworkURL: URL?
  @State private var marqueeContentWidth: CGFloat = 0
  @State private var isStarActionInFlight = false
  @State private var isQueueSheetPresented = false
  @State private var sleepTimer = PlayerSleepTimerManager.shared
  @State private var isSleepTimerSheetPresented = false
  @State private var sleepTimerSelectionMinutes: Double = 15
  @State private var isPlaylistSheetPresented = false
  @State private var availablePlaylists: [PlaylistSummary] = []
  @State private var isMetadataAlertPresented = false
  @State private var userFacingErrorMessage: String?

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

  private var currentSongID: String? {
    playback.currentQueueItem?.id ?? playback.loadedSongID
  }

  private var metadataDetailsText: String {
    guard let meta = activeMetadata else { return "No metadata available." }
    let rows: [(String, String)] = [
      ("Title", meta.title),
      ("Artist", meta.artist ?? "Unknown"),
      ("Album", meta.album ?? "Unknown"),
      ("Song ID", currentSongID ?? "Unknown"),
      ("Format", meta.suffix?.uppercased() ?? "Unknown"),
      ("Bitrate", meta.bitRate.map { "\($0)" } ?? "Unknown"),
      ("Duration", meta.durationSeconds.map(formatTime) ?? "Unknown"),
      ("Artwork ID", meta.artworkID ?? "Unknown"),
    ]
    return rows.map { "\($0): \($1)" }.joined(separator: "\n")
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

            ArtworkView(artworkURL: resolvedArtworkURL)
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

              Button {
                isQueueSheetPresented = true
              } label: {
                Image(systemName: "list.bullet")
                  .font(.title2)
              }
              .disabled(playback.nowPlayingQueue.isEmpty)
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
        .padding(16)
        .toolbar {
          ToolbarItem(placement: .topBarLeading) {
            Button {
              dismiss()
            } label: {
              Image(systemName: "xmark")
            }
          }
          ToolbarItemGroup(placement: .topBarTrailing) {
            if sleepTimer.activeMinutes != nil {
              sleeperTimerButton
            }

            Menu {
              sleeperTimerButton
                .disabled(currentSongID == nil)

              Divider()

              Button {
                Task {
                  await loadPlaylistsForPicker()
                }
              } label: {
                Label("Add to Playlist", systemImage: "plus")
              }
              .disabled(currentSongID == nil)

              Divider()

              Button {
                isMetadataAlertPresented = true
              } label: {
                Label("Info", systemImage: "info.circle")
              }
              .disabled(activeMetadata == nil)
            } label: {
              Label("More actions", systemImage: "ellipsis")
            }
          }
        }
        .sheet(isPresented: $isSleepTimerSheetPresented) {
          PlayerSleepTimerSheetView(
            selectionMinutes: $sleepTimerSelectionMinutes,
            hasActiveTimer: sleepTimer.activeMinutes != nil,
            onCancel: {
              isSleepTimerSheetPresented = false
            },
            onTurnOff: {
              sleepTimer.cancel()
              isSleepTimerSheetPresented = false
            },
            onStart: { minutes in
              scheduleSleepTimer(minutes: minutes)
              isSleepTimerSheetPresented = false
            }
          )
        }
        .sheet(isPresented: $isPlaylistSheetPresented) {
          NavigationStack {
            List {
              if availablePlaylists.isEmpty {
                ContentUnavailableView(
                  "No Playlists Found",
                  systemImage: "music.note.list",
                  description: Text("Create a playlist first, then try again.")
                )
              } else {
                ForEach(availablePlaylists) { playlist in
                  Button(playlist.name) {
                    Task {
                      await addCurrentSong(to: playlist)
                    }
                  }
                  .foregroundStyle(.primary)
                }
              }
            }
            .navigationTitle("Add to Playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
              ToolbarItem(placement: .topBarTrailing) {
                Button("Done") {
                  isPlaylistSheetPresented = false
                }
              }
            }
          }
        }
        .alert("Track Metadata", isPresented: $isMetadataAlertPresented) {
          Button("OK", role: .cancel) {}
        } message: {
          Text(metadataDetailsText)
        }
        .alert("Unable to Complete Action", isPresented: userFacingErrorBinding) {
          Button("OK", role: .cancel) {
            userFacingErrorMessage = nil
          }
        } message: {
          Text(userFacingErrorMessage ?? "Unknown error.")
        }
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
      .sheet(isPresented: $isQueueSheetPresented) {
        PlayingQueueSheetView()
          .environment(playback)
      }
    } else {
      ContentUnavailableView(
        "Nothing Playing",
        systemImage: "music.note",
        description: Text("Choose a song to open the player.")
      )
    }
  }

  private var sleeperTimerButton: some View {
    Button {
      sleepTimerSelectionMinutes = Double(sleepTimer.activeMinutes ?? 15)
      isSleepTimerSheetPresented = true
    } label: {
      HStack {
        Image(systemName: sleepTimer.activeMinutes == nil ? "timer" : "timer.circle.fill")
        if let _ = sleepTimer.activeMinutes {
          if let countdown = sleepTimer.countdownLabel {
            Text(countdown)
              .font(.caption.monospacedDigit())
              .foregroundStyle(.secondary)
          }
        } else {
          Text("Sleep Timer")
        }
      }
    }
  }

  private func formatTime(_ seconds: Double) -> String {
    let m = Int(seconds) / 60
    let s = Int(seconds) % 60
    return String(format: "%d:%02d", m, s)
  }

  private var userFacingErrorBinding: Binding<Bool> {
    Binding(
      get: { userFacingErrorMessage != nil },
      set: { isPresented in
        if !isPresented {
          userFacingErrorMessage = nil
        }
      }
    )
  }

  private func scheduleSleepTimer(minutes: Int) {
    sleepTimer.start(minutes: minutes) {
      if playback.isPlaying {
        playback.togglePlayPause()
      }
    }
  }

  private func loadPlaylistsForPicker() async {
    guard let context = await resolvePlaylistCacheContext(environmentClient: libraryClient) else {
      userFacingErrorMessage = "Add a server in Settings to load playlists."
      return
    }

    availablePlaylists =
      await PlaylistSummaryCacheStore.shared.loadPlaylists(
        serverID: context.serverID,
        libraryID: context.libraryID
      ) ?? []
    isPlaylistSheetPresented = true
  }

  private func addCurrentSong(to playlist: PlaylistSummary) async {
    guard let songID = currentSongID else { return }
    guard let apiClient = await effectiveLibraryClient(libraryClient) else {
      userFacingErrorMessage = "Add a server in Settings to update playlists."
      return
    }
    do {
      try await apiClient.updatePlaylist(
        id: playlist.id, songIDsToAdd: [songID], songIndexesToRemove: [])
    } catch {
      userFacingErrorMessage = error.localizedDescription
    }
  }

  @MainActor
  private static func resolveLibraryClient() async -> AsNavidromeClient? {
    guard let selection = SelectedLibraryStore.shared.selection else { return nil }
    let servers = ServerManager().servers
    guard let server = servers.first(where: { $0.id == selection.serverID }) else { return nil }
    return await NavidromeClientStore.shared.client(for: server)
  }
}

private func effectiveLibraryClient(_ environmentClient: AsNavidromeClient?) async
  -> AsNavidromeClient?
{
  return environmentClient
}

private struct PlaylistCacheContext {
  let serverID: UUID
  let libraryID: String
}

private func resolvePlaylistCacheContext(environmentClient: AsNavidromeClient?) async
  -> PlaylistCacheContext?
{
  _ = environmentClient
  let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
    SelectedLibraryStore.shared.selection
  }
  if let selection {
    return PlaylistCacheContext(serverID: selection.serverID, libraryID: selection.folderID)
  }
  return nil
}

#Preview {
  PlayerSheetView()
    .environment(MusicPlayerController.previewMockedController())
}
