/** Fixed row height so Virtuoso can place rows without measuring the whole queue. */
export const PLAYING_QUEUE_ROW_HEIGHT = 64;

export {
  BOUNDED_LIST_WINDOW as PLAYING_QUEUE_WINDOW,
  centeredWindowStart as playingQueueWindowStart,
  nextBoundedWindowStart as nextPlayingQueueWindowStart,
} from "@ui/shared/boundedListWindow";
