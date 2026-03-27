//
//  Album.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-27.
//

public struct AlbumList2Response: Codable, Equatable, Sendable {
  public let album: [Album]
}

public struct Album: Identifiable, Codable, Equatable, Sendable {
  public let id: String
  public let name: String
  public let artist: String?
  public let artistId: String?
  public let coverArt: String?
  public let songCount: Int?
  public let duration: Int?
  public let playCount: Int?
  public let created: String?
  public let year: Int?
  public let played: String?
  public let userRating: Int?
  public let genres: [String]?
  public let musicBrainzId: String?
  public let isCompilation: Bool?
  public let sortName: String?
  public let discTitles: [String]?
  public let originalReleaseDate: PartialDate?
  public let releaseDate: PartialDate?
  public let releaseTypes: [String]?
  public let recordLabels: [RecordLabel]?
  public let moods: [String]?
  public let artists: [AlbumArtistRef]?
  public let displayArtist: String?
  public let explicitStatus: String?
  public let version: String?

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case artist
    case artistId
    case coverArt
    case songCount
    case duration
    case playCount
    case created
    case year
    case played
    case userRating
    case genres
    case musicBrainzId
    case isCompilation
    case sortName
    case discTitles
    case originalReleaseDate
    case releaseDate
    case releaseTypes
    case recordLabels
    case moods
    case artists
    case displayArtist
    case explicitStatus
    case version
  }

  /// Builds a row from API fields or from a derived/synthetic source (e.g. grouped songs).
  public init(
    id: String,
    name: String,
    artist: String? = nil,
    artistId: String? = nil,
    coverArt: String? = nil,
    songCount: Int? = nil,
    duration: Int? = nil,
    playCount: Int? = nil,
    created: String? = nil,
    year: Int? = nil,
    played: String? = nil,
    userRating: Int? = nil,
    genres: [String]? = nil,
    musicBrainzId: String? = nil,
    isCompilation: Bool? = nil,
    sortName: String? = nil,
    discTitles: [String]? = nil,
    originalReleaseDate: PartialDate? = nil,
    releaseDate: PartialDate? = nil,
    releaseTypes: [String]? = nil,
    recordLabels: [RecordLabel]? = nil,
    moods: [String]? = nil,
    artists: [AlbumArtistRef]? = nil,
    displayArtist: String? = nil,
    explicitStatus: String? = nil,
    version: String? = nil
  ) {
    self.id = id
    self.name = name
    self.artist = artist
    self.artistId = artistId
    self.coverArt = coverArt
    self.songCount = songCount
    self.duration = duration
    self.playCount = playCount
    self.created = created
    self.year = year
    self.played = played
    self.userRating = userRating
    self.genres = genres
    self.musicBrainzId = musicBrainzId
    self.isCompilation = isCompilation
    self.sortName = sortName
    self.discTitles = discTitles
    self.originalReleaseDate = originalReleaseDate
    self.releaseDate = releaseDate
    self.releaseTypes = releaseTypes
    self.recordLabels = recordLabels
    self.moods = moods
    self.artists = artists
    self.displayArtist = displayArtist
    self.explicitStatus = explicitStatus
    self.version = version
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    name = try container.decode(String.self, forKey: .name)
    artist = try container.decodeIfPresent(String.self, forKey: .artist)
    artistId = try container.decodeIfPresent(String.self, forKey: .artistId)
    coverArt = try container.decodeIfPresent(String.self, forKey: .coverArt)
    songCount = try container.decodeIfPresent(Int.self, forKey: .songCount)
    duration = try container.decodeIfPresent(Int.self, forKey: .duration)
    playCount = try container.decodeIfPresent(Int.self, forKey: .playCount)
    created = try container.decodeIfPresent(String.self, forKey: .created)
    year = try container.decodeIfPresent(Int.self, forKey: .year)
    played = try container.decodeIfPresent(String.self, forKey: .played)
    userRating = try container.decodeIfPresent(Int.self, forKey: .userRating)
    musicBrainzId = try container.decodeIfPresent(String.self, forKey: .musicBrainzId)
    isCompilation = try container.decodeIfPresent(Bool.self, forKey: .isCompilation)
    sortName = try container.decodeIfPresent(String.self, forKey: .sortName)
    if let titles = try? container.decode([String].self, forKey: .discTitles) {
      discTitles = titles
    } else if let titleObjects = try? container.decode([DiscTitleValue].self, forKey: .discTitles) {
      discTitles = titleObjects.map(\.title)
    } else {
      discTitles = nil
    }
    originalReleaseDate = try container.decodeIfPresent(PartialDate.self, forKey: .originalReleaseDate)
    releaseDate = try container.decodeIfPresent(PartialDate.self, forKey: .releaseDate)
    releaseTypes = try container.decodeIfPresent([String].self, forKey: .releaseTypes)
    recordLabels = try container.decodeIfPresent([RecordLabel].self, forKey: .recordLabels)
    moods = try container.decodeIfPresent([String].self, forKey: .moods)
    artists = try container.decodeIfPresent([AlbumArtistRef].self, forKey: .artists)
    displayArtist = try container.decodeIfPresent(String.self, forKey: .displayArtist)
    explicitStatus = try container.decodeIfPresent(String.self, forKey: .explicitStatus)
    version = try container.decodeIfPresent(String.self, forKey: .version)

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

private struct DiscTitleValue: Codable, Equatable, Sendable {
  let title: String
}

public struct PartialDate: Codable, Equatable, Sendable {
  public let year: Int?
  public let month: Int?
  public let day: Int?
}

public struct RecordLabel: Codable, Equatable, Sendable {
  public let name: String
}

public struct AlbumArtistRef: Codable, Equatable, Sendable {
  public let id: String
  public let name: String
}
