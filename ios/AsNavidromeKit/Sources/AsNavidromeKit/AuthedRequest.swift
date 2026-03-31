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

  private func urlWithAdditionalParameters(
    path: String,
    additionalParameters: [String: String] = [:]
  ) -> URL {
    var url = endpointURL(path: path)
    let queryItems = additionalParameters.map { key, value in
      URLQueryItem(name: key, value: value)
    }
    url.append(queryItems: queryItems)
    return url
  }

  private func urlByAddingAuthenticationAndFormatParameters(
    to url: URL,
    includeResponseFormat: Bool = true
  ) -> URL {
    let salt = UUID().uuidString
    let token = md5(password + salt)
    var authAndFormatQueryItems = [
      URLQueryItem(name: "u", value: username),
      URLQueryItem(name: "s", value: salt),
      URLQueryItem(name: "v", value: "1.16.1"),
      URLQueryItem(name: "c", value: "subsonic-api"),
    ]
    if includeResponseFormat {
      authAndFormatQueryItems.append(URLQueryItem(name: "f", value: "json"))
    }
    authAndFormatQueryItems.append(URLQueryItem(name: "t", value: token))

    var authenticatedURL = url
    authenticatedURL.append(queryItems: authAndFormatQueryItems)
    return authenticatedURL
  }

  private func logRequestURL(_ url: URL, method: HTTPMethod) {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      print("[AsNavidromeKit] \(method.rawValue) \(url.path)")
      return
    }

    if let items = components.queryItems, !items.isEmpty {
      let maxQueryItemsToLog = 8
      let visibleItems = items.prefix(maxQueryItemsToLog)
      components.queryItems = visibleItems.map { item in
        let value = item.value ?? ""
        let clippedValue = value.count > 80 ? "\(value.prefix(80))..." : value
        return URLQueryItem(name: item.name, value: clippedValue)
      }
      if items.count > maxQueryItemsToLog {
        components.percentEncodedQuery = (components.percentEncodedQuery ?? "")
          + "&truncated=true"
      }
    }

    print("[AsNavidromeKit] \(method.rawValue) \(components.string ?? url.absoluteString)")
  }

  func authenticatedURL(
    path: String,
    additionalParameters: [String: String] = [:],
    includeResponseFormat: Bool = true
  ) -> URL {
    let urlWithAdditionalParameters = urlWithAdditionalParameters(
      path: path,
      additionalParameters: additionalParameters
    )
    return urlByAddingAuthenticationAndFormatParameters(
      to: urlWithAdditionalParameters,
      includeResponseFormat: includeResponseFormat
    )
  }

  private func send(method: HTTPMethod, path: String, additionalParameters: [String: String])
    async throws
    -> [String: Any]
  {
    let urlWithDebugParameters = urlWithAdditionalParameters(
      path: path,
      additionalParameters: additionalParameters
    )
    logRequestURL(urlWithDebugParameters, method: method)
    let authenticatedRequestURL = urlByAddingAuthenticationAndFormatParameters(to: urlWithDebugParameters)

    var request = URLRequest(url: authenticatedRequestURL)
    request.httpMethod = method.rawValue
    request.addValue("Basic \(username):\(password)", forHTTPHeaderField: "Authorization")

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
