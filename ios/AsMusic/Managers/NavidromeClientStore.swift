//
//  NavidromeClientStore.swift
//  AsMusic
//
//  Created by An So on 2026-03-27.
//

import AsNavidromeKit
import Foundation

actor NavidromeClientStore {
  static let shared = NavidromeClientStore()

  private struct CachedClient {
    let hostname: String
    let username: String
    let password: String
    let client: AsNavidromeClient
  }

  private var clients: [UUID: CachedClient] = [:]

  func client(for server: Server) -> AsNavidromeClient {
    if let cached = clients[server.id],
      cached.hostname == server.hostname,
      cached.username == server.username,
      cached.password == server.password
    {
      return cached.client
    }

    let client = AsNavidromeClient(
      host: server.hostname,
      username: server.username,
      password: server.password
    )
    clients[server.id] = CachedClient(
      hostname: server.hostname,
      username: server.username,
      password: server.password,
      client: client
    )
    return client
  }
}
