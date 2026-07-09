import { AppI18nProvider } from "./AppI18nProvider";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  LibraryBrowseCacheProvider,
  OfflineDownloadProvider,
  PlayerProvider,
  PlayerTransportRoot,
  ServerAndLibraryProvider,
} from "./contexts";
import { OnboardingGate } from "./OnboardingGate";
import { PlayerChrome } from "./player/PlayerChrome";
import { PlayingQueueView } from "./views/queue/PlayingQueueView";
import { AboutView } from "./views/about/AboutView";
import { HomePage } from "./views/home/HomePage";
import { OfflineDownloadedView } from "./views/offline/OfflineDownloadedView";
import { OnboardingPage } from "./views/onboarding/OnboardingPage";
import { ServersAndLibrariesView } from "./views/servers/ServersAndLibrariesView";
import { SettingsView } from "./views/settings/SettingsView";
import { AppearanceView } from "./views/settings/AppearanceView";
import { DeveloperView } from "./views/settings/DeveloperView";
import { PlaybackView } from "./views/settings/PlaybackView";
import { useEffect } from "react";

export function App() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <AppI18nProvider>
      <ServerAndLibraryProvider>
        <OnboardingGate>
          <LibraryBrowseCacheProvider>
            <OfflineDownloadProvider>
              <PlayerProvider>
                <PlayerTransportRoot>
                  <Routes>
                    <Route path="/about" element={<AboutView />} />
                    <Route path="/settings" element={<SettingsView />} />
                    <Route
                      path="/settings/appearance"
                      element={<AppearanceView />}
                    />
                    <Route
                      path="/settings/playback"
                      element={<PlaybackView />}
                    />
                    <Route
                      path="/settings/user-experience"
                      element={<Navigate to="/settings/appearance" replace />}
                    />
                    <Route
                      path="/settings/developer"
                      element={<DeveloperView />}
                    />
                    <Route
                      path="/settings/downloads"
                      element={<Navigate to="/offline" replace />}
                    />
                    <Route
                      path="/settings/servers-libraries"
                      element={<ServersAndLibrariesView />}
                    />
                    <Route
                      path="/servers"
                      element={
                        <Navigate
                          to="/settings/servers-libraries?tab=servers"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/libraries"
                      element={
                        <Navigate
                          to="/settings/servers-libraries?tab=libraries"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        <Navigate
                          to="/settings/servers-libraries?tab=servers"
                          replace
                        />
                      }
                    />
                    <Route
                      path="/offline"
                      element={<OfflineDownloadedView />}
                    />
                    <Route path="/queue" element={<PlayingQueueView />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/" element={<HomePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  <PlayerChrome />
                </PlayerTransportRoot>
              </PlayerProvider>
            </OfflineDownloadProvider>
          </LibraryBrowseCacheProvider>
        </OnboardingGate>
      </ServerAndLibraryProvider>
    </AppI18nProvider>
  );
}
