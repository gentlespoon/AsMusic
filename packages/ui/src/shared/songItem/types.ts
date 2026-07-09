import type { ReactNode } from "react";
import type { Child } from "subsonic-api";
import type { LibraryArtworkCacheRow, SubsonicAPI } from "@asmusic/core";
import type { PersistCachedArtwork } from "@ui/shared/libraryArtworkCacheAccess";
import type { SongItemOfflineScope } from "./useSongItemOfflineActions";

export type SongItemProps = {
  track: Child;
  coverArtId?: string;
  /** Album-level cover id tried when `coverArtId` cannot be loaded. */
  fallbackCoverArtId?: string;
  /** When true, row is grayed out (e.g. track from inactive library). */
  unavailable?: boolean;
  /** When null (e.g. server removed), cover art falls back to a placeholder. */
  api: SubsonicAPI | null;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkCacheBump: number;
  /** Scope/library disambiguator for shared cover-art object URL cache. */
  artworkCacheKey?: string;
  /** When false (e.g. album track list), secondary line omits album title. */
  includeAlbumInSecondary: boolean;
  /** When set, replaces the default artist/album/duration secondary line. */
  secondaryContent?: ReactNode;
  /** When set, shows download/remove in the actions menu based on offline storage. */
  offlineScope?: SongItemOfflineScope;
  /** Explicit remove handler (e.g. downloaded list); overrides offline-scope remove. */
  onRemoveDownload?: () => void;
  /** Primary tap: play this track immediately after the current item (queue-preserving). */
  onClick?: () => void;
  onPlayNext?: () => void;
  onAppendToQueue?: () => void;
  onViewArtist?: () => void;
  onViewAlbum?: () => void;
  /** When set with `onToggleStar`, shows favorites in the actions menu. */
  isStarred?: boolean;
  onToggleStar?: () => void | Promise<void>;
  /** When set, shows the downloaded indicator (e.g. downloaded tracks list). */
  isDownloaded?: boolean;
};

export type SongItemMainProps = {
  track: Child;
  secondary: ReactNode;
  noWrapSecondary: boolean;
  api: SubsonicAPI | null;
  coverArtId?: string;
  fallbackCoverArtId?: string;
  resolveCachedArtwork: (
    coverArtId: string,
  ) => Promise<LibraryArtworkCacheRow | null>;
  resolveArtworkLocalFile?: (
    coverArtId: string,
  ) => Promise<{ localFilePath: string; mimeType: string } | null>;
  persistCachedArtwork?: PersistCachedArtwork;
  artworkCacheBump: number;
  artworkCacheKey?: string;
};
