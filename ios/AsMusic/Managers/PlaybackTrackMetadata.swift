//
//  PlaybackTrackMetadata.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import Foundation

/// Metadata shown in Control Center / Lock Screen.
struct PlaybackTrackMetadata: Equatable, Sendable, Codable {
  var title: String
  var artist: String?
  var album: String?
  /// Subsonic cover-art id (used to render artwork in player UI).
  var artworkID: String?
  /// Known duration in seconds (e.g. from Subsonic); used until the file reports duration.
  var durationSeconds: Double?
  /// Subsonic artist id when known (library navigation).
  var artistId: String?
  /// Subsonic album id when known (library navigation).
  var albumId: String?
  /// Matches `LibraryIndexFromSongs.artistBucketId(for:)` so artist drill-down finds the same rows as the library.
  var libraryArtistBucketId: String?
  /// File extension / container from Subsonic (e.g. `mp3`, `flac`).
  var suffix: String?
  /// Nominal bitrate in kilobits per second when known.
  var bitRate: Int?
  /// Mirrors Subsonic star state for the active track.
  var isStarred: Bool?

  init(
    title: String,
    artist: String? = nil,
    album: String? = nil,
    artworkID: String? = nil,
    durationSeconds: Double? = nil,
    artistId: String? = nil,
    albumId: String? = nil,
    libraryArtistBucketId: String? = nil,
    suffix: String? = nil,
    bitRate: Int? = nil,
    isStarred: Bool? = nil
  ) {
    self.title = title
    self.artist = artist
    self.album = album
    self.artworkID = artworkID
    self.durationSeconds = durationSeconds
    self.artistId = artistId
    self.albumId = albumId
    self.libraryArtistBucketId = libraryArtistBucketId
    self.suffix = suffix
    self.bitRate = bitRate
    self.isStarred = isStarred
  }
}

extension PlaybackTrackMetadata {
  var navigableArtist: (id: String, name: String)? {
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

  var navigableAlbum: (id: String, title: String, artistLine: String?)? {
    let title = album?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !title.isEmpty else { return nil }
    let id = albumId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return (id, title, artist)
  }
}
