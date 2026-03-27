//
//  MusicFolder.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-27.
//




public struct MusicFoldersResponse: Codable, Sendable {
  public let musicFolder: [MusicFolder]
}

public struct MusicFolder: Identifiable, Codable, Equatable, Sendable {
  public let id: String
  public let name: String

  enum CodingKeys: String, CodingKey {
    case id
    case name
  }

  public init(id: String, name: String) {
    self.id = id
    self.name = name
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    if let stringID = try? container.decode(String.self, forKey: .id) {
      id = stringID
    } else if let intID = try? container.decode(Int.self, forKey: .id) {
      id = String(intID)
    } else {
      throw DecodingError.typeMismatch(
        String.self,
        DecodingError.Context(
          codingPath: container.codingPath + [CodingKeys.id],
          debugDescription: "Expected id as String or Int"
        )
      )
    }
    name = try container.decode(String.self, forKey: .name)
  }
}
