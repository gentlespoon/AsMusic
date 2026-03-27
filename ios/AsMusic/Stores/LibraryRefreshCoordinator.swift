//
//  LibraryRefreshCoordinator.swift
//  AsMusic
//

import Foundation
import Observation

@MainActor
@Observable
final class LibraryRefreshCoordinator {
  static let shared = LibraryRefreshCoordinator()

  private(set) var generation: UInt = 0

  func bump() {
    generation &+= 1
  }
}
