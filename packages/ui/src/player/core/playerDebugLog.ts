import { registerPlugin } from '@capacitor/core';
import type { PlatformHost } from '@asmusic/core';

/** JS-side ring buffer key (secure storage). Merged with native iOS log on export. */
const DEBUG_KEY = 'asmusic-player-debug-v1';
const MAX_LINES = 100;

type PlayerDebugNativePlugin = {
  playerDebugLogGet(): Promise<{ log: string }>;
  playerDebugLogClear(): Promise<void>;
};

const PlayerDebugNative = registerPlugin<PlayerDebugNativePlugin>('AsmusicNative');

/** Append one NDJSON line to the JS player debug log (no-op on storage failure). */
export async function appendPlayerDebugLog(
  host: PlatformHost,
  location: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const line = JSON.stringify({ t: Date.now(), location, message, data });
  try {
    const raw = await host.secureStorage.get(DEBUG_KEY);
    const lines = raw ? raw.split('\n').filter(Boolean) : [];
    lines.push(line);
    while (lines.length > MAX_LINES) {
      lines.shift();
    }
    await host.secureStorage.set(DEBUG_KEY, lines.join('\n'));
  } catch {
    /* ignore */
  }
}

async function readJsPlayerDebugLog(host: PlatformHost): Promise<string> {
  try {
    return (await host.secureStorage.get(DEBUG_KEY)) ?? '';
  } catch {
    return '';
  }
}

async function readNativePlayerDebugLog(host: PlatformHost): Promise<string> {
  if (host.kind !== 'ios-capacitor') return '';
  try {
    const { log } = await PlayerDebugNative.playerDebugLogGet();
    return log ?? '';
  } catch {
    return '';
  }
}

export async function exportPlayerDebugLog(host: PlatformHost): Promise<string> {
  const [native, js] = await Promise.all([
    readNativePlayerDebugLog(host),
    readJsPlayerDebugLog(host),
  ]);
  return ['=== native (iOS) ===', native.trim(), '', '=== js ===', js.trim()].join('\n');
}

export async function clearPlayerDebugLog(host: PlatformHost): Promise<void> {
  try {
    await host.secureStorage.remove(DEBUG_KEY);
  } catch {
    /* ignore */
  }
  if (host.kind === 'ios-capacitor') {
    try {
      await PlayerDebugNative.playerDebugLogClear();
    } catch {
      /* ignore */
    }
  }
}

export async function copyPlayerDebugLogToClipboard(host: PlatformHost): Promise<string> {
  const text = await exportPlayerDebugLog(host);
  try {
    await host.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
  return text;
}
