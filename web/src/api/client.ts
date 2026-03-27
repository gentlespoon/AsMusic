/**
 * Navidrome API client using subsonic-api (Subsonic/OpenSubsonic).
 * Create an instance with createNavidromeApi() after you have server URL and credentials.
 * @see https://github.com/explodingcamera/subsonic-api
 * @see https://navidrome.org/docs/developers/subsonic-api
 */

import { SubsonicAPI } from "subsonic-api";

export function getApiBase(): string {
  return import.meta.env.VITE_NAVIDROME_URL ?? "";
}

export type NavidromeAuth =
  | { username: string; password: string }
  | { apiKey: string };

/**
 * Create a Subsonic/Navidrome API client. Use this after the user has entered
 * server URL and credentials (e.g. on login). The instance supports all
 * Subsonic 1.16.1 + OpenSubsonic methods (getIndexes, getAlbum, getPlaylists,
 * search2, stream, getCoverArt, etc.).
 */
export function createNavidromeApi(
  baseUrl: string = getApiBase(),
  auth: NavidromeAuth,
  options?: { reuseSalt?: boolean },
): SubsonicAPI {
  const url = baseUrl.replace(/\/$/, "");
  return new SubsonicAPI({
    url,
    auth,
    reuseSalt: options?.reuseSalt ?? true,
  });
}

export type { SubsonicAPI };
