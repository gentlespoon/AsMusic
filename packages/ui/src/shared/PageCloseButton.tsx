import Close from '@mui/icons-material/Close';
import { IconButton, Tooltip, type IconButtonProps } from '@mui/material';

export type PageCloseButtonProps = Omit<IconButtonProps, 'children'> & {
  tooltip?: string;
};

/** Consistent full-page / overlay dismiss control (X icon). */
export function PageCloseButton({
  tooltip = 'Close',
  'aria-label': ariaLabel = 'Close',
  color = 'inherit',
  size = 'small',
  ...rest
}: PageCloseButtonProps) {
  return (
    <Tooltip title={tooltip}>
      <IconButton color={color} aria-label={ariaLabel} size={size} {...rest}>
        <Close fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
