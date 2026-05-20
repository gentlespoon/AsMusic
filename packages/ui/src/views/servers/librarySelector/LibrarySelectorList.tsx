import { useI18n, useT } from '@asmusic/i18n';
import {
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useServerAndLibrary } from '../../../contexts';
import {
  SettingsListItemCaption,
} from '../../settings/SettingsTypography';
import { libraryRowKey } from './libraryRowKey';
import { libraryRowStatsLines } from './libraryRowStatsLines';
import type { LibraryRow, LibraryRowCacheStats } from './types';

export function LibrarySelectorList({
  rows,
  cacheStatsByRowKey,
  refreshingKey,
  refreshDisabledGlobal,
  onRefreshRow,
}: {
  rows: LibraryRow[];
  cacheStatsByRowKey: Record<string, LibraryRowCacheStats | null>;
  refreshingKey: string | null;
  refreshDisabledGlobal: boolean;
  onRefreshRow: (row: LibraryRow) => void;
}) {
  const t = useT();
  const { format } = useI18n();
  const { toggleActiveLibrary, isLibraryActive } = useServerAndLibrary();

  return (
    <List disablePadding sx={{ width: '100%', overflow: 'hidden' }}>
      {rows.map((row) => {
        const disabled = row.libraryId === 'unreachable';
        const ref = { serverId: row.serverId, libraryId: row.libraryId };
        const checked = !disabled && isLibraryActive(ref);
        const rk = libraryRowKey(row);
        const rowRefreshing = refreshingKey === rk;
        const refreshDisabled = disabled || !checked || refreshDisabledGlobal;
        const statsLines = libraryRowStatsLines(cacheStatsByRowKey[rk], t, format);
        return (
          <ListItem
            key={rk}
            disablePadding
            divider
            sx={{ alignItems: 'center', maxWidth: '100%' }}
            secondaryAction={
              <Tooltip
                title={
                  checked
                    ? t('servers.libraries.refresh')
                    : t('servers.libraries.activateToRefresh')
                }
              >
                <span>
                  <IconButton
                    edge="end"
                    aria-label={t('servers.libraries.refreshAria', { name: row.libraryName })}
                    disabled={refreshDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshRow(row);
                    }}
                  >
                    {rowRefreshing ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <Refresh sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            }
          >
            <ListItemButton
              disabled={disabled}
              onClick={() => !disabled && toggleActiveLibrary(ref)}
              sx={{ alignItems: 'flex-start' }}
            >
              <ListItemIcon sx={{ minWidth: 42, mt: 0.5 }}>
                <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple disabled={disabled} />
              </ListItemIcon>
              <ListItemText
                sx={{ minWidth: 0 }}
                slotProps={{
                  primary: { sx: { wordBreak: 'break-word' } },
                  secondary: { sx: { minWidth: 0 } },
                }}
                primary={row.libraryName}
                secondary={
                  <>
                    <Box component="span" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                      {row.username} ·{' '}
                      <Box component="span" sx={{ wordBreak: 'break-all' }}>
                        {row.serverUrl}
                      </Box>
                    </Box>
                    {!disabled && (
                      <Box sx={{ mt: 0.5 }}>
                        <SettingsListItemCaption
                          component="span"
                          sx={{ mt: 0, lineHeight: 1.4 }}
                        >
                          {statsLines.counts}
                        </SettingsListItemCaption>
                        {statsLines.sync != null && (
                          <SettingsListItemCaption
                            component="span"
                            sx={{ mt: 0.25, lineHeight: 1.4 }}
                          >
                            {statsLines.sync}
                          </SettingsListItemCaption>
                        )}
                      </Box>
                    )}
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
