//
//  AlbumCacheStore.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation
import SQLite3

actor AlbumCacheStore {
  static let shared = AlbumCacheStore()
  nonisolated(unsafe) private static let transientDestructor = unsafeBitCast(
    -1,
    to: sqlite3_destructor_type.self
  )

  private var db: OpaquePointer?
  private let encoder = JSONEncoder()

  func loadAlbums(serverID: UUID, libraryID: String) -> [Album]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT album_id, album_name, artist_id, artwork_id
      FROM album_cache
      WHERE server_id = ? AND library_id = ?
      ORDER BY album_name COLLATE NOCASE ASC;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return nil }
    sqlite3_bind_text(statement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 2, libraryID, -1, Self.transientDestructor)

    var albums: [Album] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard
        let albumIDCString = sqlite3_column_text(statement, 0),
        let albumNameCString = sqlite3_column_text(statement, 1)
      else {
        continue
      }
      let artistID: String? = {
        guard let value = sqlite3_column_text(statement, 2) else { return nil }
        let s = String(cString: value)
        return s.isEmpty ? nil : s
      }()
      let artworkID: String? = {
        guard let value = sqlite3_column_text(statement, 3) else { return nil }
        let s = String(cString: value)
        return s.isEmpty ? nil : s
      }()
      albums.append(
        Album(
          id: String(cString: albumIDCString),
          name: String(cString: albumNameCString),
          artistId: artistID,
          coverArt: artworkID
        )
      )
    }
    return albums.isEmpty ? nil : albums
  }

  func replaceAlbums(
    _ albums: [Album],
    songIDsByAlbumID: [String: [String]],
    serverID: UUID,
    libraryID: String
  ) {
    guard openIfNeeded() else { return }
    guard execute("BEGIN TRANSACTION;") else { return }
    var shouldCommit = false
    defer { _ = execute(shouldCommit ? "COMMIT;" : "ROLLBACK;") }

    let deleteSQL = "DELETE FROM album_cache WHERE server_id = ? AND library_id = ?;"
    var deleteStatement: OpaquePointer?
    defer { sqlite3_finalize(deleteStatement) }
    guard sqlite3_prepare_v2(db, deleteSQL, -1, &deleteStatement, nil) == SQLITE_OK else { return }
    sqlite3_bind_text(deleteStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(deleteStatement, 2, libraryID, -1, Self.transientDestructor)
    guard sqlite3_step(deleteStatement) == SQLITE_DONE else { return }

    guard !albums.isEmpty else {
      shouldCommit = true
      return
    }

    let insertSQL = """
      INSERT INTO album_cache(
        server_id, library_id, album_id, album_name, artist_id, artwork_id, song_ids_json, updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?);
      """
    var insertStatement: OpaquePointer?
    defer { sqlite3_finalize(insertStatement) }
    guard sqlite3_prepare_v2(db, insertSQL, -1, &insertStatement, nil) == SQLITE_OK else { return }

    let updatedAt = Date().timeIntervalSince1970
    for album in albums {
      sqlite3_reset(insertStatement)
      sqlite3_clear_bindings(insertStatement)
      sqlite3_bind_text(insertStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 2, libraryID, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 3, album.id, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 4, album.name, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 5, album.artistId ?? "", -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 6, album.coverArt ?? "", -1, Self.transientDestructor)
      let songIDs = songIDsByAlbumID[album.id] ?? []
      let songIDsJSON = (try? encoder.encode(songIDs)) ?? Data("[]".utf8)
      songIDsJSON.withUnsafeBytes { buffer in
        sqlite3_bind_blob(
          insertStatement,
          7,
          buffer.baseAddress,
          Int32(buffer.count),
          Self.transientDestructor
        )
      }
      sqlite3_bind_double(insertStatement, 8, updatedAt)
      guard sqlite3_step(insertStatement) == SQLITE_DONE else { return }
    }
    shouldCommit = true
  }

  func closeDatabase() {
    guard db != nil else { return }
    sqlite3_close(db)
    db = nil
  }

  private func openIfNeeded() -> Bool {
    if db != nil { return true }
    do {
      let dbURL = try Self.databaseURL()
      let openResult = sqlite3_open(dbURL.path(percentEncoded: false), &db)
      guard openResult == SQLITE_OK else {
        if db != nil {
          sqlite3_close(db)
          db = nil
        }
        return false
      }
      guard execute("DROP TABLE IF EXISTS album_cache;") else {
        sqlite3_close(db)
        db = nil
        return false
      }
      guard execute("""
        CREATE TABLE album_cache (
          server_id TEXT NOT NULL,
          library_id TEXT NOT NULL,
          album_id TEXT NOT NULL,
          album_name TEXT NOT NULL,
          artist_id TEXT NOT NULL,
          artwork_id TEXT NOT NULL,
          song_ids_json BLOB NOT NULL,
          updated_at REAL NOT NULL,
          PRIMARY KEY (server_id, library_id, album_id)
        );
        """
      ) else {
        sqlite3_close(db)
        db = nil
        return false
      }
      return true
    } catch {
      return false
    }
  }

  private func execute(_ sql: String) -> Bool {
    sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK
  }

  private static func databaseURL() throws -> URL {
    let documents = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = documents.appending(path: "Database", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appending(path: "library-cache.sqlite3", directoryHint: .notDirectory)
  }
}

