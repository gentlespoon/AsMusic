//
//  ApiPaths.swift
//  AsNavidromeKit
//
//  Created by An So on 2026-03-26.
//

public enum ApiPaths {
  private static let basePath = "/rest"

  // General
  public static let root = basePath
  public static let ping = basePath + "/ping"

  // Library
  public static let getMusicFolders = basePath + "/getMusicFolders"

  // Artist
  public static let getArtists = basePath + "/getArtists"

  // Song
  public static let getSongs = basePath + "/search3"
  public static let getSong = basePath + "/getSong"

  // Album
  public static let getAlbums = basePath + "/getAlbumList2"
  public static let getAlbum = basePath + "/getAlbum"
  public static let getAlbumInfo = basePath + "/getAlbumInfo2"

  // Media
  public static let download = basePath + "/download"
  /// Prefer streamfor playback (same bytes as download for most servers; may apply transcoding).
  public static let stream = basePath + "/stream"
  public static let getCoverArt = basePath + "/getCoverArt"

  // Playlist
  public static let getPlaylists = basePath + "/getPlaylists"
  public static let getPlaylist = basePath + "/getPlaylist"
  public static let createPlaylist = basePath + "/createPlaylist"
  public static let deletePlaylist = basePath + "/deletePlaylist"
  public static let updatePlaylist = basePath + "/updatePlaylist"

  // Star
  public static let getStarred = basePath + "/getStarred2"
  public static let star = basePath + "/star"
  public static let unstar = basePath + "/unstar"
}
