//
//  KitLogging.swift
//  AsNavidromeKit
//

import Foundation
import os

enum KitLogging {
  static let networking = Logger(
    subsystem: "works.asmusic.navidrome-kit",
    category: "network"
  )
  static let decoding = Logger(
    subsystem: "works.asmusic.navidrome-kit",
    category: "decode"
  )
}
