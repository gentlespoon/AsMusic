//
//  SelectedLibraryStore.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation
import Observation

struct SelectedLibrary: Codable, Equatable, Sendable {
  var serverID: UUID
  var folderID: String
  var folderName: String
}

@MainActor
@Observable
final class SelectedLibraryStore {
  static let shared = SelectedLibraryStore()

  private(set) var selection: SelectedLibrary?

  private let defaults: UserDefaults
  private let storageKey = "asmusic.selectedLibrary"

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    load()
  }

  func setSelection(serverID: UUID, folder: MusicFolder) {
    selection = SelectedLibrary(
      serverID: serverID,
      folderID: folder.id,
      folderName: folder.name
    )
    save()
  }

  func clearSelection() {
    selection = nil
    defaults.removeObject(forKey: storageKey)
  }

  func isSelected(serverID: UUID, folderID: String) -> Bool {
    guard let selection else { return false }
    return selection.serverID == serverID && selection.folderID == folderID
  }

  /// Clears persisted selection if its server no longer exists.
  func validateAgainstSavedServers(_ servers: [Server]) {
    guard let selection else { return }
    guard servers.contains(where: { $0.id == selection.serverID }) else {
      clearSelection()
      return
    }
  }

  private func load() {
    guard let data = defaults.data(forKey: storageKey) else { return }
    guard let decoded = try? JSONDecoder().decode(SelectedLibrary.self, from: data) else { return }
    selection = decoded
  }

  private func save() {
    guard let selection else { return }
    guard let encoded = try? JSONEncoder().encode(selection) else { return }
    defaults.set(encoded, forKey: storageKey)
  }
}
