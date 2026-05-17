//
//  LibraryCacheSQLiteStore.swift
//  AsMusic — local library mirror for the Capacitor shell (parity with web IndexedDB + legacy iOS SQLite).
//

import AVFoundation
import Foundation
import SQLite3

/// Thread-safe SQLite access for library cache rows keyed by `(server_key, library_id)`.
enum LibraryCacheSQLiteStore {

    nonisolated(unsafe) private static let transientDestructor: sqlite3_destructor_type = unsafeBitCast(
        -1,
        to: sqlite3_destructor_type.self
    )

    private static var db: OpaquePointer?
    private static let queue = DispatchQueue(label: "works.asmusic.library-cache-sqlite", qos: .utility)

    // MARK: - Public API (called from plugin on arbitrary queue — we hop to `queue`)

    static func readSongsJson(serverKey: String, libraryId: String) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT song_json FROM library_songs
                WHERE server_key = ? AND library_id = ?
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)

            var parts: [String] = []
            parts.reserveCapacity(256)
            parts.append("[")
            var first = true
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let c = sqlite3_column_text(stmt, 0) else { continue }
                let json = String(cString: c)
                if !first { parts.append(",") }
                first = false
                parts.append(json)
            }
            parts.append("]")
            return parts.joined()
        }
    }

    static func readMeta(serverKey: String, libraryId: String) throws -> (lastSyncAt: Double, songCount: Int)? {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT last_sync_at, song_count FROM library_meta
                WHERE server_key = ? AND library_id = ? LIMIT 1;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)

            guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
            let last = sqlite3_column_double(stmt, 0)
            let count = Int(sqlite3_column_int64(stmt, 1))
            return (lastSyncAt: last, songCount: count)
        }
    }

    static func readCachedAlbumCount(serverKey: String, libraryId: String) throws -> Int {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT COUNT(*) FROM library_albums
                WHERE server_key = ? AND library_id = ?;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)

            guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
            return Int(sqlite3_column_int64(stmt, 0))
        }
    }

    /// Removes derived album/artist rows for a scope (songs untouched). Called at the start of a library refresh.
    static func purgeArtistAndAlbumCaches(serverKey: String, libraryId: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var ok = false
            defer {
                _ = execute(db, ok ? "COMMIT;" : "ROLLBACK;")
            }

            for table in ["library_artists", "library_albums"] {
                let sql = "DELETE FROM \(table) WHERE server_key = ? AND library_id = ?;"
                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }
                guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
                guard sqlite3_step(stmt) == SQLITE_DONE else { return }
            }
            ok = true
        }
    }

    /// Replaces all songs for a scope in a single transaction (matches web IndexedDB semantics).
    static func replaceSongList(
        serverKey: String,
        libraryId: String,
        songsJson: String,
        artistsJson: String,
        albumsJson: String
    ) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = songsJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let songs = raw as? [[String: Any]] else { throw StoreError.invalidJson }

            guard let artistsData = artistsJson.data(using: .utf8),
                  let albumsData = albumsJson.data(using: .utf8)
            else { throw StoreError.invalidJson }
            let artistsRaw = try JSONSerialization.jsonObject(with: artistsData, options: [])
            let albumsRaw = try JSONSerialization.jsonObject(with: albumsData, options: [])
            let artists = artistsRaw as? [[String: Any]] ?? []
            let albums = albumsRaw as? [[String: Any]] ?? []

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer {
                _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;")
            }

            var del: OpaquePointer?
            defer { sqlite3_finalize(del) }
            let delSql = "DELETE FROM library_songs WHERE server_key = ? AND library_id = ?;"
            guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(del, 2, libraryId, -1, transientDestructor)
            guard sqlite3_step(del) == SQLITE_DONE else { return }

            let insSql = """
                INSERT INTO library_songs(server_key, library_id, song_id, sort_index, song_json)
                VALUES(?, ?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

            let now = Date().timeIntervalSince1970
            for (index, song) in songs.enumerated() {
                guard let id = Self.jsonStringId(song["id"]), !id.isEmpty else {
                    continue
                }
                let rowData = try JSONSerialization.data(withJSONObject: song, options: [])
                guard let rowJson = String(data: rowData, encoding: .utf8) else { continue }

                sqlite3_reset(ins)
                sqlite3_clear_bindings(ins)
                sqlite3_bind_text(ins, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(ins, 2, libraryId, -1, transientDestructor)
                sqlite3_bind_text(ins, 3, id, -1, transientDestructor)
                sqlite3_bind_int64(ins, 4, Int64(index))
                sqlite3_bind_text(ins, 5, rowJson, -1, transientDestructor)
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            try Self.replaceIndexRows(
                db: db,
                serverKey: serverKey,
                libraryId: libraryId,
                table: "library_artists",
                idColumn: "artist_id",
                jsonColumn: "artist_json",
                rows: artists
            )
            try Self.replaceIndexRows(
                db: db,
                serverKey: serverKey,
                libraryId: libraryId,
                table: "library_albums",
                idColumn: "album_id",
                jsonColumn: "album_json",
                rows: albums
            )

            let metaSql = """
                INSERT INTO library_meta(server_key, library_id, last_sync_at, song_count)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(server_key, library_id) DO UPDATE SET
                  last_sync_at = excluded.last_sync_at,
                  song_count = excluded.song_count;
                """
            var meta: OpaquePointer?
            defer { sqlite3_finalize(meta) }
            guard sqlite3_prepare_v2(db, metaSql, -1, &meta, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(meta, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(meta, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_double(meta, 3, now)
            sqlite3_bind_int64(meta, 4, Int64(songs.count))
            guard sqlite3_step(meta) == SQLITE_DONE else { return }

            shouldCommit = true
        }
    }

    /// Updates one row's `song_json` (e.g. Subsonic star/unstar) without rewriting the whole library.
    static func patchSongJson(serverKey: String, libraryId: String, songId: String, songJson: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = songJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let song = raw as? [String: Any] else { throw StoreError.invalidJson }
            guard let parsedId = Self.jsonStringId(song["id"]), parsedId == songId, !parsedId.isEmpty else {
                throw StoreError.invalidJson
            }

            let rowData = try JSONSerialization.data(withJSONObject: song, options: [])
            guard let rowJson = String(data: rowData, encoding: .utf8) else { throw StoreError.invalidJson }

            let sql = """
                UPDATE library_songs SET song_json = ?
                WHERE server_key = ? AND library_id = ? AND song_id = ?;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, rowJson, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 3, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 4, songId, -1, transientDestructor)
            guard sqlite3_step(stmt) == SQLITE_DONE else { throw StoreError.prepareFailed }
            if sqlite3_changes(db) == 0 {
                throw StoreError.songNotFound
            }
        }
    }

    static func readPlaylistSummariesJson(serverKey: String, libraryId: String) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT playlist_id, name, song_count FROM library_playlists
                WHERE server_key = ? AND library_id = ?
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)

            var parts: [String] = []
            parts.reserveCapacity(64)
            parts.append("[")
            var first = true
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let pidC = sqlite3_column_text(stmt, 0),
                      let nameC = sqlite3_column_text(stmt, 1) else { continue }
                let pid = String(cString: pidC)
                let name = String(cString: nameC)
                let sc = Int(sqlite3_column_int64(stmt, 2))
                let pidStr = try jsonQuotedString(pid)
                let nameStr = try jsonQuotedString(name)
                if !first { parts.append(",") }
                first = false
                parts.append("{\"id\":\(pidStr),\"name\":\(nameStr),\"songCount\":\(sc)}")
            }
            parts.append("]")
            return parts.joined()
        }
    }

    static func replacePlaylistSummaries(serverKey: String, libraryId: String, playlistsJson: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = playlistsJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let playlists = raw as? [[String: Any]] else { throw StoreError.invalidJson }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer {
                _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;")
            }

            var del: OpaquePointer?
            defer { sqlite3_finalize(del) }
            let delSql = "DELETE FROM library_playlists WHERE server_key = ? AND library_id = ?;"
            guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(del, 2, libraryId, -1, transientDestructor)
            guard sqlite3_step(del) == SQLITE_DONE else { return }

            let insSql = """
                INSERT INTO library_playlists(server_key, library_id, playlist_id, sort_index, name, song_count)
                VALUES(?, ?, ?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

            for (index, pl) in playlists.enumerated() {
                let pid = Self.jsonStringId(pl["id"]) ?? ""
                let name = (pl["name"] as? String) ?? ""
                let sc = Self.jsonInt(pl["songCount"])
                if pid.isEmpty { continue }

                sqlite3_reset(ins)
                sqlite3_clear_bindings(ins)
                sqlite3_bind_text(ins, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(ins, 2, libraryId, -1, transientDestructor)
                sqlite3_bind_text(ins, 3, pid, -1, transientDestructor)
                sqlite3_bind_int64(ins, 4, Int64(index))
                sqlite3_bind_text(ins, 5, name, -1, transientDestructor)
                sqlite3_bind_int64(ins, 6, Int64(sc))
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            shouldCommit = true
        }
    }

    static func clearArtwork(serverKey: String, libraryId: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = "DELETE FROM library_artworks WHERE server_key = ? AND library_id = ?;"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.transactionFailed
            }
        }
    }

    /// Inserts or replaces rows parsed from `entriesJson`: `[{ "coverArtId", "mimeType", "base64" }]`.
    static func putArtworkBatch(serverKey: String, libraryId: String, entriesJson: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = entriesJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let entries = raw as? [[String: Any]] else { throw StoreError.invalidJson }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer {
                _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;")
            }

            let insSql = """
                INSERT OR REPLACE INTO library_artworks(server_key, library_id, cover_art_id, mime_type, image_bytes, updated_at)
                VALUES(?, ?, ?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

            let now = Date().timeIntervalSince1970
            for entry in entries {
                let cid = (entry["coverArtId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let mime = (entry["mimeType"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "image/jpeg"
                let b64 = entry["base64"] as? String ?? ""
                guard !cid.isEmpty, let imageData = Data(base64Encoded: b64), !imageData.isEmpty else {
                    continue
                }

                sqlite3_reset(ins)
                sqlite3_clear_bindings(ins)
                sqlite3_bind_text(ins, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(ins, 2, libraryId, -1, transientDestructor)
                sqlite3_bind_text(ins, 3, cid, -1, transientDestructor)
                sqlite3_bind_text(ins, 4, mime, -1, transientDestructor)
                _ = imageData.withUnsafeBytes { raw in
                    sqlite3_bind_blob(ins, 5, raw.baseAddress, Int32(imageData.count), transientDestructor)
                }
                sqlite3_bind_double(ins, 6, now)
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            shouldCommit = true
        }
    }

    static func readArtworkBlob(serverKey: String, libraryId: String, coverArtId: String) throws -> (mimeType: String, base64: String)? {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT mime_type, image_bytes FROM library_artworks
                WHERE server_key = ? AND library_id = ? AND cover_art_id = ? LIMIT 1;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 3, coverArtId, -1, transientDestructor)

            guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
            let mimeRaw = sqlite3_column_text(stmt, 0)
            let mime = mimeRaw.map { String(cString: $0) } ?? "image/jpeg"

            guard let blobPtr = sqlite3_column_blob(stmt, 1) else { return nil }
            let nbytes = sqlite3_column_bytes(stmt, 1)
            guard nbytes > 0 else { return nil }
            let data = Data(bytes: blobPtr, count: Int(nbytes))
            let b64 = data.base64EncodedString()
            return (mimeType: mime, base64: b64)
        }
    }

    static func deleteScope(serverKey: String, libraryId: String) throws {
        var offlinePaths: [String] = []
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var ok = false
            defer {
                _ = execute(db, ok ? "COMMIT;" : "ROLLBACK;")
            }

            offlinePaths = try offlineCollectPathsForScope(db: db, serverKey: serverKey, libraryId: libraryId)

            for table in [
                "library_songs", "library_playlists", "library_artworks",
                "library_artists", "library_albums", "library_meta", "offline_tracks"
            ] {
                let sql = "DELETE FROM \(table) WHERE server_key = ? AND library_id = ?;"
                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }
                guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
                guard sqlite3_step(stmt) == SQLITE_DONE else { return }
            }
            ok = true
        }
        for p in offlinePaths {
            try? FileManager.default.removeItem(atPath: p)
        }
    }

    // MARK: - Offline audio (filesystem + metadata in this DB)

    private static func offlineRootDirectory() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = base.appendingPathComponent("AsMusic").appendingPathComponent("OfflineAudio", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try setOfflineExcludedFromBackup(url: dir)
        return dir
    }

    private static func offlineFinalFileURL(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        fileExtension: String
    ) throws -> URL {
        let root = try offlineRootDirectory()
        let safeTrack = trackId.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: ":", with: "_")
        let v = variant.isEmpty ? "default" : variant.replacingOccurrences(of: "/", with: "_")
        let ext = fileExtension.isEmpty ? "mp3" : fileExtension
        return root
            .appendingPathComponent(serverKey, isDirectory: true)
            .appendingPathComponent(libraryId, isDirectory: true)
            .appendingPathComponent("\(v)_\(safeTrack).\(ext)", isDirectory: false)
    }

    private static let offlineKnownAudioExtensions: Set<String> = ["mp3", "m4a", "flac", "ogg", "wav", "aac", "mp4"]

    private static func offlineFileExtension(mimeType: String, remoteUrl: URL) -> String {
        let remoteExt = remoteUrl.pathExtension.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if offlineKnownAudioExtensions.contains(remoteExt) {
            return remoteExt
        }
        switch mimeType.lowercased() {
        case "audio/mpeg", "audio/mp3":
            return "mp3"
        case "audio/mp4", "audio/m4a", "audio/x-m4a":
            return "m4a"
        case "audio/flac", "audio/x-flac":
            return "flac"
        case "audio/ogg", "application/ogg":
            return "ogg"
        case "audio/wav", "audio/x-wav", "audio/wave":
            return "wav"
        case "audio/aac", "audio/x-aac":
            return "aac"
        default:
            return "mp3"
        }
    }

    /// Resolves a playback path: stored absolute path, canonical layout, or legacy `.audio` filename.
    private static func offlineResolvePlaybackPath(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        storedPath: String
    ) throws -> String? {
        let fm = FileManager.default
        if fm.fileExists(atPath: storedPath) {
            return try normalizeOfflinePlaybackPath(
                storedPath,
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                mimeType: nil
            )
        }
        let candidates = try [
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "mp3"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "m4a"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "flac"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "audio"
            ).path,
        ]
        guard let found = candidates.first(where: { fm.fileExists(atPath: $0) }) else {
            return nil
        }
        return try normalizeOfflinePlaybackPath(
            found,
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            mimeType: nil
        )
    }

    /// Renames legacy `*.audio` / unknown extensions to a MIME-appropriate name so AVPlayer can open the file.
    private static func normalizeOfflinePlaybackPath(
        _ path: String,
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        mimeType: String?
    ) throws -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        if offlineKnownAudioExtensions.contains(ext) {
            return path
        }
        let targetExt = offlineFileExtension(mimeType: mimeType ?? "audio/mpeg", remoteUrl: URL(fileURLWithPath: path))
        let dest = (path as NSString).deletingPathExtension + ".\(targetExt)"
        if path == dest {
            return path
        }
        let fm = FileManager.default
        if !fm.fileExists(atPath: dest) {
            try fm.copyItem(atPath: path, toPath: dest)
        }
        try updateOfflineAbsPathLocked(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            absPath: dest
        )
        return dest
    }

    /// Caller must already hold `queue` (do not call `queue.sync` from inside `queue.sync`).
    private static func updateOfflineAbsPathLocked(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        absPath: String
    ) throws {
        try openIfNeeded()
        guard let db else { throw StoreError.databaseUnavailable }
        let sql = """
            UPDATE offline_tracks SET abs_path = ?
            WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ?;
            """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.prepareFailed
        }
        sqlite3_bind_text(stmt, 1, absPath, -1, transientDestructor)
        sqlite3_bind_text(stmt, 2, serverKey, -1, transientDestructor)
        sqlite3_bind_text(stmt, 3, libraryId, -1, transientDestructor)
        sqlite3_bind_text(stmt, 4, trackId, -1, transientDestructor)
        sqlite3_bind_text(stmt, 5, variant, -1, transientDestructor)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw StoreError.prepareFailed
        }
    }

    private static func setOfflineExcludedFromBackup(url: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var u = url
        try u.setResourceValues(values)
    }

    static func offlineImportFromUrl(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        remoteUrlString: String
    ) async throws {
        guard let remoteUrl = URL(string: remoteUrlString) else {
            throw StoreError.invalidJson
        }
        let (localTmp, response) = try await URLSession.shared.download(from: remoteUrl)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let mime = http.mimeType ?? "application/octet-stream"
        let ext = offlineFileExtension(mimeType: mime, remoteUrl: remoteUrl)
        let dest = try offlineFinalFileURL(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            fileExtension: ext
        )
        let fm = FileManager.default
        try fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fm.fileExists(atPath: dest.path) {
            try fm.removeItem(at: dest)
        }
        try fm.moveItem(at: localTmp, to: dest)
        let attrs = try fm.attributesOfItem(atPath: dest.path)
        let size = Int((attrs[.size] as? NSNumber)?.int64Value ?? 0)
        let now = Date().timeIntervalSince1970
        let absPath = dest.path

        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                INSERT INTO offline_tracks(server_key, library_id, track_id, variant, abs_path, mime_type, byte_length, updated_at)
                VALUES(?,?,?,?,?,?,?,?)
                ON CONFLICT(server_key, library_id, track_id, variant) DO UPDATE SET
                  abs_path = excluded.abs_path,
                  mime_type = excluded.mime_type,
                  byte_length = excluded.byte_length,
                  updated_at = excluded.updated_at;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 3, trackId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 4, variant, -1, transientDestructor)
            sqlite3_bind_text(stmt, 5, absPath, -1, transientDestructor)
            sqlite3_bind_text(stmt, 6, mime, -1, transientDestructor)
            sqlite3_bind_int64(stmt, 7, Int64(size))
            sqlite3_bind_double(stmt, 8, now)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }
        }
    }

    static func offlineWaveformPeaks(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        barCount: Int
    ) throws -> [Double] {
        guard let path = try offlinePlaybackFilePath(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant
        ) else {
            throw StoreError.databaseUnavailable
        }
        return try computeWaveformPeaks(filePath: path, barCount: barCount)
    }

    private static func computeWaveformPeaks(filePath: String, barCount: Int) throws -> [Double] {
        let bars = max(8, min(barCount, 512))
        let url = URL(fileURLWithPath: filePath)
        let file = try AVAudioFile(forReading: url)
        let frameCount = Int(file.length)
        guard frameCount > 0 else {
            return Array(repeating: 0.2, count: bars)
        }

        let format = file.processingFormat
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            throw StoreError.databaseUnavailable
        }
        try file.read(into: buffer)

        let frameLength = Int(buffer.frameLength)
        guard frameLength > 0 else {
            return Array(repeating: 0.2, count: bars)
        }

        var peaks = [Double](repeating: 0, count: bars)
        let samplesPerBar = max(1, frameLength / bars)
        let channelCount = Int(format.channelCount)

        if let floatChannels = buffer.floatChannelData {
            for bar in 0..<bars {
                var maxVal: Float = 0
                let start = bar * samplesPerBar
                let end = min(start + samplesPerBar, frameLength)
                for ch in 0..<channelCount {
                    let data = floatChannels[ch]
                    for i in start..<end {
                        maxVal = max(maxVal, abs(data[i]))
                    }
                }
                peaks[bar] = Double(maxVal)
            }
        } else if let int16Channels = buffer.int16ChannelData {
            for bar in 0..<bars {
                var maxVal: Float = 0
                let start = bar * samplesPerBar
                let end = min(start + samplesPerBar, frameLength)
                for ch in 0..<channelCount {
                    let data = int16Channels[ch]
                    for i in start..<end {
                        maxVal = max(maxVal, abs(Float(data[i]) / 32768.0))
                    }
                }
                peaks[bar] = Double(maxVal)
            }
        } else {
            return Array(repeating: 0.2, count: bars)
        }

        let top = peaks.max() ?? 0.001
        if top > 0 {
            peaks = peaks.map { min(1.0, $0 / top) }
        }
        return peaks
    }

    static func offlinePlaybackFilePath(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String
    ) throws -> String? {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT abs_path, mime_type FROM offline_tracks
                WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ? LIMIT 1;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 3, trackId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 4, variant, -1, transientDestructor)

            guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
            guard let c = sqlite3_column_text(stmt, 0) else { return nil }
            let storedPath = String(cString: c)
            let mimeC = sqlite3_column_text(stmt, 1)
            let mime = mimeC.map { String(cString: $0) }
            guard let resolved = try offlineResolvePlaybackPath(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                storedPath: storedPath
            ) else {
                return nil
            }
            return try normalizeOfflinePlaybackPath(
                resolved,
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                mimeType: mime
            )
        }
    }

    static func offlineReadStatus(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String
    ) throws -> [String: Any] {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT abs_path, byte_length, mime_type, updated_at FROM offline_tracks
                WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ? LIMIT 1;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 3, trackId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 4, variant, -1, transientDestructor)

            guard sqlite3_step(stmt) == SQLITE_ROW else {
                return ["status": "none"]
            }
            guard let pathC = sqlite3_column_text(stmt, 0) else {
                return ["status": "none"]
            }
            let path = String(cString: pathC)
            guard let resolved = try? offlineResolvePlaybackPath(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                storedPath: path
            ) else {
                return ["status": "invalid"]
            }
            if resolved == nil {
                return ["status": "invalid"]
            }
            let bl = Int(sqlite3_column_int64(stmt, 1))
            let mimeC = sqlite3_column_text(stmt, 2)
            let mime = mimeC.map { String(cString: $0) } ?? ""
            let updated = sqlite3_column_double(stmt, 3)
            return [
                "status": "ready",
                "byteLength": bl,
                "mimeType": mime,
                "updatedAt": updated
            ]
        }
    }

    static func offlineListReadyJson(serverKey: String?, libraryId: String?) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql: String
            if let serverKey, let libraryId {
                sql = """
                    SELECT server_key, library_id, track_id, variant, byte_length, mime_type, updated_at
                    FROM offline_tracks
                    WHERE server_key = ? AND library_id = ?
                    ORDER BY updated_at DESC;
                    """
            } else if let serverKey {
                sql = """
                    SELECT server_key, library_id, track_id, variant, byte_length, mime_type, updated_at
                    FROM offline_tracks
                    WHERE server_key = ?
                    ORDER BY updated_at DESC;
                    """
            } else {
                sql = """
                    SELECT server_key, library_id, track_id, variant, byte_length, mime_type, updated_at
                    FROM offline_tracks
                    ORDER BY updated_at DESC;
                    """
            }

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            if let serverKey, let libraryId {
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            } else if let serverKey {
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            }

            var rows: [[String: Any]] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let sk = String(cString: sqlite3_column_text(stmt, 0))
                let lid = String(cString: sqlite3_column_text(stmt, 1))
                let tid = String(cString: sqlite3_column_text(stmt, 2))
                let varRaw = sqlite3_column_text(stmt, 3)
                let v = varRaw.map { String(cString: $0) } ?? ""
                let bl = sqlite3_column_int64(stmt, 4)
                let mimeRaw = sqlite3_column_text(stmt, 5)
                let mime = mimeRaw.map { String(cString: $0) } ?? ""
                let updated = sqlite3_column_double(stmt, 6)
                rows.append([
                    "serverKey": sk,
                    "libraryId": lid,
                    "trackId": tid,
                    "variant": v,
                    "byteLength": bl,
                    "mimeType": mime,
                    "updatedAt": updated
                ])
            }
            let data = try JSONSerialization.data(withJSONObject: rows, options: [])
            return String(data: data, encoding: .utf8) ?? "[]"
        }
    }

    static func offlineDeleteOne(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String
    ) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            var path: String?
            let sel = """
                SELECT abs_path FROM offline_tracks
                WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ? LIMIT 1;
                """
            var selStmt: OpaquePointer?
            defer { sqlite3_finalize(selStmt) }
            guard sqlite3_prepare_v2(db, sel, -1, &selStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(selStmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(selStmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(selStmt, 3, trackId, -1, transientDestructor)
            sqlite3_bind_text(selStmt, 4, variant, -1, transientDestructor)
            if sqlite3_step(selStmt) == SQLITE_ROW {
                if let c = sqlite3_column_text(selStmt, 0) {
                    path = String(cString: c)
                }
            }

            let del = "DELETE FROM offline_tracks WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ?;"
            var delStmt: OpaquePointer?
            defer { sqlite3_finalize(delStmt) }
            guard sqlite3_prepare_v2(db, del, -1, &delStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(delStmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(delStmt, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(delStmt, 3, trackId, -1, transientDestructor)
            sqlite3_bind_text(delStmt, 4, variant, -1, transientDestructor)
            guard sqlite3_step(delStmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }

            if let path {
                try? FileManager.default.removeItem(atPath: path)
                if let resolved = try? offlineResolvePlaybackPath(
                    serverKey: serverKey,
                    libraryId: libraryId,
                    trackId: trackId,
                    variant: variant,
                    storedPath: path
                ), resolved != path {
                    try? FileManager.default.removeItem(atPath: resolved)
                }
            }
        }
    }

    static func offlineDeleteScope(serverKey: String, libraryId: String) throws {
        var offlinePaths: [String] = []
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }
            offlinePaths = try offlineCollectPathsForScope(db: db, serverKey: serverKey, libraryId: libraryId)
            let del = "DELETE FROM offline_tracks WHERE server_key = ? AND library_id = ?;"
            var delStmt: OpaquePointer?
            defer { sqlite3_finalize(delStmt) }
            guard sqlite3_prepare_v2(db, del, -1, &delStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(delStmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(delStmt, 2, libraryId, -1, transientDestructor)
            guard sqlite3_step(delStmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }
        }
        for p in offlinePaths {
            try? FileManager.default.removeItem(atPath: p)
        }
    }

    static func offlinePurgeServerKey(serverKey: String) throws {
        var offlinePaths: [String] = []
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }
            offlinePaths = try offlineCollectPathsForServer(db: db, serverKey: serverKey)
            let del = "DELETE FROM offline_tracks WHERE server_key = ?;"
            var delStmt: OpaquePointer?
            defer { sqlite3_finalize(delStmt) }
            guard sqlite3_prepare_v2(db, del, -1, &delStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(delStmt, 1, serverKey, -1, transientDestructor)
            guard sqlite3_step(delStmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }
        }
        for p in offlinePaths {
            try? FileManager.default.removeItem(atPath: p)
        }
    }

    static func offlineTotalBytes(serverKey: String?, libraryId: String?) throws -> Int64 {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql: String
            if let serverKey, let libraryId {
                sql = "SELECT COALESCE(SUM(byte_length),0) FROM offline_tracks WHERE server_key = ? AND library_id = ?;"
            } else if let serverKey {
                sql = "SELECT COALESCE(SUM(byte_length),0) FROM offline_tracks WHERE server_key = ?;"
            } else {
                sql = "SELECT COALESCE(SUM(byte_length),0) FROM offline_tracks;"
            }
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            if let serverKey, let libraryId {
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
            } else if let serverKey {
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            }
            guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
            return sqlite3_column_int64(stmt, 0)
        }
    }

    private static func offlineCollectPathsForScope(db: OpaquePointer, serverKey: String, libraryId: String) throws -> [String] {
        let sql = "SELECT abs_path FROM offline_tracks WHERE server_key = ? AND library_id = ?;"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.prepareFailed
        }
        sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
        sqlite3_bind_text(stmt, 2, libraryId, -1, transientDestructor)
        var paths: [String] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let c = sqlite3_column_text(stmt, 0) else { continue }
            paths.append(String(cString: c))
        }
        return paths
    }

    private static func offlineCollectPathsForServer(db: OpaquePointer, serverKey: String) throws -> [String] {
        let sql = "SELECT abs_path FROM offline_tracks WHERE server_key = ?;"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.prepareFailed
        }
        sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
        var paths: [String] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let c = sqlite3_column_text(stmt, 0) else { continue }
            paths.append(String(cString: c))
        }
        return paths
    }

    /// Deletes every cached row for this account `server_key` (all music folders / libraries).
    static func deleteAllScopesForServerKey(serverKey: String) throws {
        var offlinePaths: [String] = []
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var ok = false
            defer {
                _ = execute(db, ok ? "COMMIT;" : "ROLLBACK;")
            }

            offlinePaths = try offlineCollectPathsForServer(db: db, serverKey: serverKey)

            for table in [
                "library_songs", "library_playlists", "library_artworks",
                "library_artists", "library_albums", "library_meta", "offline_tracks"
            ] {
                let sql = "DELETE FROM \(table) WHERE server_key = ?;"
                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }
                guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
                sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
                guard sqlite3_step(stmt) == SQLITE_DONE else { return }
            }
            ok = true
        }
        for p in offlinePaths {
            try? FileManager.default.removeItem(atPath: p)
        }
    }

    // MARK: - Internals

    /// Copies rows from legacy `library_artwork` into `library_artworks` and drops the old table.
    private static func migrateLegacyArtworkTableIfNeeded(_ h: OpaquePointer) {
        let check = "SELECT 1 FROM sqlite_master WHERE type='table' AND name='library_artwork' LIMIT 1;"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(h, check, -1, &stmt, nil) == SQLITE_OK else { return }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return }

        let copySql = """
            INSERT OR IGNORE INTO library_artworks(server_key, library_id, cover_art_id, mime_type, image_bytes, updated_at)
            SELECT server_key, library_id, cover_art_id, mime_type, image_bytes, updated_at FROM library_artwork;
            """
        guard execute(h, copySql) else { return }
        _ = execute(h, "DROP TABLE library_artwork;")
    }

    private static func replaceIndexRows(
        db: OpaquePointer,
        serverKey: String,
        libraryId: String,
        table: String,
        idColumn: String,
        jsonColumn: String,
        rows: [[String: Any]]
    ) throws {
        var del: OpaquePointer?
        defer { sqlite3_finalize(del) }
        let delSql = "DELETE FROM \(table) WHERE server_key = ? AND library_id = ?;"
        guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }
        sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
        sqlite3_bind_text(del, 2, libraryId, -1, transientDestructor)
        guard sqlite3_step(del) == SQLITE_DONE else { return }

        let insSql = """
            INSERT INTO \(table)(server_key, library_id, \(idColumn), sort_index, \(jsonColumn))
            VALUES(?, ?, ?, ?, ?);
            """
        var ins: OpaquePointer?
        defer { sqlite3_finalize(ins) }
        guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

        for (index, row) in rows.enumerated() {
            guard let id = Self.jsonStringId(row["id"]), !id.isEmpty else { continue }
            let rowData = try JSONSerialization.data(withJSONObject: row, options: [])
            guard let rowJson = String(data: rowData, encoding: .utf8) else { continue }

            sqlite3_reset(ins)
            sqlite3_clear_bindings(ins)
            sqlite3_bind_text(ins, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(ins, 2, libraryId, -1, transientDestructor)
            sqlite3_bind_text(ins, 3, id, -1, transientDestructor)
            sqlite3_bind_int64(ins, 4, Int64(index))
            sqlite3_bind_text(ins, 5, rowJson, -1, transientDestructor)
            guard sqlite3_step(ins) == SQLITE_DONE else { return }
        }
    }

    private enum StoreError: LocalizedError {
        case databaseUnavailable
        case prepareFailed
        case transactionFailed
        case invalidJson
        case songNotFound

        var errorDescription: String? {
            switch self {
            case .databaseUnavailable: return "Library SQLite database could not be opened"
            case .prepareFailed: return "Library SQLite statement prepare failed"
            case .transactionFailed: return "Library SQLite transaction failed"
            case .invalidJson: return "Invalid JSON for library cache"
            case .songNotFound: return "Song not found in library cache"
            }
        }
    }

    private static func databaseURL() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let dir = base.appendingPathComponent("AsMusic").appendingPathComponent("Database")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("library-cache.sqlite3")
    }

    private static func openIfNeeded() throws {
        if db != nil { return }

        let url = try databaseURL()
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(url.path, &handle, flags, nil) == SQLITE_OK,
              let h = handle
        else {
            if let handle { sqlite3_close(handle) }
            db = nil
            throw StoreError.databaseUnavailable
        }
        db = h

        let ddl = """
            CREATE TABLE IF NOT EXISTS library_songs (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              song_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              song_json TEXT NOT NULL,
              PRIMARY KEY (server_key, library_id, song_id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_songs_scope ON library_songs(server_key, library_id);

            CREATE TABLE IF NOT EXISTS library_artists (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              artist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              artist_json TEXT NOT NULL,
              PRIMARY KEY (server_key, library_id, artist_id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_artists_scope ON library_artists(server_key, library_id);

            CREATE TABLE IF NOT EXISTS library_albums (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              album_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              album_json TEXT NOT NULL,
              PRIMARY KEY (server_key, library_id, album_id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_albums_scope ON library_albums(server_key, library_id);

            CREATE TABLE IF NOT EXISTS library_meta (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              last_sync_at REAL NOT NULL,
              song_count INTEGER NOT NULL,
              PRIMARY KEY (server_key, library_id)
            );

            CREATE TABLE IF NOT EXISTS library_playlists (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              name TEXT NOT NULL,
              song_count INTEGER NOT NULL,
              PRIMARY KEY (server_key, library_id, playlist_id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_playlists_scope ON library_playlists(server_key, library_id);

            CREATE TABLE IF NOT EXISTS library_artworks (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              cover_art_id TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              image_bytes BLOB NOT NULL,
              updated_at REAL NOT NULL,
              PRIMARY KEY (server_key, library_id, cover_art_id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_artworks_scope ON library_artworks(server_key, library_id);

            CREATE TABLE IF NOT EXISTS offline_tracks (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              track_id TEXT NOT NULL,
              variant TEXT NOT NULL,
              abs_path TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              byte_length INTEGER NOT NULL,
              updated_at REAL NOT NULL,
              PRIMARY KEY (server_key, library_id, track_id, variant)
            );
            CREATE INDEX IF NOT EXISTS idx_offline_tracks_scope ON offline_tracks(server_key, library_id);
            """
        guard execute(h, ddl) else {
            sqlite3_close(h)
            db = nil
            throw StoreError.databaseUnavailable
        }
        migrateLegacyArtworkTableIfNeeded(h)
        migrateCacheLayoutForAccountServerKeyIfNeeded(h)
    }

    /// Clears all rows once when upgrading to account-level `server_key` (matches JS `serverAccountKey`).
    private static func migrateCacheLayoutForAccountServerKeyIfNeeded(_ h: OpaquePointer) {
        var current: Int32 = 0
        var verStmt: OpaquePointer?
        if sqlite3_prepare_v2(h, "PRAGMA user_version;", -1, &verStmt, nil) == SQLITE_OK,
           sqlite3_step(verStmt) == SQLITE_ROW {
            current = sqlite3_column_int(verStmt, 0)
        }
        if verStmt != nil {
            sqlite3_finalize(verStmt)
        }

        guard current < 2 else { return }

        let tables = [
            "library_songs", "library_artists", "library_albums",
            "library_meta", "library_playlists", "library_artworks"
        ]
        for name in tables {
            _ = execute(h, "DELETE FROM \(name);")
        }
        _ = execute(h, "PRAGMA user_version = 2;")
    }

    private static func execute(_ db: OpaquePointer, _ sql: String) -> Bool {
        var err: UnsafeMutablePointer<CChar>?
        defer { sqlite3_free(err) }
        return sqlite3_exec(db, sql, nil, nil, &err) == SQLITE_OK
    }

    private static func jsonStringId(_ any: Any?) -> String? {
        switch any {
        case let s as String:
            return s
        case let i as Int:
            return String(i)
        case let n as NSNumber:
            return n.stringValue
        default:
            return nil
        }
    }

    private static func jsonInt(_ any: Any?) -> Int {
        switch any {
        case let i as Int:
            return i
        case let n as NSNumber:
            return n.intValue
        default:
            return 0
        }
    }

    /// JSON string literal (including quotes) for embedding in manually built JSON.
    private static func jsonQuotedString(_ value: String) throws -> String {
        let data = try JSONEncoder().encode(value)
        guard let quoted = String(data: data, encoding: .utf8) else {
            return "\"\""
        }
        return quoted
    }
}
