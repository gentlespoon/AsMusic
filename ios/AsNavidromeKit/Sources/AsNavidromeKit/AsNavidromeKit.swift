  //
  //  AsNavidromeKit.swift
  //  AsNavidromeKit
  //
  //  Created by An So on 2026-03-26.
  //

import Foundation

public struct AsNavidromeClient: Sendable {

  public private(set) var host: String
  public private(set) var username: String
  private let authedRequest: AuthedRequest

  public init(host: String, username: String, password: String) {
    self.host = host
    self.username = username
    self.authedRequest = AuthedRequest(host: host, username: username, password: password)
  }

  // MARK: - Namespaces (aligned with `ApiPaths`)

  public var general: General { General(authedRequest: authedRequest) }
  public var library: Library { Library(authedRequest: authedRequest) }
  public var artist: ArtistRoutes { ArtistRoutes(authedRequest: authedRequest) }
  public var song: SongRoutes { SongRoutes(authedRequest: authedRequest) }
  public var album: AlbumRoutes { AlbumRoutes(authedRequest: authedRequest) }
  public var playlist: PlaylistRoutes { PlaylistRoutes(authedRequest: authedRequest) }
  public var media: Media { Media(authedRequest: authedRequest) }

  /// Subsonic `getPlaylists`.
  public func getPlaylists() async throws -> [PlaylistSummary] {
    try await playlist.getPlaylists()
  }

  /// Subsonic `getPlaylist`.
  public func getPlaylist(id: String) async throws -> PlaylistDetail {
    try await playlist.getPlaylist(id: id)
  }

  /// Subsonic `createPlaylist`.
  public func createPlaylist(name: String) async throws {
    try await playlist.createPlaylist(name: name)
  }

  /// Subsonic `deletePlaylist`.
  public func deletePlaylist(id: String) async throws {
    try await playlist.deletePlaylist(id: id)
  }

  /// Subsonic `updatePlaylist` for add/remove track edits.
  public func updatePlaylist(
    id: String,
    songIDsToAdd: [String],
    songIndexesToRemove: [Int]
  ) async throws {
    try await playlist.updatePlaylist(
      id: id,
      songIDsToAdd: songIDsToAdd,
      songIndexesToRemove: songIndexesToRemove
    )
  }
}

// MARK: - General

extension AsNavidromeClient {
  public struct General: Sendable {
    let authedRequest: AuthedRequest

    public func ping() async throws -> Bool {
      let json = try await authedRequest.get(path: ApiPaths.ping)
      let response = try decodeSubsonicResponse(from: json)
      return response.status == "ok"
    }
  }
}

// MARK: - Library

extension AsNavidromeClient {
  public struct Library: Sendable {
    let authedRequest: AuthedRequest

    public func getMusicFolders() async throws -> [MusicFolder] {
      let json = try await authedRequest.get(path: ApiPaths.getMusicFolders)
      let response = try decodeSubsonicResponse(from: json)
      return response.musicFolders?.musicFolder ?? []
    }
  }
}

// MARK: - Artist

extension AsNavidromeClient {
  public struct ArtistRoutes: Sendable {
    let authedRequest: AuthedRequest

    public func getArtists() async throws -> [Artist] {
      let json = try await authedRequest.get(path: ApiPaths.getArtists)
      let response = try decodeSubsonicResponse(from: json)
      return response.artists?.index.flatMap(\.artist) ?? []
    }
  }
}

// MARK: - Song

extension AsNavidromeClient {
  public struct SongRoutes: Sendable {
    let authedRequest: AuthedRequest

    /// Paginates through Subsonic `search3` (via `getSongs` path) until all songs are loaded.
    /// `onProgress` is invoked with the cumulative number of songs loaded after each page (on an arbitrary executor).
    public func getSongs(
      onProgress: (@Sendable (Int) -> Void)? = nil
    ) async throws -> [Song] {
      let pageSize = 500
      var offset = 0
      var allSongs: [Song] = []

      while true {
        let json = try await authedRequest.get(
          path: ApiPaths.getSongs,
          additionalParameters: [
            "artistCount": "0",
            "albumCount": "0",
            "songCount": String(pageSize),
            "songOffset": String(offset),
            "query": "",
          ])
        let response = try decodeSubsonicResponse(from: json)
        let pageSongs = response.searchResult3?.song ?? []
        allSongs.append(contentsOf: pageSongs)
        onProgress?(allSongs.count)

        if pageSongs.count < pageSize {
          break
        }
        offset += pageSize
      }

      return allSongs
    }

    public func star(songID: String) async throws {
      let _ = try await authedRequest.get(
        path: ApiPaths.star,
        additionalParameters: ["id": songID]
      )
    }

    public func unstar(songID: String) async throws {
      let _ = try await authedRequest.get(
        path: ApiPaths.unstar,
        additionalParameters: ["id": songID]
      )
    }
  }
}

// MARK: - Album

extension AsNavidromeClient {
  public struct AlbumRoutes: Sendable {
    let authedRequest: AuthedRequest

    public func getAlbums() async throws -> [Album] {
      let pageSize = 500
      var offset = 0
      var allAlbums: [Album] = []

      while true {
        let json = try await authedRequest.get(
          path: ApiPaths.getAlbums,
          additionalParameters: [
            "type": "alphabeticalByName",
            "size": String(pageSize),
            "offset": String(offset),
          ])
        let response = try decodeSubsonicResponse(from: json)
        let pageAlbums = response.albumList2?.album ?? []
        allAlbums.append(contentsOf: pageAlbums)

        if pageAlbums.count < pageSize {
          break
        }
        offset += pageSize
      }

      return allAlbums
    }
  }
}

// MARK: - Playlist

extension AsNavidromeClient {
  public struct PlaylistRoutes: Sendable {
    let authedRequest: AuthedRequest

    public func getPlaylists() async throws -> [PlaylistSummary] {
      let json = try await authedRequest.get(path: ApiPaths.getPlaylists)
      let response = try decodeSubsonicResponse(from: json)
      let list = response.playlists?.playlist ?? []
      return list.sorted { lhs, rhs in
        lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
      }
    }

    public func getPlaylist(id: String) async throws -> PlaylistDetail {
      let json = try await authedRequest.get(
        path: ApiPaths.getPlaylist,
        additionalParameters: ["id": id])
      let response = try decodeSubsonicResponse(from: json)
      guard let detail = response.playlist else {
        throw URLError(.cannotParseResponse)
      }
      return detail
    }

    public func createPlaylist(name: String) async throws {
      let json = try await authedRequest.get(
        path: ApiPaths.createPlaylist,
        additionalParameters: ["name": name])
      let response = try decodeSubsonicResponse(from: json)
      guard response.status == "ok" else {
        throw URLError(.cannotParseResponse)
      }
    }

    public func deletePlaylist(id: String) async throws {
      let json = try await authedRequest.get(
        path: ApiPaths.deletePlaylist,
        additionalParameters: ["id": id])
      let response = try decodeSubsonicResponse(from: json)
      guard response.status == "ok" else {
        throw URLError(.cannotParseResponse)
      }
    }

    public func updatePlaylist(
      id: String,
      songIDsToAdd: [String],
      songIndexesToRemove: [Int]
    ) async throws {
      for index in songIndexesToRemove.sorted(by: >) {
        let json = try await authedRequest.get(
          path: ApiPaths.updatePlaylist,
          additionalParameters: [
            "playlistId": id,
            "songIndexToRemove": String(index),
          ])
        let response = try decodeSubsonicResponse(from: json)
        guard response.status == "ok" else {
          throw URLError(.cannotParseResponse)
        }
      }

      for songID in songIDsToAdd {
        let json = try await authedRequest.get(
          path: ApiPaths.updatePlaylist,
          additionalParameters: [
            "playlistId": id,
            "songIdToAdd": songID,
          ])
        let response = try decodeSubsonicResponse(from: json)
        guard response.status == "ok" else {
          throw URLError(.cannotParseResponse)
        }
      }
    }
  }
}

// MARK: - Media

extension AsNavidromeClient {
  public struct Media: Sendable {
    let authedRequest: AuthedRequest

    public func download(forSongID songID: String) -> URL {
      authedRequest.authenticatedURL(
        path: ApiPaths.download,
        additionalParameters: ["id": songID],
        includeResponseFormat: false
      )
    }

    /// URL for streaming playback (Subsonic `stream`). Prefer this for `AVPlayer` so playback can start
    /// before the full file is buffered.
    public func stream(forSongID songID: String) -> URL {
      authedRequest.authenticatedURL(
        path: ApiPaths.stream,
        additionalParameters: ["id": songID],
        includeResponseFormat: false
      )
    }

    public func coverArt(forID coverArtID: String, size: Int? = nil) -> URL {
      var params: [String: String] = ["id": coverArtID]
      if let size, size > 0 {
        params["size"] = String(size)
      }
      return authedRequest.authenticatedURL(
        path: ApiPaths.getCoverArt,
        additionalParameters: params,
        includeResponseFormat: false
      )
    }
  }
}

