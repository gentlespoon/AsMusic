//
//  SongCacheStore.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import Foundation
import SQLite3

actor SongCacheStore {
  static let shared = SongCacheStore()
  nonisolated(unsafe) private static let transientDestructor = unsafeBitCast(
    -1,
    to: sqlite3_destructor_type.self
  )

  private var db: OpaquePointer?
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  func loadSongs(serverID: UUID, libraryID: String) -> [Song]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT song_json
      FROM song_cache
      WHERE server_id = ? AND library_id = ?
      ORDER BY sort_index ASC;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }

    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      return nil
    }

    sqlite3_bind_text(statement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 2, libraryID, -1, Self.transientDestructor)

    var songs: [Song] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let rawPointer = sqlite3_column_blob(statement, 0) else {
        continue
      }
      let size = Int(sqlite3_column_bytes(statement, 0))
      let data = Data(bytes: rawPointer, count: size)
      guard let song = try? decoder.decode(Song.self, from: data) else {
        continue
      }
      songs.append(song)
    }
    return songs.isEmpty ? nil : songs
  }

  func saveSongs(_ songs: [Song], serverID: UUID, libraryID: String) {
    guard openIfNeeded() else { return }
    guard execute("BEGIN TRANSACTION;") else { return }
    var shouldCommit = false
    defer { _ = execute(shouldCommit ? "COMMIT;" : "ROLLBACK;") }

    let deleteSQL = "DELETE FROM song_cache WHERE server_id = ? AND library_id = ?;"
    var deleteStatement: OpaquePointer?
    defer { sqlite3_finalize(deleteStatement) }
    guard sqlite3_prepare_v2(db, deleteSQL, -1, &deleteStatement, nil) == SQLITE_OK else {
      return
    }
    sqlite3_bind_text(deleteStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(deleteStatement, 2, libraryID, -1, Self.transientDestructor)
    guard sqlite3_step(deleteStatement) == SQLITE_DONE else { return }

    guard !songs.isEmpty else {
      shouldCommit = true
      return
    }

    let insertSQL = """
      INSERT INTO song_cache(
        server_id, library_id, song_id, artist_id, album_id, artwork_id, song_json, sort_index, updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);
      """
    var insertStatement: OpaquePointer?
    defer { sqlite3_finalize(insertStatement) }
    guard sqlite3_prepare_v2(db, insertSQL, -1, &insertStatement, nil) == SQLITE_OK else {
      return
    }

    let updatedAt = Date().timeIntervalSince1970
    for (index, song) in songs.enumerated() {
      guard let songJSON = try? encoder.encode(song) else { return }
      sqlite3_reset(insertStatement)
      sqlite3_clear_bindings(insertStatement)
      sqlite3_bind_text(insertStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 2, libraryID, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 3, song.id, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 4, song.artistId ?? "", -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 5, song.albumId ?? "", -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 6, song.coverArt ?? "", -1, Self.transientDestructor)
      _ = songJSON.withUnsafeBytes { buffer in
        sqlite3_bind_blob(
          insertStatement,
          7,
          buffer.baseAddress,
          Int32(buffer.count),
          Self.transientDestructor
        )
      }
      sqlite3_bind_int64(insertStatement, 8, Int64(index))
      sqlite3_bind_double(insertStatement, 9, updatedAt)
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

      guard execute("""
        CREATE TABLE IF NOT EXISTS song_cache (
          server_id TEXT NOT NULL,
          library_id TEXT NOT NULL,
          song_id TEXT NOT NULL,
          artist_id TEXT NOT NULL,
          album_id TEXT NOT NULL,
          artwork_id TEXT NOT NULL,
          song_json BLOB NOT NULL,
          sort_index INTEGER NOT NULL,
          updated_at REAL NOT NULL,
          PRIMARY KEY (server_id, library_id, song_id)
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
