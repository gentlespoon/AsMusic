//
//  SubsonicResponse.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-26.
//

public struct SubsonicResponse: Codable {
  public let status: String
  public let version: String
  public let type: String
  public let serverVersion: String
  public let openSubsonic: Bool?
  public let musicFolders: MusicFoldersResponse?
  public let artists: ArtistsResponse?
  public let albumList2: AlbumList2Response?
  public let searchResult3: SearchResult3Response?
  public let playlists: PlaylistsListResponse?
  public let playlist: PlaylistDetail?
}
