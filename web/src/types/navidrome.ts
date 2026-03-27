/**
 * Types for Navidrome / Subsonic API responses.
 * IDs are strings (MD5 or UUID).
 */

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  songCount?: number;
  coverArt?: string;
  year?: number;
}

export interface Song {
  id: string;
  parent: string;
  title: string;
  album: string;
  albumId: string;
  artist: string;
  artistId: string;
  duration: number;
  coverArt?: string;
  track?: number;
  year?: number;
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  duration: number;
  owner?: string;
  created?: string;
  changed?: string;
}
