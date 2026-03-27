//
//  Artist.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-27.
//



public struct ArtistsResponse: Codable, Equatable, Sendable {
  public let index: [ArtistIndex]
}

public struct ArtistIndex: Codable, Equatable, Sendable {
  public let name: String
  public let artist: [Artist]
}

public struct Artist: Identifiable, Codable, Equatable, Sendable {
  public let id: String
  public let name: String
  public let coverArt: String?
  public let albumCount: Int?
  public let artistImageUrl: String?
  public let musicBrainzId: String?
  public let sortName: String?
  public let roles: [String]?

  public init(
    id: String,
    name: String,
    coverArt: String? = nil,
    albumCount: Int? = nil,
    artistImageUrl: String? = nil,
    musicBrainzId: String? = nil,
    sortName: String? = nil,
    roles: [String]? = nil
  ) {
    self.id = id
    self.name = name
    self.coverArt = coverArt
    self.albumCount = albumCount
    self.artistImageUrl = artistImageUrl
    self.musicBrainzId = musicBrainzId
    self.sortName = sortName
    self.roles = roles
  }
}
