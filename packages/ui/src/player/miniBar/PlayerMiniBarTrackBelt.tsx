import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PlayerQueueItem } from '@ui/player/core/types';

export type PlayerMiniBarTrackBeltProps = {
  slots: PlayerQueueItem[];
  activeIndex: number;
  dragPx: number;
  dragging: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  emptyMetadata: string;
};

function TrackSlot({
  item,
  emptyTitle,
  emptySubtitle,
  emptyMetadata,
}: {
  item: PlayerQueueItem | null;
  emptyTitle: string;
  emptySubtitle: string;
  emptyMetadata: string;
}) {
  const subtitle = item
    ? [item.artist, item.album].filter(Boolean).join(' · ')
    : emptySubtitle;

  return (
    <Box sx={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {item?.title ?? emptyTitle}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: 'block', lineHeight: 1.2 }}
      >
        {item ? subtitle || emptyMetadata : emptySubtitle}
      </Typography>
    </Box>
  );
}

export function PlayerMiniBarTrackBelt({
  slots,
  activeIndex,
  dragPx,
  dragging,
  emptyTitle,
  emptySubtitle,
  emptyMetadata,
}: PlayerMiniBarTrackBeltProps) {
  if (slots.length === 0) {
    return (
      <TrackSlot
        item={null}
        emptyTitle={emptyTitle}
        emptySubtitle={emptySubtitle}
        emptyMetadata={emptyMetadata}
      />
    );
  }

  if (slots.length === 1) {
    return (
      <TrackSlot
        item={slots[0] ?? null}
        emptyTitle={emptyTitle}
        emptySubtitle={emptySubtitle}
        emptyMetadata={emptyMetadata}
      />
    );
  }

  const slotPercent = 100 / slots.length;

  return (
    <Box sx={{ overflow: 'hidden', width: '100%', minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          width: `${slots.length * 100}%`,
          transform: `translateX(calc(-${activeIndex * 100}% / ${slots.length} + ${dragPx}px))`,
          transition: dragging ? 'none' : 'transform 0.22s ease-out',
          willChange: 'transform',
        }}
      >
        {slots.map((slot) => (
          <Box
            key={slot.rowId}
            sx={{
              flex: `0 0 ${slotPercent}%`,
              width: `${slotPercent}%`,
              minWidth: 0,
              pr: 0.25,
              boxSizing: 'border-box',
            }}
          >
            <TrackSlot
              item={slot}
              emptyTitle={emptyTitle}
              emptySubtitle={emptySubtitle}
              emptyMetadata={emptyMetadata}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
