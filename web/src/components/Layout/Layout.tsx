import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { NowPlayingBar } from '@/components/NowPlayingBar';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <nav className="layout__nav" aria-label="Main">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/artist"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Artist
          </NavLink>
          <NavLink
            to="/album"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Album
          </NavLink>
          <NavLink
            to="/songs"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            All Songs
          </NavLink>
          <NavLink
            to="/playlists"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Playlists
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Search
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `layout__nav-link ${isActive ? 'layout__nav-link--active' : ''}`
            }
          >
            Settings
          </NavLink>
        </nav>
        <div className="layout__user">
          <span className="layout__username" title={user ?? undefined}>
            {user ?? '—'}
          </span>
          <button type="button" className="layout__logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="layout__main">
        <Outlet />
      </main>
      <footer className="layout__player">
        <NowPlayingBar />
      </footer>
    </div>
  );
}
