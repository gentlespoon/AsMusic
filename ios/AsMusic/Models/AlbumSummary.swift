//
//  AlbumSummary.swift
//  AsMusic
//
//  Created by An So on 2026-03-31.
//

struct AlbumSummary: Identifiable {
  let id: String
  let name: String
  let artistID: String?
  let artistName: String?
  let artworkID: String?
  let songCount: Int
}
