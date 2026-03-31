//
//  LibrarySongListSupport.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

// MARK: - Albums / artists derived from cached songs

enum LibraryIndexFromSongs {
  static func albums(from songs: [Song]) -> [Album] {
    var buckets: [String: [Song]] = [:]
    for song in songs {
      let k = albumBucketKey(for: song)
      buckets[k, default: []].append(song)
    }

    let result = buckets.values.compactMap { group -> Album? in
      guard !group.isEmpty else { return nil }
      let sorted = group.sorted { ($0.track ?? Int.max) < ($1.track ?? Int.max) }
      let first = sorted[0]

      let id: String
      if let aid = first.albumId, !aid.isEmpty {
        id = aid
      } else {
        id = albumBucketKey(for: first)
      }

      let title = albumTitle(for: first)
      let artistLine = albumArtistLine(for: first)
      let totalDuration = sorted.reduce(0) { $0 + ($1.duration ?? 0) }
      let year = sorted.compactMap(\.year).min()

      let cover = sorted.compactMap(\.coverArt).first { !$0.isEmpty }

      return Album(
        id: id,
        name: title,
        artist: artistLine,
        artistId: first.albumArtists?.first?.id ?? first.artistId,
        coverArt: cover,
        songCount: sorted.count,
        duration: totalDuration > 0 ? totalDuration : nil,
        year: year
      )
    }

    return result.sorted {
      let a0 = $0.artist ?? ""
      let a1 = $1.artist ?? ""
      if a0.caseInsensitiveCompare(a1) != .orderedSame {
        return a0.localizedCaseInsensitiveCompare(a1) == .orderedAscending
      }
      return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }
  }

  /// Same artist identity as `artists(from:)` (server `artistId`, or `name:<lowercased display name>`).
  static func artistBucketId(for song: Song) -> String {
    if let id = song.artistId, !id.isEmpty {
      return id
    }
    return "name:\(primaryTrackArtistName(song).lowercased())"
  }

  /// All tracks credited to `artist`, sorted by album title then track number.
  static func songs(for artist: Artist, from allSongs: [Song]) -> [Song] {
    let filtered = allSongs.filter { artistBucketId(for: $0) == artist.id }
    return filtered.sorted { a, b in
      let albumA = albumTitle(for: a)
      let albumB = albumTitle(for: b)
      if albumA != albumB {
        return albumA.localizedCaseInsensitiveCompare(albumB) == .orderedAscending
      }
      return (a.track ?? Int.max) < (b.track ?? Int.max)
    }
  }

  /// Albums that contain at least one track by `artist`.
  static func albums(for artist: Artist, from allSongs: [Song]) -> [Album] {
    albums(from: songs(for: artist, from: allSongs))
  }

  /// Tracks on `album` credited to `artist` (excludes other artists on compilations).
  static func songs(in album: Album, for artist: Artist, from allSongs: [Song]) -> [Song] {
    songs(in: album, from: allSongs).filter { artistBucketId(for: $0) == artist.id }
  }

  /// Songs belonging to `album`, using the same grouping rules as `albums(from:)`.
  static func songs(in album: Album, from songs: [Song]) -> [Song] {
    var buckets: [String: [Song]] = [:]
    for song in songs {
      let k = albumBucketKey(for: song)
      buckets[k, default: []].append(song)
    }
    for group in buckets.values {
      guard !group.isEmpty else { continue }
      let sorted = group.sorted { ($0.track ?? Int.max) < ($1.track ?? Int.max) }
      let first = sorted[0]
      let id: String
      if let aid = first.albumId, !aid.isEmpty {
        id = aid
      } else {
        id = albumBucketKey(for: first)
      }
      if id == album.id {
        return sorted
      }
    }
    return []
  }

  static func artists(from songs: [Song]) -> [Artist] {
    enum Bucket: Hashable {
      case serverId(String)
      case nameKey(String)
    }

    var displayByBucket: [Bucket: String] = [:]
    var albumSets: [Bucket: Set<String>] = [:]

    for song in songs {
      let bucket: Bucket
      if let id = song.artistId, !id.isEmpty {
        bucket = .serverId(id)
      } else {
        let name = primaryTrackArtistName(song)
        bucket = .nameKey(name.lowercased())
      }

      if displayByBucket[bucket] == nil {
        displayByBucket[bucket] = primaryTrackArtistName(song)
      }
      albumSets[bucket, default: []].insert(albumBucketKey(for: song))
    }

    let list: [Artist] = displayByBucket.keys.map { bucket in
      let name = displayByBucket[bucket] ?? "Unknown Artist"
      let id: String
      switch bucket {
      case .serverId(let s):
        id = s
      case .nameKey(let k):
        id = "name:\(k)"
      }
      let albums = albumSets[bucket]?.count ?? 0
      return Artist(id: id, name: name, albumCount: albums > 0 ? albums : nil)
    }

    return list.sorted {
      $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }
  }

  private static func albumBucketKey(for song: Song) -> String {
    if let aid = song.albumId, !aid.isEmpty {
      return "album:\(aid)"
    }
    let title = albumTitle(for: song).lowercased()
    let artist = albumArtistLine(for: song).lowercased()
    return "album:\(title)|\(artist)"
  }

  private static func albumTitle(for song: Song) -> String {
    let raw = song.album?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return raw.isEmpty ? "Unknown Album" : raw
  }

  private static func albumArtistLine(for song: Song) -> String {
    if let d = song.displayAlbumArtist, !d.isEmpty { return d }
    if let first = song.albumArtists?.first?.name, !first.isEmpty { return first }
    if let d = song.displayArtist, !d.isEmpty { return d }
    if let a = song.artist, !a.isEmpty { return a }
    return "Unknown Artist"
  }

  static func primaryTrackArtistName(_ song: Song) -> String {
    if let d = song.displayArtist, !d.isEmpty { return d }
    if let a = song.artist, !a.isEmpty { return a }
    if let first = song.artists?.first?.name, !first.isEmpty { return first }
    return "Unknown Artist"
  }

  /// Credits line for lock screen / player when the raw `song.artist` field is empty.
  static func trackArtistCreditLine(for song: Song) -> String? {
    let n = primaryTrackArtistName(song)
    return n == "Unknown Artist" ? nil : n
  }
}

