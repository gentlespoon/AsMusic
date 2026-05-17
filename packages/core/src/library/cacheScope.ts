import { DEFAULT_LIBRARY_ID } from './constants';

/**
 * Stable scope for library cache rows (mirrors legacy `server_id` + `library_id`).
 * {@link LibraryCacheScope.serverKey} is stable per server **account** (URL + username); `libraryId` selects the
 * music folder so all libraries for one account share one `serverKey` and can be purged together.
 */
export type LibraryCacheScope = {
  serverKey: string;
  libraryId: string;
};

/** Opaque id for a server account (URL + username), shared by all music folders on that account. */
export function serverAccountKey(serverUrl: string, username: string): string {
  const normalized = serverUrl.trim().replace(/\/+$/, '');
  const base = `${normalized}\n${username.trim()}`;
  return hashScopeKey(base);
}

/** Scope variants for offline lookups (handles legacy URL forms already stored in native DB). */
export function offlineLookupScopes(
  serverUrl: string,
  username: string,
  libraryId: string = DEFAULT_LIBRARY_ID
): LibraryCacheScope[] {
  const trimmed = serverUrl.trim();
  const urlVariants = new Set<string>();
  if (trimmed.length > 0) urlVariants.add(trimmed);
  const noSlash = trimmed.replace(/\/+$/, '');
  if (noSlash.length > 0) urlVariants.add(noSlash);
  if (noSlash.length > 0) urlVariants.add(`${noSlash}/`);

  const scopes: LibraryCacheScope[] = [];
  const seenKeys = new Set<string>();
  for (const url of urlVariants) {
    const scope = libraryCacheScope(url, username, libraryId);
    if (seenKeys.has(scope.serverKey)) continue;
    seenKeys.add(scope.serverKey);
    scopes.push(scope);
  }
  return scopes;
}

/** Build a cache scope for `(server, user, music folder)`. */
export function libraryCacheScope(
  serverUrl: string,
  username: string,
  libraryId: string = DEFAULT_LIBRARY_ID
): LibraryCacheScope {
  return { serverKey: serverAccountKey(serverUrl, username), libraryId };
}

function hashScopeKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
