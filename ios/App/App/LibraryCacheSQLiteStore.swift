//
//  LibraryCacheSQLiteStore.swift
//  AsMusic — local library mirror for the Capacitor shell (parity with web IndexedDB + legacy iOS SQLite).
//

import AVFoundation
import Foundation
import SQLite3

/// On-device playback log (`Documents/asmusic-player-debug.log`) plus the Xcode/Console stream.
enum AsmusicPlayerDebugLog {
    static let filename = "asmusic-player-debug.log"
    private static let maxBytes = 262_144

    static func fileURL() -> URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent(filename)
    }

    static func append(_ message: String) {
        NSLog("[AsMusic][player] %@", message)
        let ms = Int64(Date().timeIntervalSince1970 * 1000)
        let line = "\(ms) [native] \(message)\n"
        guard let url = fileURL(), let data = line.data(using: .utf8) else { return }
        if FileManager.default.fileExists(atPath: url.path) {
            do {
                let handle = try FileHandle(forWritingTo: url)
                try handle.seekToEnd()
                try handle.write(contentsOf: data)
                try handle.close()
            } catch {
                NSLog("[AsMusic][player] log append failed: %@", String(describing: error))
            }
        } else {
            try? data.write(to: url)
        }
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? Int, size > maxBytes,
           let full = try? String(contentsOf: url, encoding: .utf8)
        {
            let trimmed = String(full.suffix(maxBytes))
            try? trimmed.data(using: .utf8)?.write(to: url)
        }
    }
}

/// Thread-safe SQLite access for library cache rows keyed by `(server_key, library_id)`.
enum LibraryCacheSQLiteStore {

    nonisolated(unsafe) private static let transientDestructor: sqlite3_destructor_type = unsafeBitCast(
        -1,
        to: sqlite3_destructor_type.self
    )

    private static var db: OpaquePointer?
    private static let queue = DispatchQueue(label: "works.asmusic.library-cache-sqlite", qos: .utility)
    /// Serializes full-file PCM waveform decodes so bulk offline imports cannot OOM.
    private static let waveformPrecomputeQueue = DispatchQueue(
        label: "works.asmusic.offline-waveform-precompute",
        qos: .utility
    )

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

    /// Removes derived album/artist rows for a scope (songs untouched). Prefer `replaceSongList`, which rebuilds indexes atomically.
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

    static func readPlaylistSummariesJson(serverKey: String) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT playlist_id, name, song_count FROM server_playlists
                WHERE server_key = ?
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)

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

    static func replacePlaylistSummaries(serverKey: String, playlistsJson: String) throws {
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
            let delSql = "DELETE FROM server_playlists WHERE server_key = ?;"
            guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
            guard sqlite3_step(del) == SQLITE_DONE else { return }

            let insSql = """
                INSERT INTO server_playlists(server_key, playlist_id, sort_index, name, song_count)
                VALUES(?, ?, ?, ?, ?);
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
                sqlite3_bind_text(ins, 2, pid, -1, transientDestructor)
                sqlite3_bind_int64(ins, 3, Int64(index))
                sqlite3_bind_text(ins, 4, name, -1, transientDestructor)
                sqlite3_bind_int64(ins, 5, Int64(sc))
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            shouldCommit = true
        }
    }

    static func readPlaylistEntryTrackIdsJson(serverKey: String, playlistId: String) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT track_id FROM server_playlist_tracks
                WHERE server_key = ? AND playlist_id = ?
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, playlistId, -1, transientDestructor)

            var parts: [String] = []
            parts.append("[")
            var first = true
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let tidC = sqlite3_column_text(stmt, 0) else { continue }
                let tid = String(cString: tidC)
                let tidStr = try jsonQuotedString(tid)
                if !first { parts.append(",") }
                first = false
                parts.append(tidStr)
            }
            parts.append("]")
            return parts.joined()
        }
    }

    static func replacePlaylistEntryTrackIds(
        serverKey: String,
        playlistId: String,
        trackIdsJson: String
    ) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = trackIdsJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let trackIds = raw as? [Any] else { throw StoreError.invalidJson }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer {
                _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;")
            }

            var del: OpaquePointer?
            defer { sqlite3_finalize(del) }
            let delSql = """
                DELETE FROM server_playlist_tracks
                WHERE server_key = ? AND playlist_id = ?;
                """
            guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
            sqlite3_bind_text(del, 2, playlistId, -1, transientDestructor)
            guard sqlite3_step(del) == SQLITE_DONE else { return }

            let insSql = """
                INSERT INTO server_playlist_tracks(server_key, playlist_id, sort_index, track_id)
                VALUES(?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

            for (index, rawId) in trackIds.enumerated() {
                let tid = Self.jsonStringId(rawId) ?? ""
                if tid.isEmpty { continue }
                sqlite3_reset(ins)
                sqlite3_clear_bindings(ins)
                sqlite3_bind_text(ins, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(ins, 2, playlistId, -1, transientDestructor)
                sqlite3_bind_int64(ins, 3, Int64(index))
                sqlite3_bind_text(ins, 4, tid, -1, transientDestructor)
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            shouldCommit = true
        }
    }

    static func purgePlaylistEntryTrackIdsNotIn(
        serverKey: String,
        playlistIdsJson: String
    ) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = playlistIdsJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let playlistIds = raw as? [Any] else { throw StoreError.invalidJson }
            let keep = Set(playlistIds.compactMap { Self.jsonStringId($0) })

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer {
                _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;")
            }

            let sql = """
                SELECT DISTINCT playlist_id FROM server_playlist_tracks
                WHERE server_key = ?;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, serverKey, -1, transientDestructor)

            var toDelete: [String] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let pidC = sqlite3_column_text(stmt, 0) else { continue }
                let pid = String(cString: pidC)
                if !keep.contains(pid) {
                    toDelete.append(pid)
                }
            }

            var del: OpaquePointer?
            defer { sqlite3_finalize(del) }
            let delSql = """
                DELETE FROM server_playlist_tracks
                WHERE server_key = ? AND playlist_id = ?;
                """
            guard sqlite3_prepare_v2(db, delSql, -1, &del, nil) == SQLITE_OK else { return }

            for pid in toDelete {
                sqlite3_reset(del)
                sqlite3_clear_bindings(del)
                sqlite3_bind_text(del, 1, serverKey, -1, transientDestructor)
                sqlite3_bind_text(del, 2, pid, -1, transientDestructor)
                guard sqlite3_step(del) == SQLITE_DONE else { return }
            }

            shouldCommit = true
        }
    }

    // MARK: - Local playlists (device-only)

    static func readLocalPlaylistSummariesJson() throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT playlist_id, name, track_count, created_at, updated_at
                FROM local_playlists
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }

            var parts: [String] = []
            parts.append("[")
            var first = true
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let pidC = sqlite3_column_text(stmt, 0),
                      let nameC = sqlite3_column_text(stmt, 1) else { continue }
                let pid = String(cString: pidC)
                let name = String(cString: nameC)
                let tc = Int(sqlite3_column_int64(stmt, 2))
                let created = sqlite3_column_double(stmt, 3)
                let updated = sqlite3_column_double(stmt, 4)
                let pidStr = try jsonQuotedString(pid)
                let nameStr = try jsonQuotedString(name)
                if !first { parts.append(",") }
                first = false
                parts.append(
                    "{\"id\":\(pidStr),\"name\":\(nameStr),\"trackCount\":\(tc),\"createdAt\":\(created),\"updatedAt\":\(updated)}"
                )
            }
            parts.append("]")
            return parts.joined()
        }
    }

    static func readLocalPlaylistEntriesJson(playlistId: String) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT sort_index, server_key, library_id, track_id, title, artist, album, cover_art_id
                FROM local_playlist_entries
                WHERE playlist_id = ?
                ORDER BY sort_index ASC;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, playlistId, -1, transientDestructor)

            var parts: [String] = []
            parts.append("[")
            var first = true
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let skC = sqlite3_column_text(stmt, 1),
                      let libC = sqlite3_column_text(stmt, 2),
                      let tidC = sqlite3_column_text(stmt, 3) else { continue }
                let sortIndex = Int(sqlite3_column_int64(stmt, 0))
                let sk = String(cString: skC)
                let lib = String(cString: libC)
                let tid = String(cString: tidC)
                let title = sqlite3_column_text(stmt, 4).map { String(cString: $0) }
                let artist = sqlite3_column_text(stmt, 5).map { String(cString: $0) }
                let album = sqlite3_column_text(stmt, 6).map { String(cString: $0) }
                let cover = sqlite3_column_text(stmt, 7).map { String(cString: $0) }

                if !first { parts.append(",") }
                first = false
                var obj = "{\"sortIndex\":\(sortIndex),\"serverKey\":\(try jsonQuotedString(sk)),\"libraryId\":\(try jsonQuotedString(lib)),\"trackId\":\(try jsonQuotedString(tid))"
                if let title, !title.isEmpty {
                    obj += ",\"title\":\(try jsonQuotedString(title))"
                }
                if let artist, !artist.isEmpty {
                    obj += ",\"artist\":\(try jsonQuotedString(artist))"
                }
                if let album, !album.isEmpty {
                    obj += ",\"album\":\(try jsonQuotedString(album))"
                }
                if let cover, !cover.isEmpty {
                    obj += ",\"coverArtId\":\(try jsonQuotedString(cover))"
                }
                obj += "}"
                parts.append(obj)
            }
            parts.append("]")
            return parts.joined()
        }
    }

    static func createLocalPlaylist(name: String, playlistId: String, createdAt: Double) throws -> String {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }
            let sortIndex = try localPlaylistCountLocked()
            let sql = """
                INSERT INTO local_playlists(playlist_id, name, track_count, created_at, updated_at, sort_index)
                VALUES(?, ?, 0, ?, ?, ?);
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, playlistId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 2, name, -1, transientDestructor)
            sqlite3_bind_double(stmt, 3, createdAt)
            sqlite3_bind_double(stmt, 4, createdAt)
            sqlite3_bind_int64(stmt, 5, Int64(sortIndex))
            guard sqlite3_step(stmt) == SQLITE_DONE else { throw StoreError.transactionFailed }
            let pidStr = try jsonQuotedString(playlistId)
            let nameStr = try jsonQuotedString(name)
            return "{\"id\":\(pidStr),\"name\":\(nameStr),\"trackCount\":0,\"createdAt\":\(createdAt),\"updatedAt\":\(createdAt)}"
        }
    }

    static func renameLocalPlaylist(playlistId: String, name: String, updatedAt: Double) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }
            let sql = "UPDATE local_playlists SET name = ?, updated_at = ? WHERE playlist_id = ?;"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, name, -1, transientDestructor)
            sqlite3_bind_double(stmt, 2, updatedAt)
            sqlite3_bind_text(stmt, 3, playlistId, -1, transientDestructor)
            guard sqlite3_step(stmt) == SQLITE_DONE else { throw StoreError.transactionFailed }
            if sqlite3_changes(db) == 0 { throw StoreError.songNotFound }
        }
    }

    static func deleteLocalPlaylist(playlistId: String) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }
            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer { _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;") }

            var delEntries: OpaquePointer?
            defer { sqlite3_finalize(delEntries) }
            guard sqlite3_prepare_v2(db, "DELETE FROM local_playlist_entries WHERE playlist_id = ?;", -1, &delEntries, nil) == SQLITE_OK else {
                return
            }
            sqlite3_bind_text(delEntries, 1, playlistId, -1, transientDestructor)
            guard sqlite3_step(delEntries) == SQLITE_DONE else { return }

            var delPl: OpaquePointer?
            defer { sqlite3_finalize(delPl) }
            guard sqlite3_prepare_v2(db, "DELETE FROM local_playlists WHERE playlist_id = ?;", -1, &delPl, nil) == SQLITE_OK else {
                return
            }
            sqlite3_bind_text(delPl, 1, playlistId, -1, transientDestructor)
            guard sqlite3_step(delPl) == SQLITE_DONE else { return }
            shouldCommit = true
        }
    }

    static func replaceLocalPlaylistEntries(playlistId: String, entriesJson: String, updatedAt: Double) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = entriesJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let entries = raw as? [[String: Any]] else { throw StoreError.invalidJson }

            guard execute(db, "BEGIN IMMEDIATE;") else { throw StoreError.transactionFailed }
            var shouldCommit = false
            defer { _ = execute(db, shouldCommit ? "COMMIT;" : "ROLLBACK;") }

            var del: OpaquePointer?
            defer { sqlite3_finalize(del) }
            guard sqlite3_prepare_v2(db, "DELETE FROM local_playlist_entries WHERE playlist_id = ?;", -1, &del, nil) == SQLITE_OK else {
                return
            }
            sqlite3_bind_text(del, 1, playlistId, -1, transientDestructor)
            guard sqlite3_step(del) == SQLITE_DONE else { return }

            let insSql = """
                INSERT INTO local_playlist_entries(
                  playlist_id, sort_index, server_key, library_id, track_id, title, artist, album, cover_art_id
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else { return }

            for (index, entry) in entries.enumerated() {
                let sk = (entry["serverKey"] as? String) ?? ""
                let lib = (entry["libraryId"] as? String) ?? ""
                let tid = Self.jsonStringId(entry["trackId"]) ?? ""
                if sk.isEmpty || lib.isEmpty || tid.isEmpty { continue }
                let title = entry["title"] as? String
                let artist = entry["artist"] as? String
                let album = entry["album"] as? String
                let cover = entry["coverArtId"] as? String

                sqlite3_reset(ins)
                sqlite3_clear_bindings(ins)
                sqlite3_bind_text(ins, 1, playlistId, -1, transientDestructor)
                sqlite3_bind_int64(ins, 2, Int64(index))
                sqlite3_bind_text(ins, 3, sk, -1, transientDestructor)
                sqlite3_bind_text(ins, 4, lib, -1, transientDestructor)
                sqlite3_bind_text(ins, 5, tid, -1, transientDestructor)
                sqlite3_bind_text(ins, 6, title, -1, transientDestructor)
                sqlite3_bind_text(ins, 7, artist, -1, transientDestructor)
                sqlite3_bind_text(ins, 8, album, -1, transientDestructor)
                sqlite3_bind_text(ins, 9, cover, -1, transientDestructor)
                guard sqlite3_step(ins) == SQLITE_DONE else { return }
            }

            var upd: OpaquePointer?
            defer { sqlite3_finalize(upd) }
            let updSql = "UPDATE local_playlists SET track_count = ?, updated_at = ? WHERE playlist_id = ?;"
            guard sqlite3_prepare_v2(db, updSql, -1, &upd, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(upd, 1, Int64(entries.count))
            sqlite3_bind_double(upd, 2, updatedAt)
            sqlite3_bind_text(upd, 3, playlistId, -1, transientDestructor)
            guard sqlite3_step(upd) == SQLITE_DONE else { return }
            shouldCommit = true
        }
    }

    static func appendLocalPlaylistEntry(playlistId: String, entryJson: String, updatedAt: Double) throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            guard let data = entryJson.data(using: .utf8) else { throw StoreError.invalidJson }
            let raw = try JSONSerialization.jsonObject(with: data, options: [])
            guard let entry = raw as? [String: Any] else { throw StoreError.invalidJson }

            let sk = (entry["serverKey"] as? String) ?? ""
            let lib = (entry["libraryId"] as? String) ?? ""
            let tid = Self.jsonStringId(entry["trackId"]) ?? ""
            if sk.isEmpty || lib.isEmpty || tid.isEmpty { throw StoreError.invalidJson }

            let title = entry["title"] as? String
            let artist = entry["artist"] as? String
            let album = entry["album"] as? String
            let cover = entry["coverArtId"] as? String

            var dupStmt: OpaquePointer?
            defer { sqlite3_finalize(dupStmt) }
            let dupSql = """
                SELECT 1 FROM local_playlist_entries
                WHERE playlist_id = ? AND server_key = ? AND library_id = ? AND track_id = ?
                LIMIT 1;
                """
            guard sqlite3_prepare_v2(db, dupSql, -1, &dupStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(dupStmt, 1, playlistId, -1, transientDestructor)
            sqlite3_bind_text(dupStmt, 2, sk, -1, transientDestructor)
            sqlite3_bind_text(dupStmt, 3, lib, -1, transientDestructor)
            sqlite3_bind_text(dupStmt, 4, tid, -1, transientDestructor)
            if sqlite3_step(dupStmt) == SQLITE_ROW { return }

            var countStmt: OpaquePointer?
            defer { sqlite3_finalize(countStmt) }
            guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM local_playlist_entries WHERE playlist_id = ?;", -1, &countStmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(countStmt, 1, playlistId, -1, transientDestructor)
            guard sqlite3_step(countStmt) == SQLITE_ROW else { throw StoreError.prepareFailed }
            let sortIndex = Int(sqlite3_column_int64(countStmt, 0))

            let insSql = """
                INSERT INTO local_playlist_entries(
                  playlist_id, sort_index, server_key, library_id, track_id, title, artist, album, cover_art_id
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);
                """
            var ins: OpaquePointer?
            defer { sqlite3_finalize(ins) }
            guard sqlite3_prepare_v2(db, insSql, -1, &ins, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(ins, 1, playlistId, -1, transientDestructor)
            sqlite3_bind_int64(ins, 2, Int64(sortIndex))
            sqlite3_bind_text(ins, 3, sk, -1, transientDestructor)
            sqlite3_bind_text(ins, 4, lib, -1, transientDestructor)
            sqlite3_bind_text(ins, 5, tid, -1, transientDestructor)
            sqlite3_bind_text(ins, 6, title, -1, transientDestructor)
            sqlite3_bind_text(ins, 7, artist, -1, transientDestructor)
            sqlite3_bind_text(ins, 8, album, -1, transientDestructor)
            sqlite3_bind_text(ins, 9, cover, -1, transientDestructor)
            guard sqlite3_step(ins) == SQLITE_DONE else { throw StoreError.transactionFailed }

            var upd: OpaquePointer?
            defer { sqlite3_finalize(upd) }
            let updSql = "UPDATE local_playlists SET track_count = track_count + 1, updated_at = ? WHERE playlist_id = ?;"
            guard sqlite3_prepare_v2(db, updSql, -1, &upd, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_double(upd, 1, updatedAt)
            sqlite3_bind_text(upd, 2, playlistId, -1, transientDestructor)
            guard sqlite3_step(upd) == SQLITE_DONE else { throw StoreError.transactionFailed }
        }
    }

    static func localPlaylistCount() throws -> Int {
        try queue.sync {
            try localPlaylistCountLocked()
        }
    }

    /// Caller must already hold `queue` (do not call `queue.sync` from inside `queue.sync`).
    private static func localPlaylistCountLocked() throws -> Int {
        try openIfNeeded()
        guard let db else { throw StoreError.databaseUnavailable }
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM local_playlists;", -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.prepareFailed
        }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int64(stmt, 0))
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
        try clearArtworkMaterializedFiles(serverKey: serverKey, libraryId: libraryId)
    }

    static func purgeAllArtwork() throws {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = "DELETE FROM library_artworks;"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.transactionFailed
            }
        }
        try purgeAllArtworkMaterializedFiles()
    }

    private static func artworkScopeCacheDir(serverKey: String, libraryId: String) -> URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return caches
            .appendingPathComponent("asmusic-artwork", isDirectory: true)
            .appendingPathComponent(serverKey, isDirectory: true)
            .appendingPathComponent(libraryId, isDirectory: true)
    }

    private static func artworkFileExtension(mimeType: String) -> String {
        let lower = mimeType.lowercased()
        if lower.contains("png") { return "png" }
        if lower.contains("webp") { return "webp" }
        return "jpg"
    }

    private static func artworkSafeFileName(coverArtId: String) -> String {
        let trimmed = coverArtId.trimmingCharacters(in: .whitespacesAndNewlines)
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: allowed) ?? trimmed
        return encoded.isEmpty ? "cover" : encoded
    }

    private static func artworkFileURL(
        serverKey: String,
        libraryId: String,
        coverArtId: String,
        mimeType: String
    ) -> URL {
        let dir = artworkScopeCacheDir(serverKey: serverKey, libraryId: libraryId)
        let name = artworkSafeFileName(coverArtId: coverArtId)
        let ext = artworkFileExtension(mimeType: mimeType)
        return dir.appendingPathComponent("\(name).\(ext)")
    }

    static func clearArtworkMaterializedFiles(serverKey: String, libraryId: String) throws {
        let dir = artworkScopeCacheDir(serverKey: serverKey, libraryId: libraryId)
        if FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.removeItem(at: dir)
        }
    }

    static func purgeAllArtworkMaterializedFiles() throws {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dir = caches.appendingPathComponent("asmusic-artwork", isDirectory: true)
        if FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.removeItem(at: dir)
        }
    }

    private static func deleteMaterializedArtworkFile(
        serverKey: String,
        libraryId: String,
        coverArtId: String
    ) throws {
        let dir = artworkScopeCacheDir(serverKey: serverKey, libraryId: libraryId)
        guard FileManager.default.fileExists(atPath: dir.path) else { return }
        let prefix = artworkSafeFileName(coverArtId: coverArtId) + "."
        for url in try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
            if url.lastPathComponent.hasPrefix(prefix) {
                try? FileManager.default.removeItem(at: url)
            }
        }
    }

    static func putArtworkBlob(
        serverKey: String,
        libraryId: String,
        coverArtId: String,
        mimeType: String,
        base64: String
    ) throws {
        let payload: [[String: String]] = [[
            "coverArtId": coverArtId,
            "mimeType": mimeType,
            "base64": base64,
        ]]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [])
        guard let json = String(data: data, encoding: .utf8) else { throw StoreError.invalidJson }
        try putArtworkBatch(serverKey: serverKey, libraryId: libraryId, entriesJson: json)
        try deleteMaterializedArtworkFile(serverKey: serverKey, libraryId: libraryId, coverArtId: coverArtId)
    }

    static func materializeArtworkFile(
        serverKey: String,
        libraryId: String,
        coverArtId: String
    ) throws -> (localFilePath: String, mimeType: String)? {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT mime_type, image_bytes, updated_at FROM library_artworks
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
            let imageData = Data(bytes: blobPtr, count: Int(nbytes))
            let updatedAt = sqlite3_column_double(stmt, 2)

            let fileURL = artworkFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                coverArtId: coverArtId,
                mimeType: mime
            )
            let fm = FileManager.default
            try fm.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            if fm.fileExists(atPath: fileURL.path) {
                let attrs = try fm.attributesOfItem(atPath: fileURL.path)
                if let modified = attrs[.modificationDate] as? Date,
                   abs(modified.timeIntervalSince1970 - updatedAt) < 1.0 {
                    return (localFilePath: fileURL.path, mimeType: mime)
                }
            }
            try imageData.write(to: fileURL, options: .atomic)
            try fm.setAttributes([.modificationDate: Date(timeIntervalSince1970: updatedAt)], ofItemAtPath: fileURL.path)
            return (localFilePath: fileURL.path, mimeType: mime)
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
                "library_songs", "library_artworks",
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

    private static let offlineKnownAudioExtensions: Set<String> = [
        "mp3", "m4a", "flac", "ogg", "opus", "wav", "aac", "mp4", "aiff", "aif", "caf", "alac",
    ]

    /// Containers AVPlayer requires to begin at byte 0. A leading ID3 tag makes these fail with
    /// "Operation Stopped" even when the bytes after the tag are valid.
    private static let offlineContainersNeedingCleanStart: Set<String> = [
        "flac", "wav", "aiff", "m4a", "ogg", "opus", "caf",
    ]

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
        case "audio/aiff", "audio/x-aiff", "audio/aifc":
            return "aiff"
        case "audio/x-caf", "audio/caf":
            return "caf"
        case "audio/alac", "audio/x-alac":
            return "m4a"
        case "audio/opus":
            return "opus"
        default:
            return "mp3"
        }
    }

    private struct SniffedOfflineAudio {
        var fileExtension: String
        var prefixToStrip: Int
        var mimeType: String
    }

    private struct PreparedOfflineAudio {
        var path: String
        var mimeType: String?
        var rewritten: Bool
    }

    /// Total ID3v2 tag length including the 10-byte header (and v2.4 footer), or nil.
    private static func id3v2TotalLength(_ header: Data) -> Int? {
        guard header.count >= 10 else { return nil }
        guard header[0] == 0x49, header[1] == 0x44, header[2] == 0x33 else { return nil }
        let version = header[3]
        guard version == 2 || version == 3 || version == 4 else { return nil }
        let b0 = header[6], b1 = header[7], b2 = header[8], b3 = header[9]
        if (b0 | b1 | b2 | b3) & 0x80 != 0 { return nil }
        let size = (Int(b0) << 21) | (Int(b1) << 14) | (Int(b2) << 7) | Int(b3)
        var total = 10 + size
        if version == 4, (header[5] & 0x10) != 0 {
            total += 10
        }
        return total
    }

    private static func startsWith(_ data: Data, _ ascii: String) -> Bool {
        guard let bytes = ascii.data(using: .ascii), data.count >= bytes.count else { return false }
        return data.prefix(bytes.count) == bytes
    }

    private static func sniffAudioExtension(_ data: Data) -> String? {
        if startsWith(data, "fLaC") { return "flac" }
        if startsWith(data, "OggS") {
            if data.range(of: Data("OpusHead".utf8)) != nil { return "opus" }
            return "ogg"
        }
        if startsWith(data, "RIFF"), data.count >= 12,
           String(data: data.subdata(in: 8..<12), encoding: .ascii) == "WAVE" {
            return "wav"
        }
        if startsWith(data, "FORM"), data.count >= 12 {
            let form = String(data: data.subdata(in: 8..<12), encoding: .ascii)
            if form == "AIFF" || form == "AIFC" { return "aiff" }
        }
        if startsWith(data, "caff") { return "caf" }
        if startsWith(data, "wvpk") { return "wv" }
        if startsWith(data, "MAC ") { return "ape" }
        if startsWith(data, "DSD ") { return "dsf" }
        if startsWith(data, "FRM8") { return "dff" }
        if data.count >= 8, String(data: data.subdata(in: 4..<8), encoding: .ascii) == "ftyp" {
            return "m4a"
        }
        if data.count >= 4, Array(data.prefix(4)) == [0x30, 0x26, 0xB2, 0x75] {
            return "wma"
        }
        return mpegAudioExtension(data)
    }

    /// MP3 frame sync vs AAC ADTS. Layer bits of 00 are AAC; anything else here is MPEG audio.
    private static func mpegAudioExtension(_ data: Data) -> String? {
        guard data.count >= 2 else { return nil }
        let b0 = data[0]
        let b1 = data[1]
        guard b0 == 0xFF, (b1 & 0xE0) == 0xE0 else { return nil }
        let version = (b1 >> 3) & 0x03
        if version == 0x01 { return nil }
        let layer = (b1 >> 1) & 0x03
        if layer == 0 {
            guard (b1 & 0xF0) == 0xF0 else { return nil }
            return "aac"
        }
        return "mp3"
    }

    private static func mimeType(forAudioExtension ext: String) -> String {
        switch ext.lowercased() {
        case "mp3":
            return "audio/mpeg"
        case "m4a", "mp4", "alac":
            return "audio/mp4"
        case "aac":
            return "audio/aac"
        case "flac":
            return "audio/flac"
        case "ogg", "opus":
            return "audio/ogg"
        case "wav":
            return "audio/wav"
        case "aiff", "aif":
            return "audio/aiff"
        case "caf":
            return "audio/x-caf"
        case "wma":
            return "audio/x-ms-wma"
        case "ape":
            return "audio/x-ape"
        default:
            return "application/octet-stream"
        }
    }

    /// Reads magic bytes, skipping a leading ID3v2 tag. MP3/AAC keep the tag; FLAC, WAV, AIFF,
    /// M4A, and similar containers report it so playback can drop it.
    private static func sniffOfflineAudio(at path: String) -> SniffedOfflineAudio? {
        guard let handle = FileHandle(forReadingAtPath: path) else { return nil }
        defer { try? handle.close() }
        let fileSize: Int
        do {
            fileSize = Int(try handle.seekToEnd())
        } catch {
            return nil
        }
        guard fileSize >= 4 else { return nil }

        var offset = 0
        for _ in 0..<4 {
            do {
                try handle.seek(toOffset: UInt64(offset))
                guard let header = try handle.read(upToCount: 10), header.count == 10 else { break }
                guard let tagLen = id3v2TotalLength(header) else { break }
                let next = offset + tagLen
                guard next > offset, next < fileSize else { break }
                offset = next
            } catch {
                break
            }
        }

        do {
            try handle.seek(toOffset: UInt64(offset))
            guard let magic = try handle.read(upToCount: 4096), magic.count >= 4 else { return nil }
            let found = locateAudio(in: magic)
            guard let found else { return nil }
            let payloadStart = offset + found.byteOffset
            guard payloadStart < fileSize else { return nil }
            let strip = offlineContainersNeedingCleanStart.contains(found.fileExtension) ? payloadStart : 0
            guard strip < fileSize else { return nil }
            return SniffedOfflineAudio(
                fileExtension: found.fileExtension,
                prefixToStrip: strip,
                mimeType: mimeType(forAudioExtension: found.fileExtension)
            )
        } catch {
            return nil
        }
    }

    private struct LocatedAudio {
        var fileExtension: String
        var byteOffset: Int
    }

    /// Prefer a container or frame at byte 0. A short run of zero bytes before the magic is
    /// allowed. Do not scan deeper — ID3 artwork can contain those byte strings by coincidence.
    private static func locateAudio(in data: Data) -> LocatedAudio? {
        if let ext = sniffAudioExtension(data) {
            return LocatedAudio(fileExtension: ext, byteOffset: 0)
        }
        let scan = min(data.count, 16)
        guard scan > 1 else { return nil }
        for i in 1..<scan {
            guard data.prefix(i).allSatisfy({ $0 == 0 }) else { break }
            let slice = data.subdata(in: i..<data.count)
            if let ext = sniffAudioExtension(slice) {
                return LocatedAudio(fileExtension: ext, byteOffset: i)
            }
        }
        return nil
    }

    private static func writeDroppingPrefix(from src: String, to dst: String, prefix: Int) throws {
        let fm = FileManager.default
        if fm.fileExists(atPath: dst) {
            try fm.removeItem(atPath: dst)
        }
        guard fm.createFile(atPath: dst, contents: nil) else {
            throw StoreError.prepareFailed
        }
        let input = try FileHandle(forReadingFrom: URL(fileURLWithPath: src))
        defer { try? input.close() }
        let output = try FileHandle(forWritingTo: URL(fileURLWithPath: dst))
        defer { try? output.close() }
        if prefix > 0 {
            try input.seek(toOffset: UInt64(prefix))
        }
        while true {
            guard let chunk = try input.read(upToCount: 1_048_576), !chunk.isEmpty else { break }
            try output.write(contentsOf: chunk)
        }
    }

    private static func rewriteOfflineAudio(at path: String, sniffed: SniffedOfflineAudio) throws -> String {
        let currentExt = (path as NSString).pathExtension.lowercased()
        let dest = currentExt == sniffed.fileExtension
            ? path
            : (path as NSString).deletingPathExtension + ".\(sniffed.fileExtension)"
        let fm = FileManager.default
        if sniffed.prefixToStrip > 0 {
            let tmp = dest + ".rewrite"
            if fm.fileExists(atPath: tmp) {
                try fm.removeItem(atPath: tmp)
            }
            try writeDroppingPrefix(from: path, to: tmp, prefix: sniffed.prefixToStrip)
            if dest == path {
                let backup = path + ".bak"
                if fm.fileExists(atPath: backup) {
                    try fm.removeItem(atPath: backup)
                }
                try fm.moveItem(atPath: path, toPath: backup)
                do {
                    try fm.moveItem(atPath: tmp, toPath: path)
                    try fm.removeItem(atPath: backup)
                } catch {
                    if !fm.fileExists(atPath: path), fm.fileExists(atPath: backup) {
                        try? fm.moveItem(atPath: backup, toPath: path)
                    }
                    throw error
                }
            } else {
                if fm.fileExists(atPath: dest) {
                    try fm.removeItem(atPath: dest)
                }
                try fm.moveItem(atPath: tmp, toPath: dest)
                if fm.fileExists(atPath: path) {
                    try fm.removeItem(atPath: path)
                }
            }
            return dest
        }
        if dest == path { return path }
        if fm.fileExists(atPath: dest) {
            try fm.removeItem(atPath: dest)
        }
        try fm.moveItem(atPath: path, toPath: dest)
        return dest
    }

    /// Renames a download to the real container and strips a leading ID3 tag when AVPlayer cannot
    /// see past it. Safe to call more than once; a file that already matches is left in place.
    private static func prepareOfflineAudioFileForPlayback(at path: String) -> PreparedOfflineAudio {
        guard FileManager.default.fileExists(atPath: path) else {
            return PreparedOfflineAudio(path: path, mimeType: nil, rewritten: false)
        }
        guard let sniffed = sniffOfflineAudio(at: path) else {
            return PreparedOfflineAudio(path: path, mimeType: nil, rewritten: false)
        }
        let currentExt = (path as NSString).pathExtension.lowercased()
        let needsStrip = sniffed.prefixToStrip > 0
        let needsRename = currentExt != sniffed.fileExtension
        if !needsStrip && !needsRename {
            return PreparedOfflineAudio(path: path, mimeType: sniffed.mimeType, rewritten: false)
        }
        do {
            let newPath = try rewriteOfflineAudio(at: path, sniffed: sniffed)
            let fromName = URL(fileURLWithPath: path).lastPathComponent
            let toName = URL(fileURLWithPath: newPath).lastPathComponent
            AsmusicPlayerDebugLog.append(
                "offline repair \(fromName) -> \(toName) strip=\(sniffed.prefixToStrip) mime=\(sniffed.mimeType) bytes=\(fileByteLength(newPath))"
            )
            return PreparedOfflineAudio(path: newPath, mimeType: sniffed.mimeType, rewritten: true)
        } catch {
            let name = URL(fileURLWithPath: path).lastPathComponent
            AsmusicPlayerDebugLog.append(
                "offline repair failed \(name) \(error.localizedDescription)"
            )
            return PreparedOfflineAudio(path: path, mimeType: sniffed.mimeType, rewritten: false)
        }
    }

    /// Subsonic answers some failed streams with HTTP 200 and a short XML error body.
    /// Those bytes are not audio; AVPlayer reports them as "Operation Stopped".
    struct SubsonicErrorDocument {
        var code: Int?
        var message: String

        /// Handed to JS so the UI can explain the failure instead of quoting AVPlayer.
        var playbackToken: String {
            let codeText = code.map(String.init) ?? ""
            return "subsonic-error\u{1F}\(codeText)\u{1F}\(message)"
        }
    }

    static func subsonicErrorDocument(in data: Data) -> SubsonicErrorDocument? {
        var bytes = data
        if bytes.count >= 3, bytes[0] == 0xEF, bytes[1] == 0xBB, bytes[2] == 0xBF {
            bytes = bytes.subdata(in: 3..<bytes.count)
        }
        guard let text = String(data: bytes, encoding: .utf8) ?? String(data: bytes, encoding: .isoLatin1) else {
            return nil
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        let markup = lower.hasPrefix("<?xml")
            || lower.hasPrefix("<subsonic-response")
            || lower.hasPrefix("<html")
            || lower.hasPrefix("<!doctype")
            || lower.hasPrefix("{")
        guard markup else { return nil }
        let message = xmlAttribute("message", in: trimmed)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let code = xmlAttribute("code", in: trimmed).flatMap(Int.init)
        let resolved = (message?.isEmpty == false) ? message ?? "" : "Server returned an error instead of audio"
        return SubsonicErrorDocument(code: code, message: resolved)
    }

    private static func xmlAttribute(_ name: String, in text: String) -> String? {
        let needle = "\(name)=\""
        guard let start = text.range(of: needle) else { return nil }
        let rest = text[start.upperBound...]
        guard let end = rest.firstIndex(of: "\"") else { return nil }
        return String(rest[..<end])
    }

    private static func offlineErrorDocument(at path: String) -> SubsonicErrorDocument? {
        guard let handle = FileHandle(forReadingAtPath: path) else { return nil }
        defer { try? handle.close() }
        guard let data = try? handle.read(upToCount: 512), !data.isEmpty else { return nil }
        return subsonicErrorDocument(in: data)
    }

    /// Caller must already hold `queue`. Removes the row and file when the body is an error document.
    private static func discardOfflineErrorDocumentLocked(
        path: String,
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String
    ) throws -> Bool {
        guard let document = offlineErrorDocument(at: path) else { return false }
        let name = URL(fileURLWithPath: path).lastPathComponent
        AsmusicPlayerDebugLog.append("offline discard \(name) \(document.playbackToken)")
        let cacheKey = "\(serverKey)\t\(libraryId)\t\(trackId)\t\(variant)"
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .asmusicOfflineMediaDiscarded,
                object: nil,
                userInfo: ["cacheKey": cacheKey]
            )
        }
        try deleteOfflineTrackLocked(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            filePath: path
        )
        return true
    }

    /// Caller must already hold `queue`.
    private static func deleteOfflineTrackLocked(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        filePath: String?
    ) throws {
        try openIfNeeded()
        guard let db else { throw StoreError.databaseUnavailable }
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
        if let filePath {
            try? FileManager.default.removeItem(atPath: filePath)
        }
    }

    private static func fileByteLength(_ path: String) -> Int {
        let attrs = try? FileManager.default.attributesOfItem(atPath: path)
        return Int((attrs?[.size] as? NSNumber)?.int64Value ?? 0)
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
                fileExtension: "wav"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "aiff"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "aac"
            ).path,
            offlineFinalFileURL(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                fileExtension: "ogg"
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

    /// Makes a downloaded file something AVPlayer can open: real extension, and no leading ID3
    /// on containers that must start at byte 0. Legacy `*.audio` names are still renamed when
    /// the bytes cannot be identified.
    private static func normalizeOfflinePlaybackPath(
        _ path: String,
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        mimeType: String?
    ) throws -> String {
        let prepared = prepareOfflineAudioFileForPlayback(at: path)
        var result = prepared.path
        var storedMime = prepared.mimeType
        var rewritten = prepared.rewritten || prepared.path != path
        if !rewritten {
            let ext = (path as NSString).pathExtension.lowercased()
            if !offlineKnownAudioExtensions.contains(ext) {
                let targetExt = offlineFileExtension(
                    mimeType: mimeType ?? "audio/mpeg",
                    remoteUrl: URL(fileURLWithPath: path)
                )
                let dest = (path as NSString).deletingPathExtension + ".\(targetExt)"
                if path != dest {
                    let fm = FileManager.default
                    if !fm.fileExists(atPath: dest) {
                        try fm.copyItem(atPath: path, toPath: dest)
                    }
                    result = dest
                    storedMime = Self.mimeType(forAudioExtension: targetExt)
                    rewritten = true
                    AsmusicPlayerDebugLog.append(
                        "offline rename unknown ext \(URL(fileURLWithPath: path).lastPathComponent) -> \(URL(fileURLWithPath: dest).lastPathComponent) mime=\(storedMime ?? "-")"
                    )
                }
            }
        }
        if rewritten {
            try updateOfflineFileLocked(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                absPath: result,
                mimeType: storedMime,
                byteLength: fileByteLength(result)
            )
        }
        return result
    }

    /// Caller must already hold `queue` (do not call `queue.sync` from inside `queue.sync`).
    private static func updateOfflineFileLocked(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        absPath: String,
        mimeType: String?,
        byteLength: Int
    ) throws {
        try openIfNeeded()
        guard let db else { throw StoreError.databaseUnavailable }
        let sql = """
            UPDATE offline_tracks
            SET abs_path = ?, mime_type = COALESCE(?, mime_type), byte_length = ?
            WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ?;
            """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StoreError.prepareFailed
        }
        sqlite3_bind_text(stmt, 1, absPath, -1, transientDestructor)
        if let mimeType {
            sqlite3_bind_text(stmt, 2, mimeType, -1, transientDestructor)
        } else {
            sqlite3_bind_null(stmt, 2)
        }
        sqlite3_bind_int64(stmt, 3, Int64(byteLength))
        sqlite3_bind_text(stmt, 4, serverKey, -1, transientDestructor)
        sqlite3_bind_text(stmt, 5, libraryId, -1, transientDestructor)
        sqlite3_bind_text(stmt, 6, trackId, -1, transientDestructor)
        sqlite3_bind_text(stmt, 7, variant, -1, transientDestructor)
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
        if let document = offlineErrorDocument(at: dest.path) {
            try? fm.removeItem(at: dest)
            try? offlineDeleteOne(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            )
            AsmusicPlayerDebugLog.append("offline reject track=\(trackId) \(document.playbackToken)")
            throw StoreError.notAudio(document.message)
        }
        let prepared = prepareOfflineAudioFileForPlayback(at: dest.path)
        let absPath = prepared.path
        let storedMime = prepared.mimeType ?? mime
        let size = fileByteLength(absPath)
        let now = Date().timeIntervalSince1970

        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                INSERT INTO offline_tracks(server_key, library_id, track_id, variant, abs_path, mime_type, byte_length, updated_at, waveform_peaks_json, waveform_bar_count)
                VALUES(?,?,?,?,?,?,?,?,NULL,NULL)
                ON CONFLICT(server_key, library_id, track_id, variant) DO UPDATE SET
                  abs_path = excluded.abs_path,
                  mime_type = excluded.mime_type,
                  byte_length = excluded.byte_length,
                  updated_at = excluded.updated_at,
                  waveform_peaks_json = NULL,
                  waveform_bar_count = NULL;
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
            sqlite3_bind_text(stmt, 6, storedMime, -1, transientDestructor)
            sqlite3_bind_int64(stmt, 7, Int64(size))
            sqlite3_bind_double(stmt, 8, now)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }
        }

        let cacheKey = "\(serverKey)\t\(libraryId)\t\(trackId)\t\(variant)"
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .asmusicOfflineMediaReady,
                object: nil,
                userInfo: ["cacheKey": cacheKey]
            )
        }

        let sk = serverKey
        let lid = libraryId
        let tid = trackId
        let v = variant
        waveformPrecomputeQueue.async {
            try? precomputeOfflineWaveformPeaks(
                serverKey: sk,
                libraryId: lid,
                trackId: tid,
                variant: v,
                barCount: 96
            )
        }
    }

    static func offlineWaveformPeaks(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        barCount: Int
    ) throws -> [Double] {
        let bars = max(8, min(barCount, 512))
        if let cached = try readCachedOfflineWaveformPeaks(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            barCount: bars
        ) {
            return cached
        }
        guard let path = try offlinePlaybackFilePath(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant
        ) else {
            throw StoreError.databaseUnavailable
        }
        let peaks = try computeWaveformPeaks(filePath: path, barCount: bars)
        try persistOfflineWaveformPeaks(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            barCount: bars,
            peaks: peaks
        )
        return peaks
    }

    static func precomputeOfflineWaveformPeaks(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        barCount: Int
    ) throws {
        let bars = max(8, min(barCount, 512))
        if try readCachedOfflineWaveformPeaks(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            barCount: bars
        ) != nil {
            return
        }
        guard let path = try offlinePlaybackFilePath(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant
        ) else {
            return
        }
        let peaks = try computeWaveformPeaks(filePath: path, barCount: bars)
        try persistOfflineWaveformPeaks(
            serverKey: serverKey,
            libraryId: libraryId,
            trackId: trackId,
            variant: variant,
            barCount: bars,
            peaks: peaks
        )
    }

    private static func readCachedOfflineWaveformPeaks(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        barCount: Int
    ) throws -> [Double]? {
        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                SELECT waveform_peaks_json, waveform_bar_count FROM offline_tracks
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
            if sqlite3_column_type(stmt, 0) == SQLITE_NULL { return nil }
            guard let jsonC = sqlite3_column_text(stmt, 0) else { return nil }
            let storedBars = Int(sqlite3_column_int(stmt, 1))
            guard storedBars == barCount else { return nil }

            let jsonStr = String(cString: jsonC)
            guard let data = jsonStr.data(using: .utf8),
                  let arr = try JSONSerialization.jsonObject(with: data) as? [NSNumber]
            else {
                return nil
            }
            let peaks = arr.map { $0.doubleValue }
            guard !peaks.isEmpty else { return nil }
            return peaks
        }
    }

    private static func persistOfflineWaveformPeaks(
        serverKey: String,
        libraryId: String,
        trackId: String,
        variant: String,
        barCount: Int,
        peaks: [Double]
    ) throws {
        let jsonData = try JSONSerialization.data(withJSONObject: peaks)
        guard let jsonStr = String(data: jsonData, encoding: .utf8) else {
            throw StoreError.invalidJson
        }

        try queue.sync {
            try openIfNeeded()
            guard let db else { throw StoreError.databaseUnavailable }

            let sql = """
                UPDATE offline_tracks SET waveform_peaks_json = ?, waveform_bar_count = ?
                WHERE server_key = ? AND library_id = ? AND track_id = ? AND variant = ?;
                """
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw StoreError.prepareFailed
            }
            sqlite3_bind_text(stmt, 1, jsonStr, -1, transientDestructor)
            sqlite3_bind_int(stmt, 2, Int32(barCount))
            sqlite3_bind_text(stmt, 3, serverKey, -1, transientDestructor)
            sqlite3_bind_text(stmt, 4, libraryId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 5, trackId, -1, transientDestructor)
            sqlite3_bind_text(stmt, 6, variant, -1, transientDestructor)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.prepareFailed
            }
        }

        let cacheKey = "\(serverKey)\t\(libraryId)\t\(trackId)\t\(variant)"
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .asmusicWaveformPeaksReady,
                object: nil,
                userInfo: ["cacheKey": cacheKey]
            )
        }
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
            let playable = try normalizeOfflinePlaybackPath(
                resolved,
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant,
                mimeType: mime
            )
            if try discardOfflineErrorDocumentLocked(
                path: playable,
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            ) {
                return nil
            }
            return playable
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
            if try discardOfflineErrorDocumentLocked(
                path: resolved,
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            ) {
                return ["status": "none"]
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
                "library_songs", "server_playlists", "server_playlist_tracks", "library_artworks",
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
        case notAudio(String)

        var errorDescription: String? {
            switch self {
            case .databaseUnavailable: return "Library SQLite database could not be opened"
            case .prepareFailed: return "Library SQLite statement prepare failed"
            case .transactionFailed: return "Library SQLite transaction failed"
            case .invalidJson: return "Invalid JSON for library cache"
            case .songNotFound: return "Song not found in library cache"
            case .notAudio(let message): return message
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

            CREATE TABLE IF NOT EXISTS server_playlists (
              server_key TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              name TEXT NOT NULL,
              song_count INTEGER NOT NULL,
              PRIMARY KEY (server_key, playlist_id)
            );
            CREATE INDEX IF NOT EXISTS idx_server_playlists_server ON server_playlists(server_key);

            CREATE TABLE IF NOT EXISTS server_playlist_tracks (
              server_key TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              track_id TEXT NOT NULL,
              PRIMARY KEY (server_key, playlist_id, sort_index)
            );
            CREATE INDEX IF NOT EXISTS idx_server_playlist_tracks_playlist
              ON server_playlist_tracks(server_key, playlist_id);

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
              waveform_peaks_json TEXT,
              waveform_bar_count INTEGER,
              PRIMARY KEY (server_key, library_id, track_id, variant)
            );
            CREATE INDEX IF NOT EXISTS idx_offline_tracks_scope ON offline_tracks(server_key, library_id);

            CREATE TABLE IF NOT EXISTS local_playlists (
              playlist_id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              track_count INTEGER NOT NULL,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              sort_index INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_playlist_entries (
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              track_id TEXT NOT NULL,
              title TEXT,
              artist TEXT,
              album TEXT,
              cover_art_id TEXT,
              PRIMARY KEY (playlist_id, sort_index)
            );
            CREATE INDEX IF NOT EXISTS idx_local_playlist_entries_playlist ON local_playlist_entries(playlist_id);
            """
        guard execute(h, ddl) else {
            sqlite3_close(h)
            db = nil
            throw StoreError.databaseUnavailable
        }
        migrateLegacyArtworkTableIfNeeded(h)
        migrateCacheLayoutForAccountServerKeyIfNeeded(h)
        migrateOfflineTracksWaveformColumnsIfNeeded(h)
        migrateLibraryPlaylistTracksTableIfNeeded(h)
        migrateServerPlaylistsIfNeeded(h)
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

    private static func migrateOfflineTracksWaveformColumnsIfNeeded(_ h: OpaquePointer) {
        var current: Int32 = 0
        var verStmt: OpaquePointer?
        if sqlite3_prepare_v2(h, "PRAGMA user_version;", -1, &verStmt, nil) == SQLITE_OK,
           sqlite3_step(verStmt) == SQLITE_ROW {
            current = sqlite3_column_int(verStmt, 0)
        }
        if verStmt != nil {
            sqlite3_finalize(verStmt)
        }

        guard current < 3 else { return }

        _ = execute(h, "ALTER TABLE offline_tracks ADD COLUMN waveform_peaks_json TEXT;")
        _ = execute(h, "ALTER TABLE offline_tracks ADD COLUMN waveform_bar_count INTEGER;")
        _ = execute(h, "PRAGMA user_version = 3;")
    }

    private static func migrateLibraryPlaylistTracksTableIfNeeded(_ h: OpaquePointer) {
        var current: Int32 = 0
        var verStmt: OpaquePointer?
        if sqlite3_prepare_v2(h, "PRAGMA user_version;", -1, &verStmt, nil) == SQLITE_OK,
           sqlite3_step(verStmt) == SQLITE_ROW {
            current = sqlite3_column_int(verStmt, 0)
        }
        if verStmt != nil {
            sqlite3_finalize(verStmt)
        }

        guard current < 4 else { return }

        let ddl = """
            CREATE TABLE IF NOT EXISTS library_playlist_tracks (
              server_key TEXT NOT NULL,
              library_id TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              track_id TEXT NOT NULL,
              PRIMARY KEY (server_key, library_id, playlist_id, sort_index)
            );
            CREATE INDEX IF NOT EXISTS idx_library_playlist_tracks_playlist
              ON library_playlist_tracks(server_key, library_id, playlist_id);
            """
        _ = execute(h, ddl)
        _ = execute(h, "PRAGMA user_version = 4;")
    }

    /// Migrate per-library playlist rows to per-server tables (Subsonic playlists are account-wide).
    private static func migrateServerPlaylistsIfNeeded(_ h: OpaquePointer) {
        var current: Int32 = 0
        var verStmt: OpaquePointer?
        if sqlite3_prepare_v2(h, "PRAGMA user_version;", -1, &verStmt, nil) == SQLITE_OK,
           sqlite3_step(verStmt) == SQLITE_ROW {
            current = sqlite3_column_int(verStmt, 0)
        }
        if verStmt != nil {
            sqlite3_finalize(verStmt)
        }

        guard current < 5 else { return }

        let ddl = """
            CREATE TABLE IF NOT EXISTS server_playlists (
              server_key TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              name TEXT NOT NULL,
              song_count INTEGER NOT NULL,
              PRIMARY KEY (server_key, playlist_id)
            );
            CREATE INDEX IF NOT EXISTS idx_server_playlists_server ON server_playlists(server_key);

            CREATE TABLE IF NOT EXISTS server_playlist_tracks (
              server_key TEXT NOT NULL,
              playlist_id TEXT NOT NULL,
              sort_index INTEGER NOT NULL,
              track_id TEXT NOT NULL,
              PRIMARY KEY (server_key, playlist_id, sort_index)
            );
            CREATE INDEX IF NOT EXISTS idx_server_playlist_tracks_playlist
              ON server_playlist_tracks(server_key, playlist_id);
            """
        _ = execute(h, ddl)

        let copySummaries = """
            INSERT OR IGNORE INTO server_playlists(server_key, playlist_id, sort_index, name, song_count)
            SELECT server_key, playlist_id, sort_index, name, song_count FROM library_playlists;
            """
        _ = execute(h, copySummaries)

        let copyTracks = """
            INSERT OR IGNORE INTO server_playlist_tracks(server_key, playlist_id, sort_index, track_id)
            SELECT server_key, playlist_id, sort_index, track_id FROM library_playlist_tracks;
            """
        _ = execute(h, copyTracks)

        _ = execute(h, "DROP TABLE IF EXISTS library_playlists;")
        _ = execute(h, "DROP TABLE IF EXISTS library_playlist_tracks;")
        _ = execute(h, "PRAGMA user_version = 5;")
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

extension Notification.Name {
    static let asmusicWaveformPeaksReady = Notification.Name("AsmusicWaveformPeaksReady")
    static let asmusicOfflineMediaReady = Notification.Name("AsmusicOfflineMediaReady")
    static let asmusicOfflineMediaDiscarded = Notification.Name("AsmusicOfflineMediaDiscarded")
}
