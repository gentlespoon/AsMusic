/**
 * Auth helpers for Navidrome.
 * Use createNavidromeApi() from ./client with username/password or apiKey.
 * Then call api.ping() to verify connectivity and credentials.
 */

import { createNavidromeApi } from './client';
import type { NavidromeAuth } from './client';

/**
 * Verify server is reachable and credentials are valid.
 * Returns true if ping succeeds, false otherwise.
 */
export async function ping(baseUrl: string, auth: NavidromeAuth): Promise<boolean> {
  try {
    const api = createNavidromeApi(baseUrl, auth);
    const response = await api.ping();
    return response?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Optional: get Navidrome session (token/salt) for persisting auth without storing password.
 * Call api.navidromeSession() on a SubsonicAPI instance; only supported on Navidrome servers.
 */
