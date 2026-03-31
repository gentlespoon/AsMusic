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

  /// `nil` when nothing has been stored for this server yet.
  func loadFolders(for serverID: UUID) -> [MusicFolder]? {
    guard openIfNeeded() else { return nil }

    let sql = """
      SELECT folder_id, folder_name
      FROM music_folders_cache
      WHERE server_id = ?
      ORDER BY sort_index ASC;
      """
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }

    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      return nil
    }

    let idString = serverID.uuidString
    sqlite3_bind_text(statement, 1, idString, -1, Self.transientDestructor)
    var folders: [MusicFolder] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      guard
        let folderIDCString = sqlite3_column_text(statement, 0),
        let folderNameCString = sqlite3_column_text(statement, 1)
      else {
        continue
      }
      let folderID = String(cString: folderIDCString)
      let folderName = String(cString: folderNameCString)
      folders.append(MusicFolder(id: folderID, name: folderName))
    }
    return folders.isEmpty ? nil : folders
  }

  func saveFolders(_ folders: [MusicFolder], for serverID: UUID) {
    guard openIfNeeded() else { return }
    guard execute("BEGIN TRANSACTION;") else { return }
    var shouldCommit = false

    defer {
      _ = execute(shouldCommit ? "COMMIT;" : "ROLLBACK;")
    }

    let deleteSQL = "DELETE FROM music_folders_cache WHERE server_id = ?;"
    var deleteStatement: OpaquePointer?
    defer { sqlite3_finalize(deleteStatement) }

    guard sqlite3_prepare_v2(db, deleteSQL, -1, &deleteStatement, nil) == SQLITE_OK else {
      return
    }

    let idString = serverID.uuidString
    sqlite3_bind_text(deleteStatement, 1, idString, -1, Self.transientDestructor)
    guard sqlite3_step(deleteStatement) == SQLITE_DONE else {
      return
    }

    guard !folders.isEmpty else {
      shouldCommit = true
      return
    }

    let insertSQL = """
      INSERT INTO music_folders_cache(server_id, folder_id, folder_name, sort_index, updated_at)
      VALUES(?, ?, ?, ?, ?);
      """
    var insertStatement: OpaquePointer?
    defer { sqlite3_finalize(insertStatement) }

    guard sqlite3_prepare_v2(db, insertSQL, -1, &insertStatement, nil) == SQLITE_OK else {
      return
    }

    let updatedAt = Date().timeIntervalSince1970
    for (index, folder) in folders.enumerated() {
      sqlite3_reset(insertStatement)
      sqlite3_clear_bindings(insertStatement)
      sqlite3_bind_text(insertStatement, 1, idString, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 2, folder.id, -1, Self.transientDestructor)
      sqlite3_bind_text(insertStatement, 3, folder.name, -1, Self.transientDestructor)
      sqlite3_bind_int64(insertStatement, 4, Int64(index))
      sqlite3_bind_double(insertStatement, 5, updatedAt)
      guard sqlite3_step(insertStatement) == SQLITE_DONE else {
        return
      }
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

      guard migrateSchemaIfNeeded() else {
        sqlite3_close(db)
        db = nil
        return false
      }

      return true
    } catch {
      return false
    }
  }

  private func migrateSchemaIfNeeded() -> Bool {
    guard execute("""
      CREATE TABLE IF NOT EXISTS music_folders_cache (
        server_id TEXT NOT NULL,
        folder_id TEXT NOT NULL,
        folder_name TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        updated_at REAL NOT NULL,
        PRIMARY KEY (server_id, folder_id)
      );
      """
    ) else {
      return false
    }

    // If a previous payload-based schema exists, recreate with row-based storage.
    let existingColumns = tableColumns(for: "music_folders_cache")
    guard !existingColumns.contains("payload") else {
      guard execute("DROP TABLE IF EXISTS music_folders_cache;") else {
        return false
      }
      return execute("""
        CREATE TABLE IF NOT EXISTS music_folders_cache (
          server_id TEXT NOT NULL,
          folder_id TEXT NOT NULL,
          folder_name TEXT NOT NULL,
          sort_index INTEGER NOT NULL,
          updated_at REAL NOT NULL,
          PRIMARY KEY (server_id, folder_id)
        );
        """
      )
    }

    return existingColumns.contains("folder_id")
      && existingColumns.contains("folder_name")
      && existingColumns.contains("sort_index")
  }

  private func tableColumns(for tableName: String) -> Set<String> {
    let sql = "PRAGMA table_info(\(tableName));"
    var statement: OpaquePointer?
    defer { sqlite3_finalize(statement) }

    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
      return []
    }

    var columns = Set<String>()
    while sqlite3_step(statement) == SQLITE_ROW {
      guard let nameCString = sqlite3_column_text(statement, 1) else {
        continue
      }
      columns.insert(String(cString: nameCString))
    }
    return columns
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
