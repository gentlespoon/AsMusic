//
//  PlayerLibraryRoute.swift
//  AsMusic
//

import Foundation

enum PlayerLibraryRoute: Hashable {
  case artist(id: String, name: String)
  case album(id: String, title: String, artistLine: String?)
}
