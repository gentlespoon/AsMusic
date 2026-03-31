import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts';
import { getApiBase } from '@/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [serverUrl, setServerUrl] = useState(getApiBase());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(serverUrl, username, password);
    setLoading(false);
    if (result.ok) {
      navigate('/', { replace: true });
    } else {
      setError(result.error ?? 'Login failed');
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">AsMusic</h1>
        <p className="login__subtitle">Sign in to your Navidrome server</p>
        <form className="login__form" onSubmit={handleSubmit}>
          <label className="login__label">
            Server URL
            <input
              type="url"
              className="login__input"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://music.example.com"
              required
              autoComplete="url"
            />
          </label>
          <label className="login__label">
            Username
            <input
              type="text"
              className="login__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="login__label">
            Password
            <input
              type="password"
              className="login__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="login__error" role="alert">{error}</p>}
          <button type="submit" className="login__submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
