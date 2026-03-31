//
//  AudioCache.swift
//  AsMusic
//
//  Created by An So on 2026-03-14.
//

import Foundation

/// Downloads and caches remote audio in the app's Documents directory so files
/// persist through "Clear Cache" (iOS only clears Caches, not Documents).
enum AudioCache {
    private static let subdirectory = "Music"

    /// Directory in Documents where cached audio is stored.
    static var cacheDirectory: URL {
        get throws {
            let docs = try FileManager.default.url(
                for: .documentDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let dir = docs.appending(path: subdirectory, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try setExcludedFromBackupIfNeeded(url: dir)
            return dir
        }
    }

    /// Returns a local file URL for playback. For remote URLs: if already cached in Documents,
    /// returns that; otherwise downloads to Documents and returns the local URL.
    /// For file URLs, returns the URL unchanged.
    /// - Parameter remoteURL: Remote audio URL (e.g. https) or already local file URL.
    /// - Returns: URL suitable for AVPlayer (local file or original if already file).
    static func localURL(for remoteURL: URL) async throws -> URL {
        if remoteURL.isFileURL {
            return remoteURL
        }
        let key = cacheKey(for: remoteURL)
        let localURL = try cacheDirectory.appending(path: key, directoryHint: .notDirectory)
        if FileManager.default.fileExists(atPath: localURL.path(percentEncoded: false)) {
            return localURL
        }
        try await download(from: remoteURL, to: localURL)
        return localURL
    }

    /// Whether a local cached file exists for the given remote URL.
    static func hasCached(for remoteURL: URL) -> Bool {
        guard !remoteURL.isFileURL else { return true }
        guard let dir = try? cacheDirectory else { return false }
        let local = dir.appending(path: cacheKey(for: remoteURL), directoryHint: .notDirectory)
        return FileManager.default.fileExists(atPath: local.path(percentEncoded: false))
    }

    private static func cacheKey(for url: URL) -> String {
        let stableKey = stableCacheIdentifier(for: url)
        let data = Data(stableKey.utf8)
        let hash = data.sha256().map { String(format: "%02x", $0) }.joined()
        let ext = url.pathExtension.isEmpty ? "mp3" : url.pathExtension
        return "\(hash).\(ext)"
    }

    /// Normalize auth-specific URL params so cached files can be reused.
    private static func stableCacheIdentifier(for url: URL) -> String {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url.absoluteString
        }

        if let id = components.queryItems?.first(where: { $0.name == "id" })?.value {
            let host = components.host ?? ""
            let path = components.path
            return "\(host)\(path)?id=\(id)"
        }

        components.queryItems = components.queryItems?
            .filter { !["t", "s", "u", "c", "v", "f"].contains($0.name) }
            .sorted(by: { $0.name < $1.name })
        return components.string ?? url.absoluteString
    }

    private static func download(from remote: URL, to local: URL) async throws {
        let (bytes, response) = try await URLSession.shared.bytes(from: remote)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        guard FileManager.default.createFile(atPath: local.path(percentEncoded: false), contents: nil) else {
            throw URLError(.cannotCreateFile)
        }
        let fileHandle = try FileHandle(forWritingTo: local)
        defer { try? fileHandle.close() }
        var buffer = Data()
        let bufferSize = 65_536
        for try await byte in bytes {
            buffer.append(byte)
            if buffer.count >= bufferSize {
                try fileHandle.write(contentsOf: buffer)
                buffer.removeAll(keepingCapacity: true)
            }
        }
        if !buffer.isEmpty {
            try fileHandle.write(contentsOf: buffer)
        }
        try setExcludedFromBackupIfNeeded(url: local)
    }

    private static func setExcludedFromBackupIfNeeded(url: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableURL = url
        try mutableURL.setResourceValues(values)
    }
}

import CryptoKit

// SHA256 for cache key (small and stable).
extension Data {
    fileprivate func sha256() -> Data {
        Data(SHA256.hash(data: self))
    }
}
