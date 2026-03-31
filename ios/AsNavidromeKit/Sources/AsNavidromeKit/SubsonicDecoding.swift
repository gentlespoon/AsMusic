//
//  SubsonicDecoding.swift
//  AsNavidromeKit
//

import Foundation

func decodeSubsonicResponse(from json: [String: Any]) throws -> SubsonicResponse {
  guard let responseObject = json["subsonic-response"] else {
    throw URLError(.cannotParseResponse)
  }
  let data = try JSONSerialization.data(withJSONObject: responseObject)
  do {
    let parsed = try JSONDecoder().decode(SubsonicResponse.self, from: data)
    return parsed
  } catch let error as DecodingError {
    switch error {
    case .typeMismatch(let type, let context):
      print("Type mismatch for type \(type) in JSON: \(context.debugDescription)")
      print("Path: \(context.codingPath)")
    case .keyNotFound(let key, let context):
      print("Key '\(key.stringValue)' not found: \(context.debugDescription)")
      print("Path: \(context.codingPath)")
    case .valueNotFound(let type, let context):
      print("Value of type \(type) not found: \(context.debugDescription)")
      print("Path: \(context.codingPath)")
    case .dataCorrupted(let context):
      print("Data corrupted: \(context.debugDescription)")
      print("Path: \(context.codingPath)")
    @unknown default:
      print("Unknown decoding error: \(error)")
    }
  } catch {
    print("Other error: \(error)")
  }
  throw URLError(.cannotParseResponse)
}
