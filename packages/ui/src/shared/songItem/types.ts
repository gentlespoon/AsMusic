import type { ReactNode } from "react";
import type { Child } from "subsonic-api";
import type { LibraryArtworkCacheRow, SubsonicAPI } from "@asmusic/core";
import type { PersistCachedArtwork } from "../libraryArtworkCacheAccess";

export type SongItemProps = {
  track: Child;
  coverArtId?: string;
  /** When true, row is grayed out (e.g. track from inactive library). */
  unavailable?: boolean;
  /** When null (e.g. server removed), cover art falls back to a placeholder. */
  api: SubsonicAPI | null;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkCacheBump: number;
  /** Scope/library disambiguator for shared cover-art object URL cache. */
  artworkCacheKey?: string;
  /** When false (e.g. album track list), secondary line omits album title. */
  includeAlbumInSecondary: boolean;
  /** When set, replaces the default artist/album/duration secondary line. */
  secondaryContent?: ReactNode;
  /** When true and `onRemove` is set, adds remove-download to the song actions menu. */
  showRemoveButton?: boolean;
  onRemove?: () => void;
  /** Primary tap: play this track immediately after the current item (queue-preserving). */
  onClick?: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  /** When set with `onToggleStar`, shows a favorites control. */
  isStarred?: boolean;
  onToggleStar?: () => void | Promise<void>;
};

export type SongItemMainProps = {
  track: Child;
  secondary: ReactNode;
  noWrapSecondary: boolean;
  api: SubsonicAPI | null;
  coverArtId?: string;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkCacheBump: number;
  artworkCacheKey?: string;
};
