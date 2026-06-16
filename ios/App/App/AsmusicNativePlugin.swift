import AVFoundation
import Capacitor
import Foundation
import MediaPlayer
import Security
import UIKit

@objc(AsmusicNativePlugin)
public class AsmusicNativePlugin: CAPPlugin, CAPBridgedPlugin {

    /// Must match `registerPlugin('AsmusicNative')` in web/src/host/asmusicNativePlugin.ts
    public let identifier = "AsmusicNativePlugin"
    public let jsName = "AsmusicNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "secureStorageGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secureStorageSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secureStorageRemove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playbackLoadUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playbackPlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playbackPause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playbackSeek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playbackSyncRemoteSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sleepTimerSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sleepTimerGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReadSongList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReadMeta", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReadCachedAlbumCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCachePurgeArtistAndAlbumCaches", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReplaceSongList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCachePatchSong", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReadPlaylistSummaries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReplacePlaylistSummaries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheDeleteScope", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCachePurgeServerAccount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheClearArtwork", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCachePutArtworkBatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "libraryCacheReadArtworkBlob", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaImportFromUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaGetStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaGetPlaybackUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaWaveformPeaks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaListReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaDeleteOne", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaDeleteScope", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaPurgeServerKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offlineMediaTotalBytes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistListSummaries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistReadEntries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistCreate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistRename", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistDelete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistReplaceEntries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "localPlaylistAppendEntry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playerDebugLogGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playerDebugLogClear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playerDebugLogAppend", returnType: CAPPluginReturnPromise),
    ]

    /// Target for lock-screen / route remote commands (latest player instance).
    private static weak var activePlugin: AsmusicNativePlugin?
    private static var didInstallRemoteCommands = false
    private static var didInstallAudioSessionObservers = false

    /// Last session flags from JS (`playbackSyncRemoteSession`); used to enable skip + favorite commands.
    private static var remoteHasNext = false
    private static var remoteHasPrevious = false
    private static var remoteFavoriteControlsEnabled = false
    private static var remoteStarred = false

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var timeControlStatusObserver: NSKeyValueObservation?
    /// Used to optionally resume after `AVAudioSession` interruption ends.
    private var wasPlayingBeforeInterruption = false
    /// Bumped on each `playbackLoadUrl` / teardown so stale `AVPlayerItem` failures are ignored.
    private var playbackLoadGeneration = 0
    /// Suppress duplicate `AVPlayerItemDidPlayToEndTime` for the same load generation.
    private var endNotifiedForLoadGeneration: Int = -1

    private static let debugLogFilename = "asmusic-player-debug.log"
    private static let maxDebugLogBytes = 65536

    private var sleepTimerWorkItem: DispatchWorkItem?
    private var sleepEndsAtEpochMs: Double?

    private var artworkDataTask: URLSessionDataTask?
    private var artworkEpoch = 0

    deinit {
        cancelArtworkLoad()
        tearDownPlayerObservers()
    }

    private var offlineMediaObserverTokens: [NSObjectProtocol] = []

    public override func load() {
        super.load()
        Self.installRemoteCommandsIfNeeded()
        Self.installAudioSessionObserversIfNeeded()
        installOfflineMediaNotificationObservers()
    }

    private func installOfflineMediaNotificationObservers() {
        let center = NotificationCenter.default
        offlineMediaObserverTokens.append(
            center.addObserver(forName: .asmusicOfflineMediaReady, object: nil, queue: .main) { [weak self] note in
                guard let cacheKey = note.userInfo?["cacheKey"] as? String else { return }
                self?.notifyListeners("offlineMediaReady", data: ["cacheKey": cacheKey])
            }
        )
        offlineMediaObserverTokens.append(
            center.addObserver(forName: .asmusicWaveformPeaksReady, object: nil, queue: .main) { [weak self] note in
                guard let cacheKey = note.userInfo?["cacheKey"] as? String else { return }
                self?.notifyListeners("waveformPeaksReady", data: ["cacheKey": cacheKey])
            }
        )
    }

    // MARK: - Secure storage (Keychain)

    @objc func secureStorageGet(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key")
            return
        }
        if let value = KeychainHelper.read(service: AsmusicNativePlugin.keychainService, account: key) {
            call.resolve(["value": value])
        } else {
            call.resolve(["value": NSNull()])
        }
    }

    @objc func secureStorageSet(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty,
              let value = call.getString("value") else {
            call.reject("Missing key or value")
            return
        }
        let ok = KeychainHelper.write(service: AsmusicNativePlugin.keychainService, account: key, data: value)
        if ok { call.resolve() } else { call.reject("Keychain write failed") }
    }

    @objc func secureStorageRemove(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key")
            return
        }
        KeychainHelper.delete(service: AsmusicNativePlugin.keychainService, account: key)
        call.resolve()
    }

    @objc func playerDebugLogGet(_ call: CAPPluginCall) {
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            call.resolve(["log": ""])
            return
        }
        let url = docs.appendingPathComponent(Self.debugLogFilename)
        let text = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        call.resolve(["log": text])
    }

    @objc func playerDebugLogClear(_ call: CAPPluginCall) {
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            call.resolve()
            return
        }
        let url = docs.appendingPathComponent(Self.debugLogFilename)
        try? FileManager.default.removeItem(at: url)
        call.resolve()
    }

    private static func appendPlayerDebugLog(_ message: String) {
        let ms = Int64(Date().timeIntervalSince1970 * 1000)
        let line = "\(ms) [native] \(message)\n"
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        let url = docs.appendingPathComponent(debugLogFilename)
        guard let data = line.data(using: .utf8) else { return }
        if FileManager.default.fileExists(atPath: url.path) {
            if let handle = try? FileHandle(forWritingTo: url) {
                handle.seekToEndOfFile()
                handle.write(data)
                try? handle.close()
            }
        } else {
            try? data.write(to: url)
        }
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? Int, size > maxDebugLogBytes,
           let full = try? String(contentsOf: url, encoding: .utf8)
        {
            let trimmed = String(full.suffix(maxDebugLogBytes))
            try? trimmed.data(using: .utf8)?.write(to: url)
        }
    }

    /// For future native-side diagnostics; call sites are intentionally sparse in production builds.
    @objc func playerDebugLogAppend(_ call: CAPPluginCall) {
        guard let message = call.getString("message"), !message.isEmpty else {
            call.reject("Missing message")
            return
        }
        Self.appendPlayerDebugLog(message)
        call.resolve()
    }

    private static let keychainService = "com.angdasoft.AsMusic.host"

    // MARK: - Playback

    @objc func playbackLoadUrl(_ call: CAPPluginCall) {
        let url: URL
        if let localPath = call.getString("localFilePath")?.trimmingCharacters(in: .whitespacesAndNewlines),
           !localPath.isEmpty
        {
            guard FileManager.default.fileExists(atPath: localPath) else {
                call.reject("Offline file not found")
                return
            }
            url = URL(fileURLWithPath: localPath)
        } else if let urlString = call.getString("url"), !urlString.isEmpty {
            if urlString.hasPrefix("file:") {
                guard let fileURL = URL(string: urlString), fileURL.isFileURL else {
                    call.reject("Invalid url")
                    return
                }
                guard FileManager.default.fileExists(atPath: fileURL.path) else {
                    call.reject("Offline file not found")
                    return
                }
                url = fileURL
            } else if let remote = URL(string: urlString) {
                url = remote
            } else {
                call.reject("Invalid url")
                return
            }
        } else {
            call.reject("Invalid url")
            return
        }

        tearDownPlayerObservers()
        Self.activePlugin = self

        let item = makePlayerItem(for: url)
        let av = AVPlayer(playerItem: item)
        player = av

        configureAudioSession()
        observePlayer(av, item: item)

        let title = call.getString("title") ?? "AsMusic"
        let artist = call.getString("artist") ?? ""
        let album = call.getString("album") ?? ""
        updateNowPlaying(title: title, artist: artist, album: album, duration: 0)

        cancelArtworkLoad()
        let epoch = artworkEpoch
        if let b64 = call.getString("artworkDataBase64")?.trimmingCharacters(in: .whitespacesAndNewlines),
           !b64.isEmpty,
           let data = Data(base64Encoded: b64) {
            applyArtworkData(data, epoch: epoch)
        } else if let artStr = call.getString("artworkUrl"), !artStr.isEmpty, let artUrl = URL(string: artStr) {
            startArtworkLoad(url: artUrl)
        }

        call.resolve()
    }

    @objc func playbackPlay(_ call: CAPPluginCall) {
        player?.play()
        notifyPlaybackState()
        call.resolve()
    }

    @objc func playbackPause(_ call: CAPPluginCall) {
        player?.pause()
        notifyPlaybackState()
        call.resolve()
    }

    @objc func playbackSeek(_ call: CAPPluginCall) {
        guard let player else {
            call.reject("No player")
            return
        }
        guard let seconds = call.getDouble("positionSeconds") else {
            call.reject("Missing positionSeconds")
            return
        }
        let time = CMTime(seconds: seconds, preferredTimescale: 600)
        player.seek(to: time) { [weak self] _ in
            self?.notifyPlaybackState()
            call.resolve()
        }
    }

    @objc func playbackSyncRemoteSession(_ call: CAPPluginCall) {
        let hasNext = boolFromCall(call, key: "hasNext")
        let hasPrevious = boolFromCall(call, key: "hasPrevious")
        let favoriteControlsEnabled = boolFromCall(call, key: "favoriteControlsEnabled")
        let starred = boolFromCall(call, key: "starred")
        Self.remoteHasNext = hasNext
        Self.remoteHasPrevious = hasPrevious
        Self.remoteFavoriteControlsEnabled = favoriteControlsEnabled
        Self.remoteStarred = starred
        DispatchQueue.main.async {
            Self.applyRemoteSessionToCommandCenter()
        }
        call.resolve()
    }

    // MARK: - Sleep timer

    private func cancelSleepTimerWorkItem() {
        sleepTimerWorkItem?.cancel()
        sleepTimerWorkItem = nil
    }

    private func fireSleepTimerElapsed() {
        cancelSleepTimerWorkItem()
        sleepEndsAtEpochMs = nil
        player?.pause()
        notifyListeners("sleepTimerElapsed", data: [:])
        notifyPlaybackState()
    }

    @objc func sleepTimerSet(_ call: CAPPluginCall) {
        cancelSleepTimerWorkItem()
        if let raw = call.options?["endsAtEpochMs"], !(raw is NSNull), let num = raw as? NSNumber {
            let endsAt = num.doubleValue
            sleepEndsAtEpochMs = endsAt
            let nowMs = Date().timeIntervalSince1970 * 1000
            let delaySec = max(0, (endsAt - nowMs) / 1000)
            let work = DispatchWorkItem { [weak self] in
                self?.fireSleepTimerElapsed()
            }
            sleepTimerWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + delaySec, execute: work)
        } else {
            sleepEndsAtEpochMs = nil
        }
        call.resolve()
    }

    @objc func sleepTimerGet(_ call: CAPPluginCall) {
        if let v = sleepEndsAtEpochMs {
            call.resolve(["endsAtEpochMs": v])
        } else {
            call.resolve(["endsAtEpochMs": NSNull()])
        }
    }

    // MARK: - Library cache (SQLite)

    @objc func libraryCacheReadSongList(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            let songsJson = try LibraryCacheSQLiteStore.readSongsJson(serverKey: serverKey, libraryId: libraryId)
            call.resolve(["songsJson": songsJson])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReadMeta(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            if let meta = try LibraryCacheSQLiteStore.readMeta(serverKey: serverKey, libraryId: libraryId) {
                call.resolve([
                    "lastSyncAt": meta.lastSyncAt,
                    "songCount": meta.songCount
                ])
            } else {
                call.resolve([
                    "lastSyncAt": NSNull(),
                    "songCount": NSNull()
                ])
            }
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReadCachedAlbumCount(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            let count = try LibraryCacheSQLiteStore.readCachedAlbumCount(serverKey: serverKey, libraryId: libraryId)
            call.resolve([
                "albumCount": count
            ])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCachePurgeArtistAndAlbumCaches(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            try LibraryCacheSQLiteStore.purgeArtistAndAlbumCaches(serverKey: serverKey, libraryId: libraryId)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReplaceSongList(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let songsJson = call.getString("songsJson") else {
            call.reject("Missing serverKey, libraryId, or songsJson")
            return
        }
        let artistsJson = call.getString("artistsJson") ?? "[]"
        let albumsJson = call.getString("albumsJson") ?? "[]"
        do {
            try LibraryCacheSQLiteStore.replaceSongList(
                serverKey: serverKey,
                libraryId: libraryId,
                songsJson: songsJson,
                artistsJson: artistsJson,
                albumsJson: albumsJson
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCachePatchSong(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let songId = call.getString("songId"), !songId.isEmpty,
              let songJson = call.getString("songJson") else {
            call.reject("Missing serverKey, libraryId, songId, or songJson")
            return
        }
        do {
            try LibraryCacheSQLiteStore.patchSongJson(
                serverKey: serverKey,
                libraryId: libraryId,
                songId: songId,
                songJson: songJson
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReadPlaylistSummaries(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            let playlistsJson = try LibraryCacheSQLiteStore.readPlaylistSummariesJson(
                serverKey: serverKey,
                libraryId: libraryId
            )
            call.resolve(["playlistsJson": playlistsJson])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReplacePlaylistSummaries(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let playlistsJson = call.getString("playlistsJson") else {
            call.reject("Missing serverKey, libraryId, or playlistsJson")
            return
        }
        do {
            try LibraryCacheSQLiteStore.replacePlaylistSummaries(
                serverKey: serverKey,
                libraryId: libraryId,
                playlistsJson: playlistsJson
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheDeleteScope(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            try LibraryCacheSQLiteStore.deleteScope(serverKey: serverKey, libraryId: libraryId)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCachePurgeServerAccount(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty else {
            call.reject("Missing serverKey")
            return
        }
        do {
            try LibraryCacheSQLiteStore.deleteAllScopesForServerKey(serverKey: serverKey)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheClearArtwork(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            try LibraryCacheSQLiteStore.clearArtwork(serverKey: serverKey, libraryId: libraryId)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCachePutArtworkBatch(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let entriesJson = call.getString("entriesJson") else {
            call.reject("Missing serverKey, libraryId, or entriesJson")
            return
        }
        do {
            try LibraryCacheSQLiteStore.putArtworkBatch(
                serverKey: serverKey,
                libraryId: libraryId,
                entriesJson: entriesJson
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func libraryCacheReadArtworkBlob(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing serverKey, libraryId, or coverArtId")
            return
        }
        do {
            if let row = try LibraryCacheSQLiteStore.readArtworkBlob(
                serverKey: serverKey,
                libraryId: libraryId,
                coverArtId: coverArtId
            ) {
                call.resolve([
                    "mimeType": row.mimeType,
                    "base64": row.base64
                ])
            } else {
                call.resolve([
                    "mimeType": NSNull(),
                    "base64": NSNull()
                ])
            }
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    // MARK: - Offline media (SQLite + files)

    @objc func offlineMediaImportFromUrl(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let trackId = call.getString("trackId"), !trackId.isEmpty,
              let url = call.getString("url"), !url.isEmpty else {
            call.reject("Missing serverKey, libraryId, trackId, or url")
            return
        }
        let variant = call.getString("variant") ?? ""
        Task {
            do {
                try await LibraryCacheSQLiteStore.offlineImportFromUrl(
                    serverKey: serverKey,
                    libraryId: libraryId,
                    trackId: trackId,
                    variant: variant,
                    remoteUrlString: url
                )
                await MainActor.run { call.resolve() }
            } catch {
                await MainActor.run { call.reject(error.localizedDescription) }
            }
        }
    }

    @objc func offlineMediaGetStatus(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let trackId = call.getString("trackId"), !trackId.isEmpty else {
            call.reject("Missing serverKey, libraryId, or trackId")
            return
        }
        let variant = call.getString("variant") ?? ""
        do {
            let dict = try LibraryCacheSQLiteStore.offlineReadStatus(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            )
            call.resolve(dict as [String: Any])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaGetPlaybackUrl(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let trackId = call.getString("trackId"), !trackId.isEmpty else {
            call.reject("Missing serverKey, libraryId, or trackId")
            return
        }
        let variant = call.getString("variant") ?? ""
        do {
            if let path = try LibraryCacheSQLiteStore.offlinePlaybackFilePath(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            ) {
                call.resolve([
                    "localFilePath": path,
                    "url": URL(fileURLWithPath: path).absoluteString
                ])
            } else {
                call.resolve(["url": NSNull(), "localFilePath": NSNull()])
            }
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaWaveformPeaks(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let trackId = call.getString("trackId"), !trackId.isEmpty else {
            call.reject("Missing serverKey, libraryId, or trackId")
            return
        }
        let variant = call.getString("variant") ?? ""
        let barCount = max(8, min(call.getInt("barCount") ?? 96, 512))
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let peaks = try LibraryCacheSQLiteStore.offlineWaveformPeaks(
                    serverKey: serverKey,
                    libraryId: libraryId,
                    trackId: trackId,
                    variant: variant,
                    barCount: barCount
                )
                DispatchQueue.main.async {
                    call.resolve(["peaks": peaks])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func offlineMediaListReady(_ call: CAPPluginCall) {
        let serverKey = call.getString("serverKey")
        let libraryId = call.getString("libraryId")
        do {
            let json = try LibraryCacheSQLiteStore.offlineListReadyJson(serverKey: serverKey, libraryId: libraryId)
            call.resolve(["rowsJson": json])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaDeleteOne(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId"),
              let trackId = call.getString("trackId"), !trackId.isEmpty else {
            call.reject("Missing serverKey, libraryId, or trackId")
            return
        }
        let variant = call.getString("variant") ?? ""
        do {
            try LibraryCacheSQLiteStore.offlineDeleteOne(
                serverKey: serverKey,
                libraryId: libraryId,
                trackId: trackId,
                variant: variant
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaDeleteScope(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty,
              let libraryId = call.getString("libraryId") else {
            call.reject("Missing serverKey or libraryId")
            return
        }
        do {
            try LibraryCacheSQLiteStore.offlineDeleteScope(serverKey: serverKey, libraryId: libraryId)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaPurgeServerKey(_ call: CAPPluginCall) {
        guard let serverKey = call.getString("serverKey"), !serverKey.isEmpty else {
            call.reject("Missing serverKey")
            return
        }
        do {
            try LibraryCacheSQLiteStore.offlinePurgeServerKey(serverKey: serverKey)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func offlineMediaTotalBytes(_ call: CAPPluginCall) {
        let serverKey = call.getString("serverKey")
        let libraryId = call.getString("libraryId")
        do {
            let n = try LibraryCacheSQLiteStore.offlineTotalBytes(serverKey: serverKey, libraryId: libraryId)
            call.resolve(["totalBytes": n])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    // MARK: - Local playlists

    @objc func localPlaylistListSummaries(_ call: CAPPluginCall) {
        do {
            let summariesJson = try LibraryCacheSQLiteStore.readLocalPlaylistSummariesJson()
            call.resolve(["summariesJson": summariesJson])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistReadEntries(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty else {
            call.reject("Missing playlistId")
            return
        }
        do {
            let entriesJson = try LibraryCacheSQLiteStore.readLocalPlaylistEntriesJson(playlistId: playlistId)
            call.resolve(["entriesJson": entriesJson])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistCreate(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty,
              let name = call.getString("name"), !name.isEmpty else {
            call.reject("Missing playlistId or name")
            return
        }
        let createdAt = call.getDouble("createdAt") ?? (Date().timeIntervalSince1970 * 1000)
        do {
            let summaryJson = try LibraryCacheSQLiteStore.createLocalPlaylist(
                name: name,
                playlistId: playlistId,
                createdAt: createdAt
            )
            call.resolve(["summaryJson": summaryJson])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistRename(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty,
              let name = call.getString("name"), !name.isEmpty else {
            call.reject("Missing playlistId or name")
            return
        }
        let updatedAt = call.getDouble("updatedAt") ?? (Date().timeIntervalSince1970 * 1000)
        do {
            try LibraryCacheSQLiteStore.renameLocalPlaylist(playlistId: playlistId, name: name, updatedAt: updatedAt)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistDelete(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty else {
            call.reject("Missing playlistId")
            return
        }
        do {
            try LibraryCacheSQLiteStore.deleteLocalPlaylist(playlistId: playlistId)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistReplaceEntries(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty,
              let entriesJson = call.getString("entriesJson") else {
            call.reject("Missing playlistId or entriesJson")
            return
        }
        let updatedAt = call.getDouble("updatedAt") ?? (Date().timeIntervalSince1970 * 1000)
        do {
            try LibraryCacheSQLiteStore.replaceLocalPlaylistEntries(
                playlistId: playlistId,
                entriesJson: entriesJson,
                updatedAt: updatedAt
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func localPlaylistAppendEntry(_ call: CAPPluginCall) {
        guard let playlistId = call.getString("playlistId"), !playlistId.isEmpty,
              let entryJson = call.getString("entryJson") else {
            call.reject("Missing playlistId or entryJson")
            return
        }
        let updatedAt = call.getDouble("updatedAt") ?? (Date().timeIntervalSince1970 * 1000)
        do {
            try LibraryCacheSQLiteStore.appendLocalPlaylistEntry(
                playlistId: playlistId,
                entryJson: entryJson,
                updatedAt: updatedAt
            )
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    // MARK: - Internals (playback helpers)

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.allowBluetoothHFP, .allowBluetoothA2DP])
            try session.setActive(true, options: [])
        } catch {
            print("[AsmusicNative] Audio session error: \(error)")
        }
    }

    private static func installAudioSessionObserversIfNeeded() {
        guard !didInstallAudioSessionObservers else { return }
        didInstallAudioSessionObservers = true
        let session = AVAudioSession.sharedInstance()
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: session,
            queue: .main
        ) { notification in
            activePlugin?.handleAudioSessionInterruption(notification)
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            activePlugin?.notifyPlaybackState()
        }
    }

    private func handleAudioSessionInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue)
        else { return }

        switch type {
        case .began:
            if let p = player {
                let status = p.timeControlStatus
                wasPlayingBeforeInterruption =
                    status == .playing || status == .waitingToPlayAtSpecifiedRate
            } else {
                wasPlayingBeforeInterruption = false
            }
            player?.pause()
            notifyPlaybackState()
        case .ended:
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume), wasPlayingBeforeInterruption {
                    do {
                        try AVAudioSession.sharedInstance().setActive(true)
                    } catch {
                        print("[AsmusicNative] Reactivate audio session after interruption: \(error)")
                    }
                    player?.play()
                }
            }
            wasPlayingBeforeInterruption = false
            notifyPlaybackState()
        @unknown default:
            break
        }
    }

    private static func installRemoteCommandsIfNeeded() {
        guard !didInstallRemoteCommands else { return }
        didInstallRemoteCommands = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.togglePlayPauseCommand.removeTarget(nil)
        center.nextTrackCommand.removeTarget(nil)
        center.previousTrackCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)
        center.likeCommand.removeTarget(nil)
        center.dislikeCommand.removeTarget(nil)

        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.nextTrackCommand.isEnabled = false
        center.previousTrackCommand.isEnabled = false
        center.likeCommand.isEnabled = false
        center.dislikeCommand.isEnabled = false
        center.likeCommand.localizedTitle = "Add to favorites"
        center.dislikeCommand.localizedTitle = "Remove from favorites"

        center.playCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.player?.play()
                Self.activePlugin?.notifyPlaybackState()
            }
            return .success
        }
        center.pauseCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.player?.pause()
                Self.activePlugin?.notifyPlaybackState()
            }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { _ in
            guard Self.activePlugin?.player != nil else { return .commandFailed }
            DispatchQueue.main.async {
                guard let p = Self.activePlugin?.player else { return }
                if p.timeControlStatus == .playing {
                    p.pause()
                } else {
                    p.play()
                }
                Self.activePlugin?.notifyPlaybackState()
            }
            return .success
        }

        center.nextTrackCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.notifyListeners("playbackRemoteSkipNext", data: [:])
            }
            return .success
        }
        center.previousTrackCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.notifyListeners("playbackRemoteSkipPrevious", data: [:])
            }
            return .success
        }

        center.changePlaybackPositionCommand.addTarget { event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            guard Self.activePlugin?.player != nil else { return .commandFailed }
            DispatchQueue.main.async {
                guard let p = Self.activePlugin?.player else { return }
                let time = CMTime(seconds: e.positionTime, preferredTimescale: 600)
                p.seek(to: time) { _ in
                    Self.activePlugin?.notifyPlaybackState()
                }
            }
            return .success
        }

        center.likeCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.notifyListeners("playbackRemoteFavoriteStar", data: [:])
            }
            return .success
        }
        center.dislikeCommand.addTarget { _ in
            DispatchQueue.main.async {
                Self.activePlugin?.notifyListeners("playbackRemoteFavoriteUnstar", data: [:])
            }
            return .success
        }

        applyRemoteSessionToCommandCenter()
    }

    private static func applyRemoteSessionToCommandCenter() {
        let c = MPRemoteCommandCenter.shared()
        c.nextTrackCommand.isEnabled = remoteHasNext
        c.previousTrackCommand.isEnabled = remoteHasPrevious
        c.likeCommand.isEnabled = remoteFavoriteControlsEnabled
        c.dislikeCommand.isEnabled = remoteFavoriteControlsEnabled
        c.likeCommand.isActive = remoteFavoriteControlsEnabled && remoteStarred
        c.dislikeCommand.isActive = remoteFavoriteControlsEnabled && !remoteStarred
    }

    /// AVPlayer rejects some on-disk extensions (e.g. legacy `*.audio`) even when bytes are valid MP3.
    private func makePlayerItem(for url: URL) -> AVPlayerItem {
        let ext = url.pathExtension.lowercased()
        let needsMimeHint = ext.isEmpty || ext == "audio" || ext == "view"
        guard needsMimeHint, url.isFileURL else {
            return AVPlayerItem(url: url)
        }
        let asset = AVURLAsset(
            url: url,
            options: [AVURLAssetOverrideMIMETypeKey: "audio/mpeg"]
        )
        return AVPlayerItem(asset: asset)
    }

    private func observePlayer(_ av: AVPlayer, item: AVPlayerItem) {
        endNotifiedForLoadGeneration = -1
        let observedGeneration = playbackLoadGeneration
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = av.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
            self?.notifyPlaybackState()
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            guard observedGeneration == self.playbackLoadGeneration else { return }
            if self.endNotifiedForLoadGeneration == observedGeneration { return }
            self.endNotifiedForLoadGeneration = observedGeneration
            self.notifyListeners("playbackEnded", data: [:])
            self.notifyPlaybackState()
        }

        statusObserver = item.observe(\.status, options: [.initial, .new]) { [weak self] it, _ in
            guard let self, observedGeneration == self.playbackLoadGeneration else { return }
            if it.status == .failed {
                let msg = it.error?.localizedDescription ?? "Playback failed"
                self.notifyListeners("playbackError", data: ["message": msg])
            }
            if it.status == .readyToPlay {
                let duration = CMTimeGetSeconds(it.duration)
                if duration.isFinite && duration > 0 {
                    self.updateNowPlayingDuration(duration)
                }
            }
            self.notifyPlaybackState()
        }

        timeControlStatusObserver = av.observe(\.timeControlStatus, options: [.initial, .new]) { [weak self] _, _ in
            guard let self, observedGeneration == self.playbackLoadGeneration else { return }
            self.notifyPlaybackState()
        }
    }

    private func tearDownPlayerObservers() {
        playbackLoadGeneration += 1
        endNotifiedForLoadGeneration = -1
        cancelArtworkLoad()
        if let timeObserver, let p = player {
            p.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        statusObserver?.invalidate()
        statusObserver = nil
        timeControlStatusObserver?.invalidate()
        timeControlStatusObserver = nil
        wasPlayingBeforeInterruption = false
        player?.pause()
        player = nil
    }

    private func cancelArtworkLoad() {
        artworkDataTask?.cancel()
        artworkDataTask = nil
        artworkEpoch += 1
    }

    private func startArtworkLoad(url: URL) {
        cancelArtworkLoad()
        let epoch = artworkEpoch
        let task = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self else { return }
            guard epoch == self.artworkEpoch else { return }
            guard let data else { return }
            self.applyArtworkData(data, epoch: epoch)
        }
        artworkDataTask = task
        task.resume()
    }

    private func applyArtworkData(_ data: Data, epoch: Int) {
        guard epoch == artworkEpoch else { return }
        guard let image = UIImage(data: data) else { return }
        let artwork = MPMediaItemArtwork(boundsSize: CGSize(width: 512, height: 512)) { _ in image }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard epoch == self.artworkEpoch else { return }
            guard MPNowPlayingInfoCenter.default().nowPlayingInfo != nil else { return }
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPMediaItemPropertyArtwork] = artwork
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }

    private func notifyPlaybackState() {
        guard let p = player else { return }
        let duration = p.currentItem.map { CMTimeGetSeconds($0.duration) } ?? 0
        let position = CMTimeGetSeconds(p.currentTime())
        let isPlaying = p.timeControlStatus == .playing
        let d = duration.isFinite && duration > 0 ? duration : 0
        let pos = position.isFinite ? max(0, position) : 0
        notifyListeners("playbackState", data: [
            "durationSeconds": d,
            "positionSeconds": pos,
            "isPlaying": isPlaying
        ])
        syncNowPlayingTransport(elapsed: pos, isPlaying: isPlaying)
    }

    private func syncNowPlayingTransport(elapsed: Double, isPlaying: Bool) {
        guard MPNowPlayingInfoCenter.default().nowPlayingInfo != nil else { return }
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func updateNowPlaying(title: String, artist: String, album: String, duration: Double) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: album,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: 0,
            MPNowPlayingInfoPropertyPlaybackRate: 0
        ]
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info as [String: Any]
    }

    private func updateNowPlayingDuration(_ duration: Double) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyPlaybackDuration] = duration
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func boolFromCall(_ call: CAPPluginCall, key: String) -> Bool {
        if let b = call.options[key] as? Bool {
            return b
        }
        if let n = call.options[key] as? NSNumber {
            return n.boolValue
        }
        return false
    }
}

// MARK: - Keychain

private enum KeychainHelper {

    static func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(service: String, account: String, data: String) -> Bool {
        delete(service: service, account: account)
        guard let bytes = data.data(using: .utf8) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: bytes,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
