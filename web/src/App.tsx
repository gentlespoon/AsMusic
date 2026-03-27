import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, PlayerProvider, SettingsProvider } from '@/contexts';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { LibraryPage } from '@/features/library/LibraryPage';
import { AlbumListPage } from '@/features/album/AlbumListPage';
import { AllSongsPage } from '@/features/songs/AllSongsPage';
import { PlaylistsPage } from '@/features/playlists/PlaylistsPage';
import { SearchPage } from '@/features/search/SearchPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SettingsProvider>
                <PlayerProvider>
                  <Layout />
                </PlayerProvider>
              </SettingsProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="artist" element={<LibraryPage />} />
          <Route path="library" element={<Navigate to="/artist" replace />} />
          <Route path="album" element={<AlbumListPage />} />
          <Route path="songs" element={<AllSongsPage />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
