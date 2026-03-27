//
//  ServerManager.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import Foundation
import Observation

struct Server: Identifiable, Codable, Equatable {
  let id: UUID
  var hostname: String
  var username: String
  var password: String

  init(id: UUID = UUID(), hostname: String, username: String, password: String) {
    self.id = id
    self.hostname = hostname
    self.username = username
    self.password = password
  }
}

@MainActor
@Observable
final class ServerManager {
  private(set) var servers: [Server] = []

  private let defaults: UserDefaults
  private let storageKey = "asmusic.savedServers"

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    load()
  }

  func add(hostname: String, username: String, password: String) {
    let server = Server(
      hostname: hostname.trimmingCharacters(in: .whitespacesAndNewlines),
      username: username.trimmingCharacters(in: .whitespacesAndNewlines),
      password: password
    )
    servers.append(server)
    save()
  }

  func update(id: UUID, hostname: String, username: String, password: String) {
    guard let index = servers.firstIndex(where: { $0.id == id }) else { return }
    servers[index].hostname = hostname.trimmingCharacters(in: .whitespacesAndNewlines)
    servers[index].username = username.trimmingCharacters(in: .whitespacesAndNewlines)
    servers[index].password = password
    save()
  }

  func delete(at offsets: IndexSet) {
    for index in offsets.sorted(by: >) {
      servers.remove(at: index)
    }
    save()
  }

  private func load() {
    guard let data = defaults.data(forKey: storageKey) else { return }
    guard let decoded = try? JSONDecoder().decode([Server].self, from: data) else { return }
    servers = decoded
  }

  private func save() {
    guard let encoded = try? JSONEncoder().encode(servers) else { return }
    defaults.set(encoded, forKey: storageKey)
  }
}
