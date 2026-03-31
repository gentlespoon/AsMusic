//
//  Playlist.swift
//  AsNavidromeKit
//

public struct PlaylistsListResponse: Codable, Equatable, Sendable {
  public let playlist: [PlaylistSummary]

  enum CodingKeys: String, CodingKey {
    case playlist
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    if let arr = try? c.decode([PlaylistSummary].self, forKey: .playlist) {
      playlist = arr
    } else if let one = try? c.decode(PlaylistSummary.self, forKey: .playlist) {
      playlist = [one]
    } else {
      playlist = []
    }
  }

  public func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(playlist, forKey: .playlist)
  }
}

public struct PlaylistSummary: Identifiable, Codable, Equatable, Hashable, Sendable {
  public let id: String
  public let name: String
  public let songCount: Int?
  public let duration: Int?
  public let owner: String?
}

/// Payload for Subsonic `getPlaylist` (includes track entries).
public struct PlaylistDetail: Codable, Equatable, Sendable {
  public let id: String
  public let name: String
  public let songCount: Int?
  public let duration: Int?
  public let owner: String?
  public let entry: [Song]?

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case songCount
    case duration
    case owner
    case entry
  }

  public init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    songCount = try c.decodeIfPresent(Int.self, forKey: .songCount)
    duration = try c.decodeIfPresent(Int.self, forKey: .duration)
    owner = try c.decodeIfPresent(String.self, forKey: .owner)

    if let songs = try? c.decode([Song].self, forKey: .entry) {
      entry = songs
    } else if let one = try? c.decode(Song.self, forKey: .entry) {
      entry = [one]
    } else {
      entry = nil
    }
  }

  public func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(name, forKey: .name)
    try c.encodeIfPresent(songCount, forKey: .songCount)
    try c.encodeIfPresent(duration, forKey: .duration)
    try c.encodeIfPresent(owner, forKey: .owner)
    try c.encodeIfPresent(entry, forKey: .entry)
  }
}
