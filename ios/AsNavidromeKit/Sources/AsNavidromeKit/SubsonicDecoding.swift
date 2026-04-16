//
//  SubsonicDecoding.swift
//  AsNavidromeKit
//

import Foundation

private struct SubsonicRootEnvelope: Decodable {
  let subsonicResponse: SubsonicResponse

  enum CodingKeys: String, CodingKey {
    case subsonicResponse = "subsonic-response"
  }
}

public func decodeSubsonicResponse(from data: Data) throws -> SubsonicResponse {
  do {
    let envelope = try JSONDecoder().decode(SubsonicRootEnvelope.self, from: data)
    return envelope.subsonicResponse
  } catch let error as DecodingError {
    switch error {
    case .typeMismatch(let type, let context):
      KitLogging.decoding.error(
        "Subsonic decode type mismatch: \(String(describing: type)) — \(context.debugDescription, privacy: .public)"
      )
    case .keyNotFound(let key, let context):
      KitLogging.decoding.error(
        "Subsonic decode missing key \(key.stringValue, privacy: .public) — \(context.debugDescription, privacy: .public)"
      )
    case .valueNotFound(let type, let context):
      KitLogging.decoding.error(
        "Subsonic decode missing value \(String(describing: type)) — \(context.debugDescription, privacy: .public)"
      )
    case .dataCorrupted(let context):
      KitLogging.decoding.error(
        "Subsonic decode corrupted: \(context.debugDescription, privacy: .public)"
      )
    @unknown default:
      KitLogging.decoding.error("Subsonic decode unknown DecodingError")
    }
    throw URLError(.cannotParseResponse)
  } catch {
    KitLogging.decoding.error(
      "Subsonic decode failed: \(error.localizedDescription, privacy: .public)"
    )
    throw URLError(.cannotParseResponse)
  }
}
