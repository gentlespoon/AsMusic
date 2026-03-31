//
//  CarPlaySceneDelegate.swift
//  AsMusic
//

import AsNavidromeKit
import CarPlay
import UIKit

@MainActor
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var rootTemplate: CPListTemplate?
  private var playlistItems: [CPListItem] = []
  private var isLoadingPlaylists = false

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController,
    to window: CPWindow
  ) {
    self.interfaceController = interfaceController
    let template = makeRootTemplate()
    rootTemplate = template
    interfaceController.setRootTemplate(template, animated: false) { _, _ in }
    refreshPlaylists()
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController,
    from window: CPWindow
  ) {
    self.interfaceController = nil
  }

  private func makeRootTemplate() -> CPListTemplate {
    let nowPlayingItem = CPListItem(text: "Now Playing", detailText: nil)
    nowPlayingItem.handler = { _, completion in
      guard let interfaceController = self.interfaceController else {
        completion()
        return
      }
      interfaceController.pushTemplate(CPNowPlayingTemplate.shared, animated: true) { _, _ in
        completion()
      }
    }

    let section = CPListSection(items: [nowPlayingItem, loadingItem()])
    let template = CPListTemplate(title: "AsMusic", sections: [section])
    template.tabTitle = "Library"
    template.tabImage = UIImage(systemName: "music.note.list")
    return template
  }

  private func loadingItem() -> CPListItem {
    CPListItem(text: "Loading playlists…", detailText: nil)
  }

  private func refreshPlaylists() {
    guard !isLoadingPlaylists else { return }
    isLoadingPlaylists = true

    Task { @MainActor in
      defer { isLoadingPlaylists = false }
      let items = await buildPlaylistItems()
      playlistItems = items
      applySections()
    }
  }

  private func applySections() {
    guard let rootTemplate else { return }
    let nowPlayingItem = CPListItem(text: "Now Playing", detailText: nil)
    nowPlayingItem.handler = { _, completion in
      guard let interfaceController = self.interfaceController else {
        completion()
        return
      }
      interfaceController.pushTemplate(CPNowPlayingTemplate.shared, animated: true) { _, _ in
        completion()
      }
    }

    let listItems = playlistItems.isEmpty
      ? [CPListItem(text: "No playlists", detailText: "Create playlists on iPhone first.")]
      : playlistItems
    let sections = [
      CPListSection(items: [nowPlayingItem]),
      CPListSection(items: listItems, header: "Playlists", sectionIndexTitle: nil),
    ]
    rootTemplate.updateSections(sections)
  }

  private func buildPlaylistItems() async -> [CPListItem] {
    guard let context = await resolvePlaylistContext() else {
      return [CPListItem(text: "No library selected", detailText: "Select a library on iPhone.")]
    }

    let playlists: [PlaylistSummary]
    if let cached = await PlaylistSummaryCacheStore.shared.loadPlaylists(
      serverID: context.server.id,
      libraryID: context.selection.folderID
    ) {
      playlists = cached
    } else {
      do {
        playlists = try await context.client.getPlaylists()
        await PlaylistSummaryCacheStore.shared.savePlaylists(
          playlists,
          serverID: context.server.id,
          libraryID: context.selection.folderID
        )
      } catch {
        return [CPListItem(text: "Unable to load playlists", detailText: error.localizedDescription)]
      }
    }

    return playlists.map { playlist in
      let detail = playlist.songCount.map { "\($0) songs" }
      let item = CPListItem(text: playlist.name, detailText: detail)
      item.handler = { _, completion in
        Task { @MainActor in
          await self.startPlaylistPlayback(playlistID: playlist.id, context: context)
          completion()
        }
      }
      return item
    }
  }

  private func startPlaylistPlayback(playlistID: String, context: PlaylistContext) async {
    do {
      let detail = try await context.client.getPlaylist(id: playlistID)
      let songs = detail.entry?.filter { $0.isDir != true } ?? []
      let queueItems = songs.map { NowPlayingQueueItem(id: $0.id) }
      guard !queueItems.isEmpty else { return }
      await PlaylistSummaryCacheStore.shared.saveSongs(
        songs,
        forPlaylistID: playlistID,
        serverID: context.server.id,
        libraryID: context.selection.folderID
      )
      await AppDependencies.musicPlayer.replaceQueueAndPlay(queueItems, startAt: 0)
      guard let interfaceController else { return }
      interfaceController.pushTemplate(CPNowPlayingTemplate.shared, animated: true) { _, _ in }
    } catch {
      // Keep CarPlay responsive even if network call fails.
    }
  }

  private struct PlaylistContext {
    let selection: SelectedLibrary
    let server: Server
    let client: AsNavidromeClient
  }

  private func resolvePlaylistContext() async -> PlaylistContext? {
    let selection = await MainActor.run(resultType: SelectedLibrary?.self) {
      SelectedLibraryStore.shared.selection
    }
    guard let selection else { return nil }
    let server = await MainActor.run(resultType: Server?.self) {
      let manager = ServerManager()
      return manager.servers.first(where: { $0.id == selection.serverID })
    }
    guard let server else { return nil }
    let client = await NavidromeClientStore.shared.client(for: server)
    return PlaylistContext(selection: selection, server: server, client: client)
  }
}
