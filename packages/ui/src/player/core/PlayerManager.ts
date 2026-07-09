import {
  libraryCacheScope,
  PERSIST_WHILE_STREAMING_KEY,
  readPersistWhileStreamingEnabled,
  resolvePlaybackSource,
  type PlaybackRemoteSessionPayload,
  type PlatformHost,
  type PlaybackStatePayload,
} from "@asmusic/core";
import { ensureQueueRowIds, newQueueRowId } from "./playerQueueItemFromChild";
import type {
  PlayerQueueItem,
  PlayerToastEvent,
  PlayerViewState,
} from "./types";
import {
  PLAYBACK_QUEUE_STATE_KEY,
  parsePersistedQueue,
  type PersistedPlaybackQueueV1,
} from "./playbackQueuePersistence";
import { playImpactIfEnabled } from "@ui/haptics/playImpactIfEnabled";
import {
  buildNowPlayingCoverArtSources,
  resolveCoverArt,
  toNowPlayingArtwork,
} from "@ui/shared/coverArt";
import { getPlaybackFailureAutoSkipLimit } from "@ui/preferences/playbackFailureAutoSkipLimitPreference";

/** Coalesce host `onPlaybackState` into fewer React updates while playing (position-only ticks). */
const PLAYBACK_UI_EMIT_INTERVAL_MS = 200;

const PERSIST_DEBOUNCE_MS = 900;
/** Throttle position-only persistence while playing (matches legacy iOS ~1.5s). */
const POSITION_PERSIST_INTERVAL_MS = 1500;

export type SavedServerRef = {
  id: string;
  serverUrl: string;
  username: string;
};

export type PlayerManagerDeps = {
  getStreamUrl: (serverId: string, trackId: string) => string | null;
  getCoverArtUrl: (serverId: string, coverArtId: string) => string | null;
  ensureStreamReady: (serverId: string) => Promise<void>;
  isLibraryActive?: (serverId: string, libraryId: string) => boolean;
  getLibraryDisplayName?: (serverId: string, libraryId: string) => string;
  getServerDisplayName?: (serverId: string) => string;
  ensureLibraryNames?: (
    refs: readonly { serverId: string; libraryId: string }[],
  ) => Promise<Record<string, string>>;
};

export type PlayerSleepTimerSnapshot = {
  sleepEndsAtEpochMs: number | null;
};

function emptySnapshot(): PlayerViewState {
  return {
    queue: [],
    currentIndex: null,
    currentItem: null,
    positionSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    loadError: null,
    hasNext: false,
    hasPrevious: false,
    loopQueue: false,
    loopOne: false,
    playingFromLocalFile: false,
  };
}

function normalizeUrl(u: string): string {
  return u.replace(/\/$/, "");
}

function filterQueueForKnownServers(
  queue: PlayerQueueItem[],
  servers: SavedServerRef[],
): PlayerQueueItem[] {
  if (servers.length === 0) return [];
  return queue.filter((it) => {
    const s = servers.find((x) => x.id === it.serverId);
    if (!s) return false;
    return (
      normalizeUrl(s.serverUrl) === normalizeUrl(it.serverUrl) &&
      s.username === it.username
    );
  });
}

function arrayMoveOne<T>(arr: T[], from: number, to: number): void {
  if (
    from === to ||
    from < 0 ||
    from >= arr.length ||
    to < 0 ||
    to > arr.length
  )
    return;
  const [x] = arr.splice(from, 1);
  const insert = to > from ? to - 1 : to;
  arr.splice(insert, 0, x!);
}

export class PlayerManager {
  private readonly host: PlatformHost;
  private readonly deps: PlayerManagerDeps;

  private queue: PlayerQueueItem[] = [];
  private currentIndex: number | null = null;
  private loopQueue = false;
  private loopOne = false;

  private positionSeconds = 0;
  private durationSeconds = 0;
  private isPlaying = false;
  private loadError: string | null = null;
  private playingFromLocalFile = false;

  private revokePlayback: (() => void) | null = null;

  private snapshot: PlayerViewState = emptySnapshot();
  private listeners = new Set<() => void>();
  private unsubState: (() => void) | null = null;
  private unsubEnded: (() => void) | null = null;
  private unsubError: (() => void) | null = null;

  private lastTransportUiEmitAt = 0;
  private playbackThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPositionPersistAt = 0;

  private sleepEndsAtEpochMs: number | null = null;
  /** Referentially stable for `useSyncExternalStore` while `sleepEndsAtEpochMs` is unchanged. */
  private sleepTimerSnapshot: PlayerSleepTimerSnapshot = {
    sleepEndsAtEpochMs: null,
  };
  private sleepListeners = new Set<() => void>();
  private unsubSleepTimer: (() => void) | null = null;

  private lastIosRemoteSession: PlaybackRemoteSessionPayload | null = null;
  private loadTrackSeq = 0;
  private handlingPlaybackEnded = false;
  private handlingPlaybackFailure = false;
  /** Consecutive track failures without confirmed playback; survives async iOS AVPlayer errors. */
  private consecutivePlaybackFailures = 0;

  private toastSeq = 0;
  private toastSnapshot: PlayerToastEvent | null = null;
  private toastListeners = new Set<() => void>();

  constructor(host: PlatformHost, deps: PlayerManagerDeps) {
    this.host = host;
    this.deps = deps;
    this.unsubState = host.playback.onPlaybackState((s) =>
      this.applyHostPlaybackState(s),
    );
    this.unsubEnded = host.playback.onPlaybackEnded(() => {
      void this.handlePlaybackEnded();
    });
    this.unsubError = host.playback.onPlaybackError((e) => {
      const seqAtError = this.loadTrackSeq;
      queueMicrotask(() => {
        if (seqAtError !== this.loadTrackSeq) return;
        void this.handlePlaybackFailure(e.message);
      });
    });
    this.unsubSleepTimer = host.sleepTimer.onElapsed(() => {
      this.handleSleepTimerElapsed();
    });
    this.rebuildSnapshot();
  }

  dispose(): void {
    this.clearPlaybackThrottleTimer();
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.unsubState?.();
    this.unsubState = null;
    this.unsubEnded?.();
    this.unsubEnded = null;
    this.unsubError?.();
    this.unsubError = null;
    this.unsubSleepTimer?.();
    this.unsubSleepTimer = null;
    this.sleepEndsAtEpochMs = null;
    this.syncSleepTimerSnapshot();
    this.sleepListeners.clear();
    void this.host.sleepTimer.setDeadline(null);
    this.revokePlayback?.();
    this.revokePlayback = null;
    this.listeners.clear();
    this.toastListeners.clear();
  }

  private clearPlaybackThrottleTimer(): void {
    if (this.playbackThrottleTimer) {
      clearTimeout(this.playbackThrottleTimer);
      this.playbackThrottleTimer = null;
    }
  }

  /**
   * Always apply latest transport numbers from the host; throttle React `emit` while playing
   * so position-only updates do not re-render the whole app every tick.
   */
  private applyHostPlaybackState(s: PlaybackStatePayload): void {
    const prevPlaying = this.isPlaying;
    const prevDuration = this.durationSeconds;
    this.positionSeconds = s.positionSeconds;
    this.durationSeconds = s.durationSeconds;
    this.isPlaying = s.isPlaying;

    if (s.isPlaying && s.durationSeconds > 0) {
      this.consecutivePlaybackFailures = 0;
    }

    const urgent =
      prevPlaying !== this.isPlaying ||
      (prevDuration <= 0 && this.durationSeconds > 0) ||
      Math.abs(prevDuration - this.durationSeconds) > 0.25;

    if (urgent || !this.isPlaying) {
      this.clearPlaybackThrottleTimer();
      this.lastTransportUiEmitAt = Date.now();
      this.emit();
      if (!this.isPlaying) {
        this.schedulePersist();
      }
      return;
    }

    this.maybeSchedulePositionPersist();

    const now = Date.now();
    if (now - this.lastTransportUiEmitAt >= PLAYBACK_UI_EMIT_INTERVAL_MS) {
      this.lastTransportUiEmitAt = now;
      this.emit();
      return;
    }
    if (!this.playbackThrottleTimer) {
      const wait = Math.max(
        0,
        PLAYBACK_UI_EMIT_INTERVAL_MS - (now - this.lastTransportUiEmitAt),
      );
      this.playbackThrottleTimer = setTimeout(() => {
        this.playbackThrottleTimer = null;
        this.lastTransportUiEmitAt = Date.now();
        this.emit();
      }, wait);
    }
  }

  getSnapshot(): PlayerViewState {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Updates the current queue row's starred snapshot (after a successful library star/unstar). */
  patchCurrentQueueItemStarred(starred: boolean): void {
    if (this.currentIndex === null) return;
    const cur = this.queue[this.currentIndex];
    if (!cur) return;
    const next = [...this.queue];
    next[this.currentIndex] = { ...cur, starred };
    this.queue = next;
    this.emit();
    this.schedulePersist();
  }

  getSleepTimerSnapshot(): PlayerSleepTimerSnapshot {
    return this.sleepTimerSnapshot;
  }

  subscribeSleepTimer(listener: () => void): () => void {
    this.sleepListeners.add(listener);
    return () => {
      this.sleepListeners.delete(listener);
    };
  }

  getToastSnapshot(): PlayerToastEvent | null {
    return this.toastSnapshot;
  }

  subscribeToast(listener: () => void): () => void {
    this.toastListeners.add(listener);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  private emitToast(event: PlayerToastEvent): void {
    this.toastSnapshot = event;
    this.toastListeners.forEach((l) => l());
  }

  private emitPlaybackSkippedToast(failedTitle: string, error: string): void {
    this.emitToast({
      id: ++this.toastSeq,
      messageKey: "player.playback.skippedOnFailure",
      params: { title: failedTitle, error },
    });
  }

  private emitSleep(): void {
    this.sleepListeners.forEach((l) => l());
  }

  private syncSleepTimerSnapshot(): void {
    if (
      this.sleepTimerSnapshot.sleepEndsAtEpochMs !== this.sleepEndsAtEpochMs
    ) {
      this.sleepTimerSnapshot = { sleepEndsAtEpochMs: this.sleepEndsAtEpochMs };
    }
  }

  private handleSleepTimerElapsed(): void {
    this.sleepEndsAtEpochMs = null;
    this.syncSleepTimerSnapshot();
    this.emitSleep();
    void this.host.sleepTimer.setDeadline(null);
    if (this.isPlaying) {
      void this.pause();
    }
  }

  async setSleepTimerMinutes(minutes: number): Promise<void> {
    const m = Math.max(1, Math.min(120, Math.floor(minutes)));
    const endsAt = Date.now() + m * 60_000;
    this.sleepEndsAtEpochMs = endsAt;
    this.syncSleepTimerSnapshot();
    this.emitSleep();
    await this.host.sleepTimer.setDeadline(endsAt);
  }

  async cancelSleepTimer(): Promise<void> {
    this.sleepEndsAtEpochMs = null;
    this.syncSleepTimerSnapshot();
    this.emitSleep();
    await this.host.sleepTimer.setDeadline(null);
  }

  private emit(): void {
    this.rebuildSnapshot();
    this.maybeSyncIosRemoteSession();
    this.listeners.forEach((l) => l());
  }

  private rebuildSnapshot(): void {
    const currentItem =
      this.currentIndex !== null && this.queue[this.currentIndex]
        ? this.queue[this.currentIndex]!
        : null;
    const idx = this.currentIndex;
    const len = this.queue.length;
    const hasNext =
      idx !== null && len > 0 && (idx + 1 < len || this.loopQueue);
    const hasPrevious = idx !== null && len > 0 && (idx > 0 || this.loopQueue);
    this.snapshot = {
      queue: this.queue,
      currentIndex: this.currentIndex,
      currentItem,
      positionSeconds: this.positionSeconds,
      durationSeconds: this.durationSeconds,
      isPlaying: this.isPlaying,
      loadError: this.loadError,
      hasNext,
      hasPrevious,
      loopQueue: this.loopQueue,
      loopOne: this.loopOne,
      playingFromLocalFile: this.playingFromLocalFile,
    };
  }

  private maybeSyncIosRemoteSession(): void {
    if (this.host.kind !== "ios-capacitor") return;
    const sync = this.host.playback.syncRemoteSession;
    if (!sync) return;
    const s = this.snapshot;
    const cur = s.currentItem;
    const payload: PlaybackRemoteSessionPayload = {
      hasNext: s.hasNext,
      hasPrevious: s.hasPrevious,
      favoriteControlsEnabled: cur != null,
      starred: Boolean(cur?.starred),
    };
    const prev = this.lastIosRemoteSession;
    if (
      prev &&
      prev.hasNext === payload.hasNext &&
      prev.hasPrevious === payload.hasPrevious &&
      prev.favoriteControlsEnabled === payload.favoriteControlsEnabled &&
      prev.starred === payload.starred
    ) {
      return;
    }
    this.lastIosRemoteSession = payload;
    void sync(payload);
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistQueueStateNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  private maybeSchedulePositionPersist(): void {
    if (this.currentIndex === null || this.queue.length === 0) return;
    const now = Date.now();
    if (now - this.lastPositionPersistAt < POSITION_PERSIST_INTERVAL_MS) return;
    this.lastPositionPersistAt = now;
    this.schedulePersist();
  }

  private buildPersistPayload(): PersistedPlaybackQueueV1 {
    return {
      v: 1,
      queue: this.queue.map((q) => ({ ...q })),
      currentIndex: this.currentIndex,
      loopQueue: this.loopQueue,
      loopOne: this.loopOne,
      positionSeconds: this.positionSeconds,
    };
  }

  private async persistQueueStateNow(): Promise<void> {
    if (this.queue.length === 0 || this.currentIndex === null) {
      try {
        await this.host.secureStorage.remove(PLAYBACK_QUEUE_STATE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await this.host.secureStorage.set(
        PLAYBACK_QUEUE_STATE_KEY,
        JSON.stringify(this.buildPersistPayload()),
      );
    } catch {
      /* ignore */
    }
  }

  private async clearPersistedQueue(): Promise<void> {
    try {
      await this.host.secureStorage.remove(PLAYBACK_QUEUE_STATE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Restore queue from secure storage when servers are known (call after app/server restore). */
  async hydrateFromPersistence(servers: SavedServerRef[]): Promise<void> {
    if (servers.length === 0 || this.queue.length > 0) return;
    try {
      const raw = await this.host.secureStorage.get(PLAYBACK_QUEUE_STATE_KEY);
      if (this.queue.length > 0) return;
      const parsed = parsePersistedQueue(raw);
      if (!parsed || parsed.queue.length === 0) return;
      if (this.queue.length > 0) return;
      const filtered = filterQueueForKnownServers(parsed.queue, servers);
      if (filtered.length === 0) return;
      const prevIdx = parsed.currentIndex ?? 0;
      const playingRowId =
        parsed.queue[Math.min(Math.max(0, prevIdx), parsed.queue.length - 1)]
          ?.rowId ?? null;
      let idx = playingRowId
        ? filtered.findIndex((q) => q.rowId === playingRowId)
        : -1;
      if (idx < 0) {
        idx = Math.min(Math.max(0, prevIdx), filtered.length - 1);
      }
      this.queue = ensureQueueRowIds(filtered);
      this.currentIndex = idx;
      this.loopQueue = parsed.loopQueue;
      this.loopOne = parsed.loopOne;
      const restorePositionSeconds = parsed.positionSeconds;
      this.loadError = null;
      this.emit();
      await Promise.all(
        servers.map((s) => this.deps.ensureStreamReady(s.id).catch(() => {})),
      );
      await this.loadCurrentTrack({ autoplay: false });
      if (restorePositionSeconds > 0) {
        await this.seek(restorePositionSeconds);
      }
    } catch {
      /* ignore */
    }
  }

  private runRevoke(): void {
    this.revokePlayback?.();
    this.revokePlayback = null;
  }

  private async tearDownPlayback(): Promise<void> {
    this.currentIndex = null;
    this.queue = [];
    this.loadError = null;
    this.playingFromLocalFile = false;
    this.loopQueue = false;
    this.loopOne = false;
    try {
      await this.host.playback.pause();
    } catch {
      /* ignore */
    }
    this.runRevoke();
    await this.clearPersistedQueue();
    this.emit();
  }

  /**
   * When the user enabled "save while streaming", mirror the same stream URL into {@link OfflineMediaStore}
   * in parallel with playback (second HTTP fetch; see offline media plan).
   */
  private startPersistWhileStreamingIfNeeded(
    item: PlayerQueueItem,
    streamUrl: string,
    resolvedPlaybackUrl: string,
  ): void {
    if (resolvedPlaybackUrl !== streamUrl) return;
    if (this.host.offlineMedia.backend === "noop") return;

    void (async () => {
      try {
        const persistRaw = await this.host.secureStorage.get(
          PERSIST_WHILE_STREAMING_KEY,
        );
        if (!readPersistWhileStreamingEnabled(persistRaw)) return;

        const key = {
          scope: libraryCacheScope(
            item.serverUrl,
            item.username,
            item.libraryId,
          ),
          trackId: item.trackId,
        };

        await this.host.offlineMedia.importFromAuthenticatedUrl(key, streamUrl);
      } catch {
        /* ignore background persist errors */
      }
    })();
  }

  private async handlePlaybackEnded(): Promise<void> {
    if (this.handlingPlaybackEnded) {
      return;
    }
    this.handlingPlaybackEnded = true;
    this.consecutivePlaybackFailures = 0;
    try {
      const idx = this.currentIndex;
      if (idx === null || this.queue.length === 0) {
        this.emit();
        return;
      }

      if (this.loopOne) {
        try {
          await this.host.playback.seek(0);
          await this.host.playback.play();
        } catch {
          /* ignore */
        }
        this.emit();
        return;
      }

      if (idx + 1 < this.queue.length) {
        this.currentIndex = idx + 1;
        this.loadError = null;
        this.emit();
        await this.loadCurrentTrack({ autoplay: true });
        this.schedulePersist();
        return;
      }

      if (this.loopQueue && this.queue.length > 0) {
        if (this.queue.length <= 1) {
          try {
            await this.host.playback.seek(0);
            await this.host.playback.play();
          } catch {
            /* ignore */
          }
          this.emit();
          this.schedulePersist();
          return;
        }
        this.currentIndex = 0;
        this.loadError = null;
        this.emit();
        await this.loadCurrentTrack({ autoplay: true });
        this.schedulePersist();
        return;
      }

      try {
        await this.host.playback.pause();
      } catch {
        /* ignore */
      }
      this.isPlaying = false;
      this.emit();
      this.schedulePersist();
    } finally {
      this.handlingPlaybackEnded = false;
    }
  }

  /** On load/transport failure, skip forward through the queue until a track plays, the queue ends, or the failure limit is reached. */
  private async handlePlaybackFailure(errorMessage: string): Promise<void> {
    if (this.handlingPlaybackFailure || this.handlingPlaybackEnded) {
      return;
    }
    const failureLimit = getPlaybackFailureAutoSkipLimit();
    if (this.consecutivePlaybackFailures >= failureLimit) {
      return;
    }
    this.handlingPlaybackFailure = true;
    try {
      this.consecutivePlaybackFailures += 1;
      let lastError = errorMessage;
      while (true) {
        const idx = this.currentIndex;
        if (idx === null || this.queue.length === 0) {
          this.loadError = lastError;
          this.emit();
          return;
        }
        if (this.consecutivePlaybackFailures >= failureLimit) {
          this.loadError = lastError;
          this.isPlaying = false;
          try {
            await this.host.playback.pause();
          } catch {
            /* ignore */
          }
          this.emit();
          this.schedulePersist();
          return;
        }
        if (idx + 1 >= this.queue.length) {
          this.loadError = lastError;
          this.isPlaying = false;
          try {
            await this.host.playback.pause();
          } catch {
            /* ignore */
          }
          this.emit();
          this.schedulePersist();
          return;
        }
        const failedItem = this.queue[idx];
        this.emitPlaybackSkippedToast(failedItem?.title ?? "", lastError);
        const ok = await this.advanceToNextTrack({ autoplay: true });
        if (ok) {
          this.schedulePersist();
          return;
        }
        this.consecutivePlaybackFailures += 1;
        lastError = this.loadError ?? lastError;
      }
    } finally {
      this.handlingPlaybackFailure = false;
    }
  }

  private async advanceToNextTrack(options: {
    autoplay: boolean;
  }): Promise<boolean> {
    const idx = this.currentIndex;
    if (idx === null || idx + 1 >= this.queue.length) {
      return false;
    }
    this.currentIndex = idx + 1;
    this.loadError = null;
    this.emit();
    return this.loadCurrentTrack({
      autoplay: options.autoplay,
      suppressFailureAdvance: true,
    });
  }

  private async skipInactiveLibraryTracks(): Promise<void> {
    if (this.handlingPlaybackFailure || this.handlingPlaybackEnded) {
      return;
    }
    this.handlingPlaybackFailure = true;
    try {
      while (true) {
        const idx = this.currentIndex;
        if (idx === null || this.queue.length === 0) {
          return;
        }
        const item = this.queue[idx]!;
        if (
          !item.serverId ||
          !this.deps.isLibraryActive ||
          this.deps.isLibraryActive(item.serverId, item.libraryId)
        ) {
          const ok = await this.loadCurrentTrack({
            autoplay: true,
            suppressFailureAdvance: true,
          });
          if (ok) {
            this.schedulePersist();
          }
          return;
        }
        const { serverName, libraryName } =
          await this.libraryScopeLabelsForToast(item.serverId, item.libraryId);
        this.emitToast({
          id: ++this.toastSeq,
          messageKey: "player.playback.skippedLibraryDisabled",
          params: { serverName, libraryName },
        });
        if (idx + 1 >= this.queue.length) {
          this.isPlaying = false;
          try {
            await this.host.playback.pause();
          } catch {
            /* ignore */
          }
          this.emit();
          this.schedulePersist();
          return;
        }
        this.currentIndex = idx + 1;
        this.loadError = null;
        this.emit();
      }
    } finally {
      this.handlingPlaybackFailure = false;
    }
  }

  private async libraryScopeLabelsForToast(
    serverId: string,
    libraryId: string,
  ): Promise<{ serverName: string; libraryName: string }> {
    const scopeKey = `${serverId}:${libraryId}`;
    let libraryName =
      this.deps.getLibraryDisplayName?.(serverId, libraryId) ?? libraryId;
    if (this.deps.ensureLibraryNames) {
      const names = await this.deps.ensureLibraryNames([
        { serverId, libraryId },
      ]);
      libraryName = names[scopeKey] ?? libraryName;
    }
    return {
      serverName: this.deps.getServerDisplayName?.(serverId) ?? serverId,
      libraryName,
    };
  }

  private async resolveTrackNowPlayingArtwork(item: PlayerQueueItem): Promise<{
    artworkUrl?: string;
    artworkDataBase64?: string;
    artworkPlaceholderDataBase64: string;
  }> {
    const coverArtId = item.coverArtId?.trim();
    const fallbackId = item.coverArtFallbackId?.trim();
    const idsToTry = [coverArtId, fallbackId].filter(
      (id): id is string => Boolean(id),
    );

    const sources = buildNowPlayingCoverArtSources({
      libraryCache: this.host.libraryCache,
      serverUrl: item.serverUrl,
      username: item.username,
      libraryId: item.libraryId,
      hostKind: this.host.kind,
      getCoverArtUrl: (id) => this.deps.getCoverArtUrl(item.serverId, id),
    });

    const resolved = await resolveCoverArt(idsToTry, sources, {
      logContext: {
        coverArtId,
        fallbackCoverArtId: fallbackId,
        detail: "now playing artwork",
      },
    });
    return toNowPlayingArtwork(resolved, this.host.kind);
  }

  /** Re-push lock-screen / Control Center artwork after cache refresh. */
  async syncCurrentTrackNowPlayingArtwork(): Promise<void> {
    const idx = this.currentIndex;
    const item = idx !== null ? this.queue[idx] : null;
    if (!item?.coverArtId?.trim()) return;
    const art = await this.resolveTrackNowPlayingArtwork(item);
    await this.host.playback.updateArtwork?.(art);
  }

  private async loadCurrentTrack(options: {
    autoplay: boolean;
    suppressFailureAdvance?: boolean;
  }): Promise<boolean> {
    const idx = this.currentIndex;
    if (idx === null || !this.queue[idx]) {
      return false;
    }
    const item = this.queue[idx]!;
    const loadSeq = ++this.loadTrackSeq;

    this.positionSeconds = 0;
    this.loadError = null;
    this.playingFromLocalFile = false;
    this.emit();

    if (
      item.serverId &&
      this.deps.isLibraryActive &&
      !this.deps.isLibraryActive(item.serverId, item.libraryId)
    ) {
      if (!options.suppressFailureAdvance) {
        void this.skipInactiveLibraryTracks();
      }
      return false;
    }

    this.runRevoke();
    try {
      const offlineResolved = await resolvePlaybackSource({
        offlineMedia: this.host.offlineMedia,
        serverUrl: item.serverUrl,
        username: item.username,
        libraryId: item.libraryId,
        trackId: item.trackId,
        streamUrl: "",
      });
      if (loadSeq !== this.loadTrackSeq) return false;

      let playUrl = offlineResolved.url;
      let revoke = offlineResolved.revoke;
      let localFilePath = offlineResolved.localFilePath;
      let streamUrl: string | null = null;

      if (!offlineResolved.usedOffline) {
        await this.deps.ensureStreamReady(item.serverId);
        if (loadSeq !== this.loadTrackSeq) return false;
        streamUrl = this.deps.getStreamUrl(item.serverId, item.trackId);
        if (!streamUrl) {
          this.loadError =
            "Could not build stream URL (sign in or refresh server).";
          this.emit();
          if (!options.suppressFailureAdvance) {
            void this.handlePlaybackFailure(this.loadError);
          }
          return false;
        }
        playUrl = streamUrl;
        revoke = () => {};
        localFilePath = undefined;
      }
      if (loadSeq !== this.loadTrackSeq) return false;

      this.playingFromLocalFile =
        offlineResolved.usedOffline || Boolean(localFilePath);
      if (this.playingFromLocalFile) {
        this.emit();
      }

      if (!offlineResolved.usedOffline && streamUrl) {
        this.startPersistWhileStreamingIfNeeded(item, streamUrl, playUrl);
      }

      const artwork = await this.resolveTrackNowPlayingArtwork(item);

      const playbackRevoke = revoke;
      this.revokePlayback = playbackRevoke;

      // iOS native loads from disk via localFilePath; browser uses blob/object URL from offline store.
      const loadUrlArg =
        offlineResolved.usedOffline && localFilePath ? "" : playUrl;

      await this.host.playback.loadUrl(loadUrlArg, {
        title: item.title,
        artist: item.artist,
        album: item.album,
        artworkUrl: artwork.artworkUrl,
        artworkDataBase64: artwork.artworkDataBase64,
        artworkPlaceholderDataBase64: artwork.artworkPlaceholderDataBase64,
        localFilePath: offlineResolved.usedOffline ? localFilePath : undefined,
      });
      if (loadSeq !== this.loadTrackSeq) return false;
      if (options.autoplay) {
        await this.host.playback.play();
        if (loadSeq === this.loadTrackSeq) {
          playImpactIfEnabled(this.host);
        }
      }
      if (loadSeq === this.loadTrackSeq) {
        this.loadError = null;
        this.emit();
      }
      this.schedulePersist();
      return loadSeq === this.loadTrackSeq;
    } catch (e) {
      if (loadSeq !== this.loadTrackSeq) return false;
      this.loadError = e instanceof Error ? e.message : "Failed to load track";
      this.emit();
      if (!options.suppressFailureAdvance) {
        void this.handlePlaybackFailure(this.loadError);
      }
      return false;
    }
  }

  async replaceQueueAndPlay(
    items: PlayerQueueItem[],
    startIndex: number,
  ): Promise<void> {
    if (items.length === 0) {
      await this.tearDownPlayback();
      return;
    }
    const clamped = Math.max(0, Math.min(startIndex, items.length - 1));
    this.queue = ensureQueueRowIds(items.slice());
    this.currentIndex = clamped;
    this.loadError = null;
    this.consecutivePlaybackFailures = 0;
    this.emit();
    await this.loadCurrentTrack({ autoplay: true });
    this.schedulePersist();
  }

  async togglePlayPause(): Promise<void> {
    if (this.currentIndex === null || this.queue.length === 0) {
      return;
    }
    playImpactIfEnabled(this.host);
    try {
      if (this.isPlaying) {
        await this.host.playback.pause();
      } else {
        await this.host.playback.play();
      }
    } catch {
      /* ignore */
    }
  }

  async play(): Promise<void> {
    if (this.currentIndex === null || this.queue.length === 0) {
      return;
    }
    try {
      await this.host.playback.play();
    } catch {
      /* ignore */
    }
  }

  async pause(): Promise<void> {
    try {
      await this.host.playback.pause();
    } catch {
      /* ignore */
    }
  }

  async seek(positionSeconds: number): Promise<void> {
    const d =
      this.durationSeconds > 0
        ? this.durationSeconds
        : Number.POSITIVE_INFINITY;
    const clamped = Math.max(0, Math.min(positionSeconds, d));
    try {
      await this.host.playback.seek(clamped);
    } catch {
      /* ignore */
    }
    this.schedulePersist();
  }

  async seekBy(deltaSeconds: number): Promise<void> {
    const base = this.positionSeconds;
    const d =
      this.durationSeconds > 0
        ? this.durationSeconds
        : base + Math.abs(deltaSeconds);
    const next = Math.max(0, Math.min(base + deltaSeconds, d));
    await this.seek(next);
  }

  async skipNext(): Promise<void> {
    const idx = this.currentIndex;
    if (idx === null || this.queue.length === 0) {
      return;
    }
    if (idx + 1 < this.queue.length) {
      this.currentIndex = idx + 1;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
      this.schedulePersist();
      return;
    }
    if (this.loopQueue) {
      this.currentIndex = 0;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
      this.schedulePersist();
    }
  }

  async skipPrevious(): Promise<void> {
    const idx = this.currentIndex;
    if (idx === null || this.queue.length === 0) {
      return;
    }
    if (idx > 0) {
      this.currentIndex = idx - 1;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
      this.schedulePersist();
      return;
    }
    if (this.loopQueue) {
      this.currentIndex = this.queue.length - 1;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
      this.schedulePersist();
    }
  }

  /**
   * Append tracks at the end. If the queue was empty, starts playback at the first appended item.
   */
  async appendToQueue(items: PlayerQueueItem[]): Promise<void> {
    const normalized = ensureQueueRowIds(items);
    if (normalized.length === 0) {
      return;
    }
    if (this.queue.length === 0) {
      this.queue = normalized;
      this.currentIndex = 0;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
      this.schedulePersist();
      return;
    }
    this.queue.push(...normalized);
    this.emit();
    this.schedulePersist();
  }

  /**
   * Insert items immediately after the current track. If the queue is empty or nothing is current,
   * behaves like `replaceQueueAndPlay` at index 0. When `playFirst` is true, jumps to the first
   * inserted item and starts playback.
   */
  async insertAfterCurrent(
    items: PlayerQueueItem[],
    options?: { playFirst?: boolean },
  ): Promise<void> {
    const normalized = ensureQueueRowIds(items);
    if (normalized.length === 0) {
      return;
    }
    const playFirst = options?.playFirst ?? false;
    if (this.queue.length === 0) {
      await this.replaceQueueAndPlay(normalized, 0);
      return;
    }
    if (this.currentIndex === null) {
      this.currentIndex = 0;
    }
    const idx = this.currentIndex;
    const insertAt = idx + 1;
    this.queue.splice(insertAt, 0, ...normalized);
    if (playFirst) {
      this.currentIndex = insertAt;
      this.loadError = null;
      this.consecutivePlaybackFailures = 0;
      this.emit();
      await this.loadCurrentTrack({ autoplay: true });
    } else {
      this.emit();
    }
    this.schedulePersist();
  }

  async playQueueIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) {
      return;
    }
    this.currentIndex = index;
    this.loadError = null;
    this.consecutivePlaybackFailures = 0;
    this.emit();
    await this.loadCurrentTrack({ autoplay: true });
    this.schedulePersist();
  }

  toggleLoopQueue(): void {
    this.loopQueue = !this.loopQueue;
    this.emit();
    this.schedulePersist();
  }

  toggleLoopOne(): void {
    this.loopOne = !this.loopOne;
    this.emit();
    this.schedulePersist();
  }

  async reshuffleQueuePreservingCurrent(): Promise<void> {
    if (this.queue.length <= 1) return;
    const playingRowId =
      this.currentIndex !== null && this.queue[this.currentIndex]
        ? this.queue[this.currentIndex]!.rowId
        : null;
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j]!, this.queue[i]!];
    }
    if (playingRowId) {
      const ni = this.queue.findIndex((q) => q.rowId === playingRowId);
      this.currentIndex = ni >= 0 ? ni : this.currentIndex;
    }
    this.emit();
    this.schedulePersist();
  }

  clearQueueExceptCurrent(): void {
    if (this.queue.length === 0) return;
    if (this.currentIndex !== null && this.queue[this.currentIndex]) {
      const cur = this.queue[this.currentIndex]!;
      this.queue = [{ ...cur, rowId: cur.rowId }];
      this.currentIndex = 0;
    } else {
      const first = this.queue[0];
      if (first) {
        this.queue = [{ ...first, rowId: first.rowId }];
        this.currentIndex = 0;
      }
    }
    this.emit();
    this.schedulePersist();
  }

  duplicateQueueIndexToEnd(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    const src = this.queue[index]!;
    this.queue.push({ ...src, rowId: newQueueRowId() });
    this.emit();
    this.schedulePersist();
  }

  moveQueueIndexToPlayNext(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    const cur = this.currentIndex;
    if (cur === null || !this.queue[cur]) return;

    const target = Math.min(cur + 1, this.queue.length - 1);
    if (index === cur || index === target) return;

    const moving = this.queue.splice(index, 1)[0]!;
    const insertionIndex = index < target ? target - 1 : target;
    this.queue.splice(insertionIndex, 0, moving);

    let newCur = cur;
    if (index < cur) newCur -= 1;
    if (insertionIndex <= newCur) newCur += 1;
    this.currentIndex = newCur;

    this.emit();
    this.schedulePersist();
  }

  reorderQueue(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const playingRowId =
      this.currentIndex !== null && this.queue[this.currentIndex]
        ? this.queue[this.currentIndex]!.rowId
        : null;
    arrayMoveOne(this.queue, fromIndex, toIndex);
    if (playingRowId) {
      const ni = this.queue.findIndex((q) => q.rowId === playingRowId);
      this.currentIndex = ni >= 0 ? ni : this.currentIndex;
    }
    this.emit();
    this.schedulePersist();
  }

  async removeQueueIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;
    const oldCount = this.queue.length;
    const wasCurrent = this.currentIndex === index;
    const idxBefore = this.currentIndex;

    this.queue.splice(index, 1);

    if (this.queue.length === 0) {
      await this.tearDownPlayback();
      return;
    }

    if (idxBefore !== null) {
      if (index < idxBefore) {
        this.currentIndex = idxBefore - 1;
      } else if (wasCurrent) {
        const newIdx = index < oldCount - 1 ? index : this.queue.length - 1;
        this.currentIndex = newIdx;
        this.loadError = null;
        this.emit();
        await this.loadCurrentTrack({ autoplay: true });
        this.schedulePersist();
        return;
      }
    }

    this.emit();
    this.schedulePersist();
  }
}
