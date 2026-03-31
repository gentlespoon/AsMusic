//
//  ArtworkURLSupport.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum ArtworkURLSupport {
  static func coverArtURL(
    client: AsNavidromeClient?,
    artworkID: String?,
    size: Int = 600
  ) -> URL? {
    guard let client else { return nil }
    let id = artworkID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !id.isEmpty else { return nil }
    return client.media.coverArt(forID: id, size: size)
  }
}
