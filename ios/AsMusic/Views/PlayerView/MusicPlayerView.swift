//
//  MusicPlayerView.swift
//  AsMusic
//
//  Created by An So on 2026-03-14.
//

import AsNavidromeKit
import AVFoundation
import MediaPlayer
import SwiftUI

struct MusicPlayerView: View {
  @Environment(MusicPlayerController.self) private var playback
  @State private var selectedLibraryStore = SelectedLibraryStore.shared
  @State private var libraryClient: AsNavidromeClient?

  /// URL of the audio to play (local file or remote stream). Fully cached tracks use the local file.
  let url: URL
  /// Optional server-side relative song path for directory-preserving local cache.
  let cacheRelativePath: String?
  /// Shown in Control Center / Lock Screen.
  let metadata: PlaybackTrackMetadata?

  init(
    url: URL,
    cacheRelativePath: String?,
    metadata: PlaybackTrackMetadata? = nil
  ) {
    self.url = url
    self.cacheRelativePath = cacheRelativePath
    self.metadata = metadata
  }

  private var loadTaskID: String {
    "\(url.absoluteString)|\(cacheRelativePath ?? "")"
  }

  private var isPlaying: Bool {
    playback.isPlaying
  }

  private var isReady: Bool {
    playback.isReady
  }

  /// Prefer live controller metadata so the UI tracks skip/queue changes.
  private var activeMetadata: PlaybackTrackMetadata? {
    playback.currentMetadata ?? metadata
  }

  private var librarySelectionKey: String {
    guard let s = selectedLibraryStore.selection else { return "" }
    return "\(s.serverID.uuidString)|\(s.folderID)"
  }

  var body: some View {
    VStack(spacing: 24) {
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
        // Artwork placeholder
        RoundedRectangle(cornerRadius: 12)
          .fill(.ultraThinMaterial)
          .frame(width: 200, height: 200)
          .overlay {
            Image(systemName: "music.note")
              .font(.system(size: 64))
              .foregroundStyle(.secondary)
          }

        if let meta = activeMetadata {
          VStack(spacing: 6) {
            if let artistNav = meta.navigableArtist {
              if let client = libraryClient {
                NavigationLink(value: PlayerLibraryRoute.artist(id: artistNav.id, name: artistNav.name)) {
                  Text(artistNav.name)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                }
                .buttonStyle(.plain)
              } else {
                Text(artistNav.name)
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
                  .multilineTextAlignment(.center)
              }
            }

            if let albumNav = meta.navigableAlbum {
              if let client = libraryClient {
                NavigationLink(
                  value: PlayerLibraryRoute.album(id: albumNav.id, title: albumNav.title, artistLine: albumNav.artistLine)
                ) {
                  Text(albumNav.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
                }
                .buttonStyle(.plain)
              } else {
                Text(albumNav.title)
                  .font(.subheadline)
                  .fontWeight(.medium)
                  .foregroundStyle(.primary)
                  .multilineTextAlignment(.center)
              }
            }
          }
          .frame(maxWidth: .infinity)
          .padding(.horizontal, 24)
        }

        // Playback progress (use periodic time observer; Observation isn't for continuous time)
        if playback.duration > 0 {
          Slider(
            value: Binding(
              get: { playback.currentTime },
              set: { playback.seek(to: $0) }
            ),
            in: 0...playback.duration
          )
          .padding(.horizontal, 32)

          HStack {
            Text(formatTime(playback.currentTime))
            Spacer()
            Text(formatTime(playback.duration))
          }
          .font(.caption.monospacedDigit())
          .foregroundStyle(.secondary)
          .padding(.horizontal, 32)
        }

        HStack(spacing: 40) {
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
            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
              .font(.system(size: 64))
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

        HStack(spacing: 10) {
          Image(systemName: "speaker.fill")
            .font(.caption)
            .foregroundStyle(.secondary)
          SystemVolumeSlider()
            .frame(height: 24)
          Image(systemName: "speaker.wave.3.fill")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 28)
      }
    }
    .padding()
    .navigationDestination(for: PlayerLibraryRoute.self) { route in
      Group {
        if let client = libraryClient {
          switch route {
          case .artist(let id, let name):
            AlbumsView(artist: Artist(id: id, name: name))
              .environment(\.libraryClient, client)
          case .album(let id, let title, let artistLine):
            PlayerCachedAlbumSongsView(albumId: id, albumTitle: title, artistLine: artistLine, client: client)
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
    .task(id: loadTaskID) {
      await playback.load(
        url: url,
        cacheRelativePath: cacheRelativePath,
        metadata: metadata
      )
    }
    .task(id: librarySelectionKey) {
      libraryClient = await Self.resolveLibraryClient()
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

// MARK: - Library navigation from metadata

private enum PlayerLibraryRoute: Hashable {
  case artist(id: String, name: String)
  case album(id: String, title: String, artistLine: String?)
}

private extension PlaybackTrackMetadata {
  /// Artist row when we at least have a display name; `id` matches `LibraryIndexFromSongs` bucketing.
  var navigableArtist: (id: String, name: String)? {
    let name = artist?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !name.isEmpty else { return nil }
    if let bucket = libraryArtistBucketId?.trimmingCharacters(in: .whitespacesAndNewlines), !bucket.isEmpty {
      return (bucket, name)
    }
    if let id = artistId?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
      return (id, name)
    }
    return ("name:\(name.lowercased())", name)
  }

  var navigableAlbum: (id: String, title: String, artistLine: String?)? {
    let title = album?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !title.isEmpty else { return nil }
    let id = albumId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return (id, title, artist)
  }
}

// MARK: - Album drill-down using cached library songs

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
    } else if let match = derived.first(where: { $0.name.caseInsensitiveCompare(albumTitle) == .orderedSame }) {
      album = match
    } else {
      album = Album(id: albumId.isEmpty ? "player:\(albumTitle.lowercased())" : albumId, name: albumTitle, artist: artistLine)
    }

    let list = LibraryIndexFromSongs.songs(in: album, from: cached)
    songs = list
    songClientsByID = Dictionary(uniqueKeysWithValues: list.map { ($0.id, client) })
  }
}

// MARK: - System volume (MPVolumeView)

private struct SystemVolumeSlider: UIViewRepresentable {
  func makeUIView(context: Context) -> MPVolumeView {
    let v = MPVolumeView(frame: .zero)
    v.showsRouteButton = false
    return v
  }

  func updateUIView(_ uiView: MPVolumeView, context: Context) {}
}

#Preview {
  MusicPlayerView(
    url: URL(string: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3")!,
    cacheRelativePath: nil,
    metadata: PlaybackTrackMetadata(
      title: "Preview",
      artist: "SoundHelix",
      album: "Demo",
      durationSeconds: nil,
      artistId: nil,
      albumId: nil,
      libraryArtistBucketId: nil
    )
  )
  .environment(MusicPlayerController())
}
