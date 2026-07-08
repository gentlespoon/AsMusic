import { forwardRef } from 'react';
import Box from '@mui/material/Box';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';

const pulse = keyframes`
  50% { opacity: 0.65; }
`;

function coverPlaceholderGradient(theme: Theme): string {
  if (theme.palette.mode === 'light') {
    return `linear-gradient(135deg, ${theme.palette.grey[200]} 0%, ${theme.palette.grey[400]} 100%)`;
  }
  return `linear-gradient(135deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 100%)`;
}

const baseCoverSx: SxProps<Theme> = {
  display: 'block',
  width: '100%',
  height: '100%',
};

type Props = {
  sx?: SxProps<Theme>;
  label?: string;
  /** Pulsing gradient while cover art is still loading. */
  loading?: boolean;
};

/** Theme-aware fallback when cover art is missing or could not be loaded. */
export const CoverArtPlaceholder = forwardRef<HTMLDivElement, Props>(function CoverArtPlaceholder(
  { sx, label, loading = false },
  ref,
) {
  const combinedSx = [...(Array.isArray(sx) ? sx : sx ? [sx] : [])];

  return (
    <Box
      ref={ref}
      aria-hidden={!label}
      role={label ? 'img' : undefined}
      aria-label={label}
      sx={[
        baseCoverSx,
        {
          containerType: 'size',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: (theme) => coverPlaceholderGradient(theme),
          color: (theme) =>
            theme.palette.mode === 'light' ? theme.palette.grey[600] : theme.palette.grey[400],
          animation: loading ? `${pulse} 1.2s ease-in-out infinite` : undefined,
          userSelect: 'none',
        },
        ...combinedSx,
      ]}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          fontSize: 'min(50cqmin, 8rem)',
          lineHeight: 1,
        }}
      >
        ♬
      </Box>
    </Box>
  );
});
