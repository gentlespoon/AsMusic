/** Base height of the fixed mini player (excluding device safe-area inset, applied separately on the bar). */
export const PLAYER_MINI_BAR_BASE_PX = 96;

/** Height when the full-screen player is open (queue + minimize controls only). */
export const PLAYER_MINI_BAR_COMPACT_PX = 56;

/** Reserve space for the always-visible mini player - home indicator safe area.  */
export const playerDockPaddingBottomSx = {
  pb: `calc(${PLAYER_MINI_BAR_BASE_PX}px - env(safe-area-inset-bottom, 0px))`,
} as const;
