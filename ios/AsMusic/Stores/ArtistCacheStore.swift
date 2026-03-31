//
//  ArtistCacheStore.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation
import SQLite3

actor ArtistCacheStore {
  static let shared = ArtistCacheStore()
  nonisolated(unsafe) private static let transientDestructor = unsafeBitCast(
    -1,
    to: sqlite3_destructor_type.self
  )

  private var db: OpaquePointer?
  private let encoder = JSONEncoder()

  func loadArtists(serverID: UUID, libraryID: String) -> [Artist]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT artist_id, artist_name
      FROM artist_cache
      WHERE server_id = ? AND library_id = ?
      ORDER BY artist_name COLLATE NOCASE ASC;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return nil }
    sqlite3_bind_text(statement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 2, libraryID, -1, Self.transientDestructor)

    var artists: [Artist] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard
        let artistIDCString = sqlite3_column_text(statement, 0),
        let artistNameCString = sqlite3_column_text(statement, 1)
      else {
        continue
      }
      artists.append(
        Artist(id: String(cString: artistIDCString), name: String(cString: artistNameCString)))
    }
    return artists.isEmpty ? nil : artists
  }

  func loadArtistSummaries(serverID: UUID, libraryID: String) -> [ArtistSummary]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT
        artist.artist_id,
        artist.artist_name,
        COUNT(album.album_id)
      FROM artist_cache AS artist
      LEFT JOIN album_cache AS album
        ON album.server_id = artist.server_id
        AND album.library_id = artist.library_id
        AND album.artist_id = artist.artist_id
      WHERE artist.server_id = ? AND artist.library_id = ?
      GROUP BY artist.artist_id, artist.artist_name
      ORDER BY artist.artist_name COLLATE NOCASE ASC;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return nil }
    sqlite3_bind_text(statement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 2, libraryID, -1, Self.transientDestructor)

    var artists: [ArtistSummary] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard
        let artistIDCString = sqlite3_column_text(statement, 0),
        let artistNameCString = sqlite3_column_text(statement, 1)
      else {
        continue
      }
      artists.append(
        ArtistSummary(
          id: String(cString: artistIDCString),
          name: String(cString: artistNameCString),
          albumCount: Int(sqlite3_column_int64(statement, 2))
        )
      )
    }
    return artists.isEmpty ? nil : artists
  }

  func replaceArtists(
    _ artists: [Artist],
    albumIDsByArtistID: [String: [String]],
    serverID: UUID,
    libraryID: String
  ) {
    guard openIfNeeded() else { return }
    guard execute("BEGIN TRANSACTION;") else { return }
    var shouldCommit = false
    defer { _ = execute(shouldCommit ? "COMMIT;" : "ROLLBACK;") }

    let deleteSQL = "DELETE FROM artist_cache WHERE server_id = ? AND library_id = ?;"
    var deleteStatement: OpaquePointer?
    defer { sqlite3_finalize(deleteStatement) }
    guard sqlite3_prepare_v2(db, deleteSQL, -1, &deleteStatement, nil) == SQLITE_OK else { return }
    sqlite3_bind_text(deleteStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(deleteStatement, 2, libraryID, -1, Self.transientDestructor)
    guard sqlite3_step(deleteStatement) == SQLITE_DONE else { return }

    guard !artists.isEmpty else {
      shouldCommit = true
      return
    }

    let insertSQL = """
      INSERT INTO artist_cache(
        server_id, library_id, artist_id, artist_name, album_ids_json, updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?);
      """
    var insertStatement: OpaquePointer?
    defer { sqlite3_finalize(insertStatement) }
    guard sqlite3_prepare_v2(db, insertSQL, -1, &insertStatement, nil) == SQLITE_OK else { return }

    let updatedAt = Date().timeIntervalSince1970
    for artist in artists {
      sqlite3_reset(insertStatement)
      sqlite3_clear_bindings(insertStatement)
      sqlite3_bind_text(insertStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 2, libraryID, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 3, artist.id, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 4, artist.name, -1, Self.transientDestructor)
      let albumIDs = albumIDsByArtistID[artist.id] ?? []
      let albumIDsJSON = (try? encoder.encode(albumIDs)) ?? Data("[]".utf8)
      albumIDsJSON.withUnsafeBytes { buffer in
        sqlite3_bind_blob(
          insertStatement,
          5,
          buffer.baseAddress,
          Int32(buffer.count),
          Self.transientDestructor
        )
      }
      sqlite3_bind_double(insertStatement, 6, updatedAt)
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
      guard
        execute(
          """
          CREATE TABLE IF NOT EXISTS artist_cache (
            server_id TEXT NOT NULL,
            library_id TEXT NOT NULL,
            artist_id TEXT NOT NULL,
            artist_name TEXT NOT NULL,
            album_ids_json BLOB NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (server_id, library_id, artist_id)
          );
          """
        )
      else {
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
