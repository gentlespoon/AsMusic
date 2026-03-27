//
//  SongFileCache.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import CryptoKit
import Foundation

/// Downloads and caches remote audio under `Documents/Music`, matching server paths when available.
///
/// **Playback:** `AVPlayer` does not reliably play a *growing* local file (it stops once it reaches the
/// end of the bytes that existed when the asset was opened). So for tracks that are not fully cached,
/// use the **remote** stream URL and let `AVPlayer` stream over HTTP. A background task fills the cache
/// for next time (a second HTTP connection while the first play streams—acceptable tradeoff).
enum SongFileCache {
  private static let subdirectory = "Music"

  /// URL to pass to `AVPlayer`: local file when fully cached, otherwise the same remote stream URL.
  static func playbackURL(for remoteURL: URL, relativePath: String?) throws -> URL {
    if remoteURL.isFileURL {
      return remoteURL
    }
    let finalURL = try localFileURL(for: remoteURL, relativePath: relativePath)
    let markerURL = cacheCompleteMarkerURL(for: finalURL)
    if FileManager.default.fileExists(atPath: finalURL.path(percentEncoded: false)),
      FileManager.default.fileExists(atPath: markerURL.path(percentEncoded: false))
    {
      return finalURL
    }
    return remoteURL
  }

  /// Fetches the full stream into the cache path and writes `*.cachecomplete`. Call from a `Task`
  /// you can cancel when the user switches tracks. No-op if already cached.
  static func downloadFullToCache(remoteURL: URL, relativePath: String?) async throws {
    if remoteURL.isFileURL { return }
    if hasCached(for: remoteURL, relativePath: relativePath) { return }

    let finalURL = try localFileURL(for: remoteURL, relativePath: relativePath)
    let markerURL = cacheCompleteMarkerURL(for: finalURL)

    if FileManager.default.fileExists(atPath: finalURL.path(percentEncoded: false)) {
      try? FileManager.default.removeItem(at: finalURL)
    }
    try? FileManager.default.removeItem(at: markerURL)

    let parentDirectory = finalURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(at: parentDirectory, withIntermediateDirectories: true)

    let (asyncBytes, response) = try await URLSession.shared.bytes(from: remoteURL)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw URLError(.badServerResponse)
    }

    guard FileManager.default.createFile(atPath: finalURL.path(percentEncoded: false), contents: nil)
    else {
      throw URLError(.cannotCreateFile)
    }
    let handle = try FileHandle(forWritingTo: finalURL)
    defer { try? handle.close() }

    var buffer = Data()
    let bufferSize = 65_536

    for try await byte in asyncBytes {
      try Task.checkCancellation()
      buffer.append(byte)
      if buffer.count >= bufferSize {
        try handle.write(contentsOf: buffer)
        buffer.removeAll(keepingCapacity: true)
      }
    }
    if !buffer.isEmpty {
      try handle.write(contentsOf: buffer)
    }
    try handle.synchronize()

    try Data().write(to: markerURL, options: .atomic)
  }

  static func hasCached(for remoteURL: URL, relativePath: String?) -> Bool {
    guard !remoteURL.isFileURL else { return true }
    guard let local = try? localFileURL(for: remoteURL, relativePath: relativePath) else { return false }
    let marker = cacheCompleteMarkerURL(for: local)
    return FileManager.default.fileExists(atPath: local.path(percentEncoded: false))
      && FileManager.default.fileExists(atPath: marker.path(percentEncoded: false))
  }

  /// Local file URL if a **complete** cached copy exists; does not download.
  static func existingLocalFileURLIfPresent(for remoteURL: URL, relativePath: String?) -> URL? {
    if remoteURL.isFileURL {
      return remoteURL
    }
    guard let local = try? localFileURL(for: remoteURL, relativePath: relativePath) else { return nil }
    let marker = cacheCompleteMarkerURL(for: local)
    guard FileManager.default.fileExists(atPath: local.path(percentEncoded: false)),
      FileManager.default.fileExists(atPath: marker.path(percentEncoded: false))
    else { return nil }
    return local
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

  private static func cacheKey(for url: URL) -> String {
    let stableKey = stableCacheIdentifier(for: url)
    let data = Data(stableKey.utf8)
    let hash = data.sha256().map { String(format: "%02x", $0) }.joined()
    let ext = url.pathExtension.isEmpty ? "mp3" : url.pathExtension
    return "\(hash).\(ext)"
  }

  private static func localFileURL(for remoteURL: URL, relativePath: String?) throws -> URL {
    let base = try cacheDirectory
    if let sanitizedPath = sanitizedRelativePath(relativePath), !sanitizedPath.isEmpty {
      return base.appending(path: sanitizedPath, directoryHint: .notDirectory)
    }
    return base.appending(path: cacheKey(for: remoteURL), directoryHint: .notDirectory)
  }

  private static func cacheCompleteMarkerURL(for finalURL: URL) -> URL {
    finalURL.appendingPathExtension("cachecomplete")
  }

  private static func sanitizedRelativePath(_ rawPath: String?) -> String? {
    guard let rawPath else { return nil }
    let trimmed = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let standardized = URL(fileURLWithPath: trimmed).standardized.path
    var components = standardized.split(separator: "/").map(String.init)
    components.removeAll(where: { $0 == "." || $0 == ".." || $0.isEmpty })
    guard !components.isEmpty else { return nil }
    return components.joined(separator: "/")
  }

  /// Same on-disk file for `stream` vs `download` (and auth query churn) so cache lookups stay stable.
  private static func stableCacheIdentifier(for url: URL) -> String {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return url.absoluteString
    }

    if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
      let host = components.host ?? ""
      let path = components.path
      let normalizedPath: String
      if path.hasSuffix("/rest/stream") || path.hasSuffix("/rest/download") {
        normalizedPath = "/rest/audio"
      } else {
        normalizedPath = path
      }
      return "\(host)\(normalizedPath)?id=\(id)"
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
