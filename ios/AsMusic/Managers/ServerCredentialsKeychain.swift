//
//  ServerCredentialsKeychain.swift
//  AsMusic
//

import Foundation
import Security

enum ServerCredentialsKeychain {
  private static let service = "com.angdasoft.AsMusic.serverCredentials"
  private static let passwordAccountPrefix = "server-password."

  static func password(for serverID: UUID) -> String? {
    let account = passwordAccountPrefix + serverID.uuidString.lowercased()
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess else { return nil }
    guard let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  @discardableResult
  static func setPassword(_ password: String, for serverID: UUID) -> Bool {
    let account = passwordAccountPrefix + serverID.uuidString.lowercased()
    guard let data = password.data(using: .utf8) else { return false }

    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]

    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]

    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess {
      return true
    }

    if updateStatus == errSecItemNotFound {
      var insert = query
      insert[kSecValueData as String] = data
      insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      return SecItemAdd(insert as CFDictionary, nil) == errSecSuccess
    }

    return false
  }

  static func removePassword(for serverID: UUID) {
    let account = passwordAccountPrefix + serverID.uuidString.lowercased()
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}
