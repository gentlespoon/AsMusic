//
//  PlaylistSummaryCacheStore.swift
//  AsMusic
//
//  Created by AsMusic AI on 2026-03-30.
//

import AsNavidromeKit
import Foundation
import SQLite3

actor PlaylistSummaryCacheStore {
  static let shared = PlaylistSummaryCacheStore()

  nonisolated(unsafe) private static let transientDestructor = unsafeBitCast(
    -1,
    to: sqlite3_destructor_type.self
  )

  private var db: OpaquePointer?
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  func loadPlaylists(serverID: UUID, libraryID: String) -> [PlaylistSummary]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT playlist_json
      FROM playlist_cache
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

    var playlists: [PlaylistSummary] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let rawPointer = sqlite3_column_blob(statement, 0) else {
        continue
      }

      let size = Int(sqlite3_column_bytes(statement, 0))
      let data = Data(bytes: rawPointer, count: size)
      guard let playlist = try? decoder.decode(PlaylistSummary.self, from: data) else {
        continue
      }
      playlists.append(playlist)
    }

    return playlists.isEmpty ? nil : playlists
  }

  func savePlaylists(_ playlists: [PlaylistSummary], serverID: UUID, libraryID: String) {
    guard openIfNeeded() else { return }
    guard execute("BEGIN TRANSACTION;") else { return }
    var shouldCommit = false
    defer { _ = execute(shouldCommit ? "COMMIT;" : "ROLLBACK;") }

    let deleteSQL = "DELETE FROM playlist_cache WHERE server_id = ? AND library_id = ?;"
    var deleteStatement: OpaquePointer?
    defer { sqlite3_finalize(deleteStatement) }
    guard sqlite3_prepare_v2(db, deleteSQL, -1, &deleteStatement, nil) == SQLITE_OK else {
      return
    }
    sqlite3_bind_text(deleteStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(deleteStatement, 2, libraryID, -1, Self.transientDestructor)
    guard sqlite3_step(deleteStatement) == SQLITE_DONE else { return }

    guard !playlists.isEmpty else {
      shouldCommit = true
      return
    }

    let insertSQL = """
      INSERT INTO playlist_cache(
        server_id, library_id, playlist_id, playlist_json, song_list_json, sort_index, updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?);
      """
    var insertStatement: OpaquePointer?
    defer { sqlite3_finalize(insertStatement) }
    guard sqlite3_prepare_v2(db, insertSQL, -1, &insertStatement, nil) == SQLITE_OK else {
      return
    }

    let emptySongListJSON = (try? encoder.encode([Song]())) ?? Data("[]".utf8)
    let updatedAt = Date().timeIntervalSince1970
    for (index, playlist) in playlists.enumerated() {
      guard let playlistJSON = try? encoder.encode(playlist) else { return }
      sqlite3_reset(insertStatement)
      sqlite3_clear_bindings(insertStatement)
      sqlite3_bind_text(insertStatement, 1, serverID.uuidString, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 2, libraryID, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 3, playlist.id, -1, Self.transientDestructor)
      _ = playlistJSON.withUnsafeBytes { buffer in
        sqlite3_bind_blob(
          insertStatement, 4, buffer.baseAddress, Int32(buffer.count), Self.transientDestructor)
      }
      _ = emptySongListJSON.withUnsafeBytes { buffer in
        sqlite3_bind_blob(
          insertStatement, 5, buffer.baseAddress, Int32(buffer.count), Self.transientDestructor)
      }
      sqlite3_bind_int64(insertStatement, 6, Int64(index))
      sqlite3_bind_double(insertStatement, 7, updatedAt)
      guard sqlite3_step(insertStatement) == SQLITE_DONE else { return }
    }
    shouldCommit = true
  }

  func saveSongs(
    _ songs: [Song],
    forPlaylistID playlistID: String,
    serverID: UUID,
    libraryID: String
  ) {
    guard openIfNeeded() else { return }
    guard let songsJSON = try? encoder.encode(songs) else { return }

    let sql = """
      UPDATE playlist_cache
      SET song_list_json = ?, updated_at = ?
      WHERE server_id = ? AND library_id = ? AND playlist_id = ?;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }

    _ = songsJSON.withUnsafeBytes { buffer in
      sqlite3_bind_blob(
        statement, 1, buffer.baseAddress, Int32(buffer.count), Self.transientDestructor)
    }
    sqlite3_bind_double(statement, 2, Date().timeIntervalSince1970)
    sqlite3_bind_text(statement, 3, serverID.uuidString, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 4, libraryID, -1, Self.transientDestructor)
    sqlite3_bind_text(statement, 5, playlistID, -1, Self.transientDestructor)
    _ = sqlite3_step(statement)
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

      guard createSchemaIfNeeded() else {
        sqlite3_close(db)
        db = nil
        return false
      }

      return true
    } catch {
      return false
    }
  }

  private func createSchemaIfNeeded() -> Bool {
    execute("""
      CREATE TABLE IF NOT EXISTS playlist_cache (
        server_id TEXT NOT NULL,
        library_id TEXT NOT NULL,
        playlist_id TEXT NOT NULL,
        playlist_json BLOB NOT NULL,
        song_list_json BLOB NOT NULL,
        sort_index INTEGER NOT NULL,
        updated_at REAL NOT NULL,
        PRIMARY KEY (server_id, library_id, playlist_id)
      );
      """
    )
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

