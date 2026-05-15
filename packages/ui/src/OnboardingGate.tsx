import { type ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useServerAndLibrary } from './contexts';

export function isLibrarySetupComplete(
  servers: { length: number },
  activeLibraryRefs: { length: number }
): boolean {
  return servers.length > 0 && activeLibraryRefs.length > 0;
}

/** Sends users to `/onboarding` until at least one server and one active library are configured. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRestoring, servers, activeLibraryRefs } = useServerAndLibrary();

  useEffect(() => {
    if (isRestoring) return;
    if (location.pathname === '/onboarding') return;
    if (isLibrarySetupComplete(servers, activeLibraryRefs)) return;
    navigate('/onboarding', { replace: true });
  }, [location.pathname, isRestoring, servers.length, activeLibraryRefs.length, navigate]);

  return <>{children}</>;
}
