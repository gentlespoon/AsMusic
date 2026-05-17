import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { Box } from '@mui/material';

/** Virtuoso `components.List` uses an `HTMLDivElement` ref; use semantic `role="list"`. */
export const VirtuosoMuiList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function VirtuosoMuiList({ style, className, children, ...rest }, ref) {
    return (
      <Box
        ref={ref}
        component="div"
        role="list"
        className={className}
        style={style}
        {...rest}
        sx={{ p: 0, m: 0 }}
      >
        {children}
      </Box>
    );
  }
);
