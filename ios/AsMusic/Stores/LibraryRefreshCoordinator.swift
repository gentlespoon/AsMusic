//
//  LibraryRefreshCoordinator.swift
//  AsMusic
//

import Foundation
import Observation

enum LibraryServerReloadStep: Equatable, Sendable {
  case loadingSongs
  case loadingPlaylists
  case savingCaches
}

@MainActor
@Observable
final class LibraryRefreshCoordinator {
  static let shared = LibraryRefreshCoordinator()

  private(set) var generation: UInt = 0

  /// Full library fetch from the server (songs + playlists + local index rebuild).
  private(set) var isReloadingFromServer = false
  /// Cumulative songs received from the server during the current reload (0 when idle).
  private(set) var songsLoadedSoFar = 0
  /// Which part of a full reload is in progress (meaningful while `isReloadingFromServer`).
  private(set) var serverReloadStep: LibraryServerReloadStep = .loadingSongs

  func bump() {
    generation &+= 1
  }

  func beginLibraryReloadFromServer() {
    isReloadingFromServer = true
    songsLoadedSoFar = 0
    serverReloadStep = .loadingSongs
  }

  func reportSongsLoadedFromServer(_ count: Int) {
    songsLoadedSoFar = count
  }

  func setServerReloadStep(_ step: LibraryServerReloadStep) {
    serverReloadStep = step
  }

  func endLibraryReloadFromServer() {
    isReloadingFromServer = false
    songsLoadedSoFar = 0
    serverReloadStep = .loadingSongs
  }
}
