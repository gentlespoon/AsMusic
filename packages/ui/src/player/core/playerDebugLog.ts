import type { PlatformHost } from '@asmusic/core';
import { AsmusicNative } from '@asmusic/shell';

/** JS player log in secure storage (reset at each web session boundary). */
const DEBUG_KEY = 'asmusic-player-debug-v1';
const MAX_LINES = 100;

const sessionId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const sessionStartedMs = Date.now();

let sessionBoundaryReady = false;
let sessionBoundaryTask: Promise<void> | null = null;

export type PlayerDebugLogCopyResult = {
  text: string;
  clipboardOk: boolean;
};

type ParsedLogLine = {
  sessionId?: string;
  t?: number;
};

function parseLogLine(line: string): ParsedLogLine | null {
  try {
    return JSON.parse(line) as ParsedLogLine;
  } catch {
    return null;
  }
}

/** Drop Keychain lines from older launches that lack this session id. */
function filterLinesForCurrentSession(raw: string): string {
  const lines = raw.split('\n').filter(Boolean);
  const kept: string[] = [];
  for (const line of lines) {
    const parsed = parseLogLine(line);
    if (!parsed) continue;
    if (parsed.sessionId === sessionId) {
      kept.push(line);
      continue;
    }
    if (
      parsed.sessionId == null &&
      typeof parsed.t === 'number' &&
      parsed.t >= sessionStartedMs - 2_000
    ) {
      kept.push(line);
    }
  }
  return kept.join('\n');
}

async function ensureSessionLogBoundary(host: PlatformHost): Promise<void> {
  if (sessionBoundaryReady) return;
  if (sessionBoundaryTask) return sessionBoundaryTask;

  sessionBoundaryTask = (async () => {
    const marker = JSON.stringify({
      t: sessionStartedMs,
      sessionId,
      location: 'playerDebugLog',
      message: 'session.start',
      data: { hostKind: host.kind },
    });

    try {
      await host.secureStorage.remove(DEBUG_KEY);
      if (host.kind === 'ios-capacitor') {
        await AsmusicNative.playerDebugLogClear();
      }
      await host.secureStorage.set(DEBUG_KEY, marker);
    } catch {
      /* ignore */
    }

    sessionBoundaryReady = true;
    sessionBoundaryTask = null;
  })();

  return sessionBoundaryTask;
}

/** Reset persisted logs so copy export reflects this launch only. */
export async function notePlayerDebugSessionStart(host: PlatformHost): Promise<void> {
  await ensureSessionLogBoundary(host);
}

/** Append one NDJSON line to the JS player debug log (no-op on storage failure). */
export async function appendPlayerDebugLog(
  host: PlatformHost,
  location: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await ensureSessionLogBoundary(host);
  const line = JSON.stringify({ t: Date.now(), sessionId, location, message, data });
  console.info(`[AsMusic][player] ${line}`);
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
    const raw = (await host.secureStorage.get(DEBUG_KEY)) ?? '';
    return filterLinesForCurrentSession(raw);
  } catch {
    return '';
  }
}

async function readNativePlayerDebugLog(host: PlatformHost): Promise<string> {
  if (host.kind !== 'ios-capacitor') return '';
  try {
    const { log } = await AsmusicNative.playerDebugLogGet();
    return log ?? '';
  } catch {
    return '';
  }
}

export async function exportPlayerDebugLog(host: PlatformHost): Promise<string> {
  await ensureSessionLogBoundary(host);
  const [native, js] = await Promise.all([
    readNativePlayerDebugLog(host),
    readJsPlayerDebugLog(host),
  ]);
  return [
    '=== native (iOS) ===',
    native.trim() || '(empty)',
    '',
    '=== js ===',
    js.trim() || '(empty)',
  ].join('\n');
}

export async function clearPlayerDebugLog(host: PlatformHost): Promise<void> {
  try {
    await host.secureStorage.remove(DEBUG_KEY);
  } catch {
    /* ignore */
  }
  if (host.kind === 'ios-capacitor') {
    try {
      await AsmusicNative.playerDebugLogClear();
    } catch {
      /* ignore */
    }
  }
}

export async function copyPlayerDebugLogToClipboard(
  host: PlatformHost,
): Promise<PlayerDebugLogCopyResult> {
  const text = await exportPlayerDebugLog(host);
  let clipboardOk = false;
  try {
    clipboardOk = await host.clipboard.writeText(text);
  } catch {
    clipboardOk = false;
  }
  return { text, clipboardOk };
}