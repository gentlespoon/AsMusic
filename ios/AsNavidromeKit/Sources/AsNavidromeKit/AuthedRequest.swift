//
//  AuthedRequest.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-26.
//

import CryptoKit
import Foundation

private func md5(_ input: String) -> String {
  let digest = Insecure.MD5.hash(data: Data(input.utf8))
  return digest.map { String(format: "%02x", $0) }.joined()
}

enum HTTPMethod: String {
  case get = "GET"
  case post = "POST"
  case put = "PUT"
  case delete = "DELETE"
  case patch = "PATCH"
  case head = "HEAD"
  case options = "OPTIONS"
}

struct AuthedRequest: Sendable {
  let host: String
  let username: String
  let password: String

  func get(path: String, additionalParameters: [String: String] = [:]) async throws -> [String: Any]
  {
    try await send(method: .get, path: path, additionalParameters: additionalParameters)
  }

  func post(path: String, additionalParameters: [String: String] = [:]) async throws -> [String:
    Any]
  {
    try await send(method: .post, path: path, additionalParameters: additionalParameters)
  }

  func authenticatedURL(
    path: String,
    additionalParameters: [String: String] = [:],
    includeResponseFormat: Bool = true
  ) -> URL {
    let salt = UUID().uuidString
    let token = md5(password + salt)
    var queryItems = [
      URLQueryItem(name: "u", value: username),
      URLQueryItem(name: "s", value: salt),
      URLQueryItem(name: "v", value: "1.16.1"),
      URLQueryItem(name: "c", value: "subsonic-api"),
    ]
    if includeResponseFormat {
      queryItems.append(URLQueryItem(name: "f", value: "json"))
    }
    for (key, value) in additionalParameters {
      queryItems.append(URLQueryItem(name: key, value: value))
    }
    queryItems.append(URLQueryItem(name: "t", value: token))

    var url = endpointURL(path: path)
    url.append(queryItems: queryItems)
    return url
  }

  private func send(method: HTTPMethod, path: String, additionalParameters: [String: String])
    async throws
    -> [String: Any]
  {
    var request = URLRequest(url: endpointURL(path: path))
    request.httpMethod = method.rawValue
    request.addValue("Basic \(username):\(password)", forHTTPHeaderField: "Authorization")
    request.url = authenticatedURL(path: path, additionalParameters: additionalParameters)

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse,
      (200...299).contains(httpResponse.statusCode)
    else {
      throw URLError(.badServerResponse)
    }

    let json = try JSONSerialization.jsonObject(with: data, options: [.allowFragments])
    guard let dictionary = json as? [String: Any] else {
      throw URLError(.cannotParseResponse)
    }

    return dictionary
  }

  private func endpointURL(path: String) -> URL {
    let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
    return URL(string: "\(trimmedHost)\(path)")!
  }
}
