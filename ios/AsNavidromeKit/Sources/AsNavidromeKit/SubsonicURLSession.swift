//
//  SubsonicURLSession.swift
//  AsNavidromeKit
//

import Foundation

enum SubsonicURLSession {
  /// Dedicated session so timeouts, connection limits, and behavior are explicit (not `URLSession.shared`).
  nonisolated(unsafe) static let shared: URLSession = {
    let configuration = URLSessionConfiguration.default
    configuration.httpMaximumConnectionsPerHost = 6
    configuration.timeoutIntervalForRequest = 60
    configuration.timeoutIntervalForResource = 600
    configuration.waitsForConnectivity = true
    return URLSession(configuration: configuration)
  }()
}
