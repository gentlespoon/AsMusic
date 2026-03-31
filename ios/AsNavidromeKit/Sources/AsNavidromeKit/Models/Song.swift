//
//  Song.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-27.
//

public struct SearchResult3Response: Codable, Equatable, Sendable {
  public let song: [Song]?
}

public struct Song: Identifiable, Codable, Equatable, Sendable {
  public let id: String
  public let parent: String?
  public let isDir: Bool?
  public let title: String
  public let album: String?
  public let artist: String?
  public let track: Int?
  public let year: Int?
  public let coverArt: String?
  public let size: Int64?
  public let contentType: String?
  public let suffix: String?
  public let duration: Int?
  public let bitRate: Int?
  public let path: String?
  public let created: String?
  public let albumId: String?
  public let artistId: String?
  public let type: String?
  public let bpm: Int?
  public let comment: String?
  public let sortName: String?
  public let mediaType: String?
  public let musicBrainzId: String?
  public let isrc: [String]?
  public let genres: [String]?
  public let replayGain: ReplayGain?
  public let channelCount: Int?
  public let samplingRate: Int?
  public let bitDepth: Int?
  public let moods: [String]?
  public let artists: [AlbumArtistRef]?
  public let displayArtist: String?
  public let albumArtists: [AlbumArtistRef]?
  public let displayAlbumArtist: String?
  public let contributors: [Contributor]?
  public let displayComposer: String?
  public let explicitStatus: String?
  public let starred: String?

  enum CodingKeys: String, CodingKey {
    case id
    case parent
    case isDir
    case title
    case album
    case artist
    case track
    case year
    case coverArt
    case size
    case contentType
    case suffix
    case duration
    case bitRate
    case path
    case created
    case albumId
    case artistId
    case type
    case bpm
    case comment
    case sortName
    case mediaType
    case musicBrainzId
    case isrc
    case genres
    case replayGain
    case channelCount
    case samplingRate
    case bitDepth
    case moods
    case artists
    case displayArtist
    case albumArtists = "albumartists"
    case displayAlbumArtist
    case contributors
    case displayComposer
    case explicitStatus
    case starred
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    id = try container.decode(String.self, forKey: .id)
    parent = try container.decodeIfPresent(String.self, forKey: .parent)
    isDir = try container.decodeIfPresent(Bool.self, forKey: .isDir)
    title = try container.decode(String.self, forKey: .title)
    album = try container.decodeIfPresent(String.self, forKey: .album)
    artist = try container.decodeIfPresent(String.self, forKey: .artist)
    track = try container.decodeIfPresent(Int.self, forKey: .track)
    year = try container.decodeIfPresent(Int.self, forKey: .year)
    coverArt = try container.decodeIfPresent(String.self, forKey: .coverArt)
    size = try container.decodeIfPresent(Int64.self, forKey: .size)
    contentType = try container.decodeIfPresent(String.self, forKey: .contentType)
    suffix = try container.decodeIfPresent(String.self, forKey: .suffix)
    duration = try container.decodeIfPresent(Int.self, forKey: .duration)
    bitRate = try container.decodeIfPresent(Int.self, forKey: .bitRate)
    path = try container.decodeIfPresent(String.self, forKey: .path)
    created = try container.decodeIfPresent(String.self, forKey: .created)
    albumId = try container.decodeIfPresent(String.self, forKey: .albumId)
    artistId = try container.decodeIfPresent(String.self, forKey: .artistId)
    type = try container.decodeIfPresent(String.self, forKey: .type)
    bpm = try container.decodeIfPresent(Int.self, forKey: .bpm)
    comment = try container.decodeIfPresent(String.self, forKey: .comment)
    sortName = try container.decodeIfPresent(String.self, forKey: .sortName)
    mediaType = try container.decodeIfPresent(String.self, forKey: .mediaType)
    musicBrainzId = try container.decodeIfPresent(String.self, forKey: .musicBrainzId)
    isrc = try container.decodeIfPresent([String].self, forKey: .isrc)
    replayGain = try container.decodeIfPresent(ReplayGain.self, forKey: .replayGain)
    channelCount = try container.decodeIfPresent(Int.self, forKey: .channelCount)
    samplingRate = try container.decodeIfPresent(Int.self, forKey: .samplingRate)
    bitDepth = try container.decodeIfPresent(Int.self, forKey: .bitDepth)
    moods = try container.decodeIfPresent([String].self, forKey: .moods)
    artists = try container.decodeIfPresent([AlbumArtistRef].self, forKey: .artists)
    displayArtist = try container.decodeIfPresent(String.self, forKey: .displayArtist)
    albumArtists = try container.decodeIfPresent([AlbumArtistRef].self, forKey: .albumArtists)
    displayAlbumArtist = try container.decodeIfPresent(String.self, forKey: .displayAlbumArtist)
    contributors = try container.decodeIfPresent([Contributor].self, forKey: .contributors)
    displayComposer = try container.decodeIfPresent(String.self, forKey: .displayComposer)
    explicitStatus = try container.decodeIfPresent(String.self, forKey: .explicitStatus)
    starred = try container.decodeIfPresent(String.self, forKey: .starred)

    if let genreNames = try? container.decode([String].self, forKey: .genres) {
      genres = genreNames
    } else if let genreObjects = try? container.decode([GenreName].self, forKey: .genres) {
      genres = genreObjects.map(\.name)
    } else {
      genres = nil
    }
  }
}

private struct GenreName: Codable, Equatable, Sendable {
  let name: String
}

public struct ReplayGain: Codable, Equatable, Sendable {
  public let trackGain: Double?
  public let trackPeak: Double?
  public let albumGain: Double?
  public let albumPeak: Double?
  public let baseGain: Double?
}

public struct Contributor: Codable, Equatable, Sendable {
  public let id: String?
  public let name: String?
  public let role: String?
}
