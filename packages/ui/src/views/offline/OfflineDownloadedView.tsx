import { useCallback, useEffect, useState } from "react";
import { useT } from "@asmusic/i18n";
import { useNavigate } from "react-router-dom";
import Delete from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import {
  AppBar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { PageCloseButton } from "@ui/shared/PageCloseButton";
import { DownloadedSongListView } from "./DownloadedSongListView";
import { DownloadingSongListView } from "./DownloadingSongListView";
import { useHost } from "@ui/host/HostContext";
import { useActiveLibraryScopes, useLibraryBrowseCache } from "@ui/contexts";
import { useOfflineDownload } from "@ui/contexts/OfflineDownloadContext";
import { libraryFlexFillSx } from "@ui/shared/LibraryVirtuosoFill";
import { playerDockPaddingBottomSx } from "@ui/player/core/constants";
import { formatBytes } from "@ui/utils/formatBytes";

type ClearTarget = "active" | "all";

export function OfflineDownloadedView() {
  const t = useT();
  const navigate = useNavigate();
  const host = useHost();
  const activeScopes = useActiveLibraryScopes();
  const { clearAllArtworkCache } = useLibraryBrowseCache();
  const { cancelAllJobs } = useOfflineDownload();
  const [tab, setTab] = useState(0);
  const [activeBytes, setActiveBytes] = useState<number | null>(null);
  const [allBytes, setAllBytes] = useState<number | null>(null);
  const [listReloadNonce, setListReloadNonce] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null);
  const [clearArtworkOpen, setClearArtworkOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearArtworkBusy, setClearArtworkBusy] = useState(false);

  const refreshTotalBytes = useCallback(() => {
    void Promise.all([
      Promise.all(activeScopes.map((scope) => host.offlineMedia.totalReadyBytes(scope))).then(
        (parts) => parts.reduce((sum, n) => sum + n, 0)
      ),
      host.offlineMedia.totalReadyBytes(null),
    ]).then(([active, all]) => {
      setActiveBytes(active);
      setAllBytes(all);
    });
  }, [host, activeScopes]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      Promise.all(activeScopes.map((scope) => host.offlineMedia.totalReadyBytes(scope))).then(
        (parts) => parts.reduce((sum, n) => sum + n, 0)
      ),
      host.offlineMedia.totalReadyBytes(null),
    ]).then(([active, all]) => {
      if (!cancelled) {
        setActiveBytes(active);
        setAllBytes(all);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [host, activeScopes, tab, listReloadNonce]);

  const activeStorageLabel =
    activeBytes == null
      ? "…"
      : t("offline.storageUsed.activeLibraries", { size: formatBytes(activeBytes) });
  const allStorageLabel =
    allBytes == null
      ? "…"
      : t("offline.storageUsed.allLibraries", { size: formatBytes(allBytes) });

  const handleClearActive = useCallback(async () => {
    setClearBusy(true);
    try {
      await Promise.all(activeScopes.map((scope) => host.offlineMedia.deleteScope(scope)));
      setListReloadNonce((n) => n + 1);
      refreshTotalBytes();
      setClearTarget(null);
    } finally {
      setClearBusy(false);
    }
  }, [host, activeScopes, refreshTotalBytes]);

  const handleClearAll = useCallback(async () => {
    setClearBusy(true);
    try {
      cancelAllJobs();
      await host.offlineMedia.purgeAll();
      setListReloadNonce((n) => n + 1);
      refreshTotalBytes();
      setClearTarget(null);
    } finally {
      setClearBusy(false);
    }
  }, [cancelAllJobs, host, refreshTotalBytes]);

  const handleClearArtworkCache = useCallback(async () => {
    setClearArtworkBusy(true);
    try {
      await clearAllArtworkCache();
      setClearArtworkOpen(false);
    } finally {
      setClearArtworkBusy(false);
    }
  }, [clearAllArtworkCache]);

  const confirmOpen = clearTarget != null;
  const confirmTitle =
    clearTarget === "active"
      ? t("offline.clearActive.confirmTitle")
      : t("offline.clearAll.confirmTitle");
  const confirmBody =
    clearTarget === "active"
      ? t("offline.clearActive.confirmBody")
      : t("offline.clearAll.confirmBody");
  const confirmBusyLabel =
    clearTarget === "active" ? t("offline.clearActive.busy") : t("offline.clearAll.busy");

  return (
    <Box
      sx={{
        height: "calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom))",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
        ...playerDockPaddingBottomSx,
      }}
    >
      <AppBar position="sticky" sx={{ flexShrink: 0 }}>
        <Toolbar variant="dense" sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <PageCloseButton edge="start" onClick={() => navigate("/")} />
          <Typography
            variant="subtitle1"
            component="h1"
            sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}
          >
            {t("offline.title")}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {allStorageLabel}
          </Typography>
          <Tooltip title={t("offline.storageMenu")}>
            <span>
              <IconButton
                edge="end"
                size="small"
                aria-label={t("offline.storageMenu")}
                aria-haspopup="true"
                aria-expanded={Boolean(menuAnchor)}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { minWidth: 280 } } }}
          >
            <MenuItem
              disableGutters
              sx={{ py: 0.5, pl: 2, pr: 0.5, gap: 0.5 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ListItemText
                primary={activeStorageLabel}
                slotProps={{ primary: { variant: "body2", noWrap: true } }}
                sx={{ minWidth: 0, mr: 0.5 }}
              />
              <Tooltip title={t("offline.clearActive")}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t("offline.clearActive")}
                    disabled={clearBusy || activeBytes == null || activeBytes === 0}
                    onClick={() => {
                      setMenuAnchor(null);
                      setClearTarget("active");
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </MenuItem>
            <MenuItem
              disableGutters
              sx={{ py: 0.5, pl: 2, pr: 0.5, gap: 0.5 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ListItemText
                primary={allStorageLabel}
                slotProps={{ primary: { variant: "body2", noWrap: true } }}
                sx={{ minWidth: 0, mr: 0.5 }}
              />
              <Tooltip title={t("offline.clearAll")}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={t("offline.clearAll")}
                    disabled={clearBusy || allBytes == null || allBytes === 0}
                    onClick={() => {
                      setMenuAnchor(null);
                      setClearTarget("all");
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setClearArtworkOpen(true);
              }}
            >
              <ListItemText
                primary={t("offline.clearArtworkCache")}
                slotProps={{ primary: { variant: "body2" } }}
              />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container
        maxWidth="md"
        sx={{
          ...libraryFlexFillSx,
          display: "flex",
          flexDirection: "column",
          px: { xs: 2, sm: 3 },
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, flexShrink: 0 }}
        >
          <Tab
            label={t("offline.downloaded.tab")}
            id="dl-tab-0"
            aria-controls="dl-panel-0"
          />
          <Tab
            label={t("offline.downloading.tab")}
            id="dl-tab-1"
            aria-controls="dl-panel-1"
          />
        </Tabs>

        <Box
          role="tabpanel"
          hidden={tab !== 0}
          id="dl-panel-0"
          aria-labelledby="dl-tab-0"
          sx={{
            ...libraryFlexFillSx,
            display: tab === 0 ? "flex" : "none",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {tab === 0 && (
            <DownloadedSongListView reloadNonce={listReloadNonce} />
          )}
        </Box>
        <Box
          role="tabpanel"
          hidden={tab !== 1}
          id="dl-panel-1"
          aria-labelledby="dl-tab-1"
          sx={{
            ...libraryFlexFillSx,
            display: tab === 1 ? "flex" : "none",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          {tab === 1 && <DownloadingSongListView />}
        </Box>
      </Container>

      <Dialog
        open={confirmOpen}
        onClose={() => !clearBusy && setClearTarget(null)}
      >
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmBody}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearTarget(null)} disabled={clearBusy}>
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={clearBusy}
            onClick={() =>
              void (clearTarget === "active" ? handleClearActive() : handleClearAll())
            }
          >
            {clearBusy ? confirmBusyLabel : t("common.clear")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearArtworkOpen}
        onClose={() => !clearArtworkBusy && setClearArtworkOpen(false)}
      >
        <DialogTitle>{t("offline.clearArtworkCache.confirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t("offline.clearArtworkCache.confirmBody")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearArtworkOpen(false)} disabled={clearArtworkBusy}>
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={clearArtworkBusy}
            onClick={() => void handleClearArtworkCache()}
          >
            {clearArtworkBusy ? t("offline.clearArtworkCache.busy") : t("common.clear")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
