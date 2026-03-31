//
//  PlaylistDeleteSupport.swift
//  AsMusic
//

import AsNavidromeKit
import Foundation

enum PlaylistDeleteError: LocalizedError {
  case noLibrarySelection
  case missingServer

  var errorDescription: String? {
    switch self {
    case .noLibrarySelection:
      return "Add a server in Settings to delete playlists."
    case .missingServer:
      return "Selected server is unavailable."
    }
  }
}

private struct PlaylistDeleteContext {
  let client: AsNavidromeClient
  let serverID: UUID
  let libraryID: String
}

private func resolvePlaylistDeleteContext(environmentClient: AsNavidromeClient?) async throws
  -> PlaylistDeleteContext
{
  _ = environmentClient
  let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
    SelectedLibraryStore.shared.selection
  }
  guard let selection else { throw PlaylistDeleteError.noLibrarySelection }
  let servers = await MainActor.run { ServerManager().servers }
  guard let server = servers.first(where: { $0.id == selection.serverID }) else {
    throw PlaylistDeleteError.missingServer
  }
  let client = await NavidromeClientStore.shared.client(for: server)
  return PlaylistDeleteContext(client: client, serverID: selection.serverID, libraryID: selection.folderID)
}

@discardableResult
func deletePlaylistAndRefreshCache(
  playlistID: String,
  environmentClient: AsNavidromeClient?
) async throws -> [PlaylistSummary] {
  let context = try await resolvePlaylistDeleteContext(environmentClient: environmentClient)
  try await context.client.deletePlaylist(id: playlistID)
  let existing = await PlaylistSummaryCacheStore.shared.loadPlaylists(
    serverID: context.serverID,
    libraryID: context.libraryID
  ) ?? []
  let updated = existing.filter { $0.id != playlistID }
  await PlaylistSummaryCacheStore.shared.savePlaylists(
    updated,
    serverID: context.serverID,
    libraryID: context.libraryID
  )
  return updated
}
