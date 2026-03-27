//
//  LibraryFoldersCacheStore.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import Foundation
import SQLite3

actor LibraryFoldersCacheStore {
  static let shared = LibraryFoldersCacheStore()
  nonisolated(unsafe) private static let transientDestructor = unsafeBitCast(
    -1,
    to: sqlite3_destructor_type.self
  )

  private var db: OpaquePointer?
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  /// `nil` when nothing has been stored for this server yet.
  func loadFolders(for serverID: UUID) -> [MusicFolder]? {
    guard openIfNeeded() else { return nil }

    let sql = "SELECT payload FROM music_folders_cache WHERE server_id = ? LIMIT 1;"
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }

    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      return nil
    }

    let idString = serverID.uuidString
    sqlite3_bind_text(statement, 1, idString, -1, Self.transientDestructor)
    guard sqlite3_step(statement) == SQLITE_ROW else {
      return nil
    }

    guard let rawPointer = sqlite3_column_blob(statement, 0) else {
      return nil
    }
    let size = Int(sqlite3_column_bytes(statement, 0))
    let data = Data(bytes: rawPointer, count: size)
    return try? decoder.decode([MusicFolder].self, from: data)
  }

  func saveFolders(_ folders: [MusicFolder], for serverID: UUID) {
    guard openIfNeeded() else { return }
    guard let payload = try? encoder.encode(folders) else { return }

    let sql = """
      INSERT INTO music_folders_cache(server_id, payload, updated_at)
      VALUES(?, ?, ?)
      ON CONFLICT(server_id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at;
      """

    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }

    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      return
    }

    let idString = serverID.uuidString
    sqlite3_bind_text(statement, 1, idString, -1, Self.transientDestructor)
    payload.withUnsafeBytes { buffer in
      sqlite3_bind_blob(
        statement,
        2,
        buffer.baseAddress,
        Int32(buffer.count),
        Self.transientDestructor
      )
    }
    sqlite3_bind_double(statement, 3, Date().timeIntervalSince1970)
    sqlite3_step(statement)
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

      let createTableSQL = """
        CREATE TABLE IF NOT EXISTS music_folders_cache (
          server_id TEXT PRIMARY KEY,
          payload BLOB NOT NULL,
          updated_at REAL NOT NULL
        );
        """
      guard sqlite3_exec(db, createTableSQL, nil, nil, nil) == SQLITE_OK else {
        sqlite3_close(db)
        db = nil
        return false
      }

      return true
    } catch {
      return false
    }
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
