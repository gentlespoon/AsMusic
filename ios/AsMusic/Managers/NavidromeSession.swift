//
//  NavidromeSession.swift
//  AsMusic
//
//  Created by An So on 2026-03-26.
//

import AsNavidromeKit
import Foundation
import Observation

@MainActor
@Observable
final class NavidromeSession {
  private(set) var client: AsNavidromeClient?
  private(set) var isConnecting = false
  private(set) var lastConnectionError: String?

  @discardableResult
  func testAndSetClient(hostname: String, username: String, password: String) async -> Bool {
    isConnecting = true
    defer { isConnecting = false }

    let normalizedHost = Self.normalizeHost(hostname)
    let candidate = AsNavidromeClient(host: normalizedHost, username: username, password: password)

    do {
      let isReachable = try await candidate.general.ping()
      if isReachable {
        client = candidate
        lastConnectionError = nil
        return true
      }
      lastConnectionError = "Server responded but ping status was not ok."
      return false
    } catch {
      lastConnectionError = error.localizedDescription
      return false
    }
  }

  private static func normalizeHost(_ value: String) -> String {
    return
      value.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }
}
