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

  private enum CodingKeys: String, CodingKey {
    case id
    case hostname
    case username
  }

  init(id: UUID = UUID(), hostname: String, username: String, password: String) {
    self.id = id
    self.hostname = hostname
    self.username = username
    self.password = password
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(UUID.self, forKey: .id)
    hostname = try container.decode(String.self, forKey: .hostname)
    username = try container.decode(String.self, forKey: .username)
    password = ""
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(hostname, forKey: .hostname)
    try container.encode(username, forKey: .username)
  }
}

@MainActor
@Observable
final class ServerManager {
  private struct LegacyServer: Codable {
    let id: UUID
    let hostname: String
    let username: String
    let password: String
  }

  private(set) var servers: [Server] = []

  private let defaults: UserDefaults
  private let storageKey = "asmusic.savedServers"

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    load()
  }

  func add(hostname: String, username: String, password: String) {
    var server = Server(
      hostname: hostname.trimmingCharacters(in: .whitespacesAndNewlines),
      username: username.trimmingCharacters(in: .whitespacesAndNewlines),
      password: password
    )
    _ = ServerCredentialsKeychain.setPassword(password, for: server.id)
    server.password = password
    servers.append(server)
    save()
  }

  func update(id: UUID, hostname: String, username: String, password: String) {
    guard let index = servers.firstIndex(where: { $0.id == id }) else { return }
    servers[index].hostname = hostname.trimmingCharacters(in: .whitespacesAndNewlines)
    servers[index].username = username.trimmingCharacters(in: .whitespacesAndNewlines)
    servers[index].password = password
    _ = ServerCredentialsKeychain.setPassword(password, for: id)
    save()
  }

  func delete(at offsets: IndexSet) {
    for index in offsets.sorted(by: >) {
      let server = servers.remove(at: index)
      ServerCredentialsKeychain.removePassword(for: server.id)
    }
    save()
  }

  private func load() {
    guard let data = defaults.data(forKey: storageKey) else { return }

    if let legacy = try? JSONDecoder().decode([LegacyServer].self, from: data) {
      servers = legacy.map { item in
        if ServerCredentialsKeychain.password(for: item.id) == nil {
          _ = ServerCredentialsKeychain.setPassword(item.password, for: item.id)
        }
        return Server(
          id: item.id,
          hostname: item.hostname,
          username: item.username,
          password: ServerCredentialsKeychain.password(for: item.id) ?? item.password
        )
      }
      save()
      return
    }

    guard let decoded = try? JSONDecoder().decode([Server].self, from: data) else { return }
    servers = decoded.map { item in
      Server(
        id: item.id,
        hostname: item.hostname,
        username: item.username,
        password: ServerCredentialsKeychain.password(for: item.id) ?? ""
      )
    }
  }

  private func save() {
    guard let encoded = try? JSONEncoder().encode(servers) else { return }
    defaults.set(encoded, forKey: storageKey)
  }
}
