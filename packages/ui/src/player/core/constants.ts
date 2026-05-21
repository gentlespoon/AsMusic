/** Base height of the fixed mini player (positioned above the bottom safe area). */
export const PLAYER_MINI_BAR_BASE_PX = 56;

/** Height when the full-screen player is open (queue + minimize controls only). */
export const PLAYER_MINI_BAR_COMPACT_PX = 56;

/** Reserve space for the fixed mini player (sits above the bottom safe area). */
export const playerDockPaddingBottomSx = {
  pb: `${PLAYER_MINI_BAR_BASE_PX}px`,
} as const;
