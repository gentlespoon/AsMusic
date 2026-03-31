//
//  ArtworkFileCache.swift
//  AsMusic
//

import CryptoKit
import Foundation

/// Caches remote artwork under `Documents/Artwork` to avoid repeated network fetches.
enum ArtworkFileCache {
  private static let subdirectory = "Artwork"

  /// Returns a local file URL when available. If not cached, downloads once and returns local on success,
  /// otherwise falls back to the original remote URL.
  static func displayURL(for remoteURL: URL) async -> URL {
    if remoteURL.isFileURL {
      return remoteURL
    }
    if let local = existingLocalFileURLIfPresent(for: remoteURL) {
      return local
    }
    if let local = try? await downloadIfNeeded(remoteURL: remoteURL) {
      return local
    }
    return remoteURL
  }

  static func existingLocalFileURLIfPresent(for remoteURL: URL) -> URL? {
    if remoteURL.isFileURL {
      return remoteURL
    }
    guard let local = try? localFileURL(for: remoteURL) else { return nil }
    let marker = cacheCompleteMarkerURL(for: local)
    guard FileManager.default.fileExists(atPath: local.path(percentEncoded: false)),
      FileManager.default.fileExists(atPath: marker.path(percentEncoded: false))
    else { return nil }
    return local
  }

  static func downloadIfNeeded(remoteURL: URL) async throws -> URL {
    if remoteURL.isFileURL {
      return remoteURL
    }
    if let existing = existingLocalFileURLIfPresent(for: remoteURL) {
      return existing
    }

    let finalURL = try localFileURL(for: remoteURL)
    let markerURL = cacheCompleteMarkerURL(for: finalURL)
    let partialURL = finalURL.appendingPathExtension("partial")
    let parentDirectory = finalURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: parentDirectory, withIntermediateDirectories: true)

    let (data, response) = try await URLSession.shared.data(from: remoteURL)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw URLError(.badServerResponse)
    }
    guard !data.isEmpty else {
      throw URLError(.zeroByteResource)
    }

    try? FileManager.default.removeItem(at: partialURL)
    try data.write(to: partialURL, options: .atomic)
    if FileManager.default.fileExists(atPath: finalURL.path(percentEncoded: false)) {
      try? FileManager.default.removeItem(at: finalURL)
    }
    try FileManager.default.moveItem(at: partialURL, to: finalURL)
    try Data().write(to: markerURL, options: .atomic)
    return finalURL
  }

  private static var cacheDirectory: URL {
    get throws {
      let docs = try FileManager.default.url(
        for: .documentDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      let dir = docs.appending(path: subdirectory, directoryHint: .isDirectory)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      return dir
    }
  }

  private static func localFileURL(for remoteURL: URL) throws -> URL {
    let ext = fileExtension(for: remoteURL)
    let name = cacheKey(for: remoteURL) + "." + ext
    return try cacheDirectory.appending(path: name, directoryHint: .notDirectory)
  }

  private static func cacheCompleteMarkerURL(for finalURL: URL) -> URL {
    finalURL.appendingPathExtension("cachecomplete")
  }

  private static func cacheKey(for url: URL) -> String {
    let stableKey = stableCacheIdentifier(for: url)
    let data = Data(stableKey.utf8)
    return data.sha256().map { String(format: "%02x", $0) }.joined()
  }

  private static func fileExtension(for url: URL) -> String {
    let ext = url.pathExtension.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return ext.isEmpty ? "jpg" : ext
  }

  /// Removes auth token churn and normalizes `getCoverArt` identity to host + id (+ optional size).
  private static func stableCacheIdentifier(for url: URL) -> String {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return url.absoluteString
    }
    let host = components.host ?? ""
    let path = components.path
    let id = components.queryItems?.first(where: { $0.name == "id" })?.value ?? ""
    let size = components.queryItems?.first(where: { $0.name == "size" })?.value ?? ""

    if path.hasSuffix("/rest/getCoverArt"), !id.isEmpty {
      return "\(host)/rest/getCoverArt?id=\(id)&size=\(size)"
    }

    components.queryItems = components.queryItems?
      .filter { !["t", "s", "u", "c", "v", "f"].contains($0.name) }
      .sorted(by: { $0.name < $1.name })
    return components.string ?? url.absoluteString
  }
}

private extension Data {
  func sha256() -> Data {
    Data(SHA256.hash(data: self))
  }
}
