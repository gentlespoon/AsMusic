---
name: Server transcode toggle
overview: Add a Playback settings switch “Use server transcode” (default ON). When ON, stream/download with `format=mp3` and offline `variant=mp3`; when OFF, use original format and the default empty offline variant.
todos:
  - id: pref-module
    content: Add serverTranscodePreference + offlineMediaVariantForCurrentStream helper
    status: completed
  - id: settings-i18n
    content: Add PlaybackView switch and i18n strings in all locales
    status: completed
  - id: stream-conditional
    content: Only append format=mp3 in getStreamUrl when preference ON
    status: completed
  - id: offline-variant
    content: Pass preference-based variant through playbackResolver and all UI offline call sites
    status: completed
isProject: false
---

# Server transcode settings toggle

## Behavior

| Setting          | Stream URL        | Offline `variant` |
| ---------------- | ----------------- | ----------------- |
| **ON** (default) | `format=mp3`      | `'mp3'`           |
| **OFF**          | no `format` (raw) | `''` (default)    |

No migration when toggling: each mode only sees its own offline blobs. Copy:

- Title: **Use server transcode**
- Caption: **ON to use MP3 for maximum compatibility. OFF to use original format; some formats may not play.**

## Implementation

### 1. Preference module

Add [`packages/ui/src/preferences/serverTranscodePreference.ts`](packages/ui/src/preferences/serverTranscodePreference.ts) mirroring [`hapticFeedbackPreference.ts`](packages/ui/src/preferences/hapticFeedbackPreference.ts):

- Key: `asmusic-server-transcode-v1`
- Default **ON** (`localStorage` missing or not `'0'`)
- Export `getServerTranscodeEnabled`, `setServerTranscodeEnabled`, `useServerTranscodeEnabled`

Add a tiny helper in the same file (or next to stream usage):

```ts
export function offlineMediaVariantForCurrentStream(): string {
  return getServerTranscodeEnabled()
    ? OFFLINE_MEDIA_STREAM_VARIANT
    : OFFLINE_MEDIA_DEFAULT_VARIANT;
}
```

### 2. Settings UI + i18n

In [`PlaybackView.tsx`](packages/ui/src/views/settings/PlaybackView.tsx), add a Switch row (same pattern as persist-while-streaming).

Strings in all locales (`en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `es-ES`):

- `settings.ux.serverTranscode` / `.caption`
- Extend `settings.playback.caption` to mention server transcode briefly

### 3. Conditional stream URL

In [`ServerAndLibraryContext.tsx`](packages/ui/src/contexts/ServerAndLibraryContext.tsx) `getStreamUrl`: only include `format: STREAM_FORMAT` when `getServerTranscodeEnabled()` is true (read live so toggles apply on next track load / download enqueue without remounting).

### 4. Offline variant follows preference

**Core:** change [`playbackResolver.ts`](packages/core/src/offline/playbackResolver.ts) to take `variant` on `ResolvePlaybackSourceArgs` instead of hardcoding `OFFLINE_MEDIA_STREAM_VARIANT`.

**UI callers** replace hardcoded `OFFLINE_MEDIA_STREAM_VARIANT` with `offlineMediaVariantForCurrentStream()`:

- [`PlayerManager.ts`](packages/ui/src/player/core/PlayerManager.ts) — persist key + pass `variant` into `resolvePlaybackSource`
- [`OfflineDownloadContext.tsx`](packages/ui/src/contexts/OfflineDownloadContext.tsx)
- [`useSongItemOfflineActions.ts`](packages/ui/src/shared/songItem/useSongItemOfflineActions.ts)
- [`useOfflineReadyForItem.ts`](packages/ui/src/player/useOfflineReadyForItem.ts)
- [`trackWaveformCacheKey.ts`](packages/ui/src/player/trackWaveformCacheKey.ts)
- [`useWaveformPeaks.ts`](packages/ui/src/player/fullScreen/useWaveformPeaks.ts)

Keep `STREAM_FORMAT` / `OFFLINE_MEDIA_STREAM_VARIANT` in core as the ON-mode constants.

## Verify

- Default ON: stream URL has `format=mp3`; WMA plays.
- Toggle OFF: new stream URL has no `format`; already-MP3 still plays; WMA may fail on iOS.
- Download under ON → indicator ready; toggle OFF → same track shows not downloaded (different variant); toggle back ON → ready again.
