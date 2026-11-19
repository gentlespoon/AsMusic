import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createPlatformHost } from '@asmusic/shell';
import type { PlatformHost } from '@asmusic/core';
import { notePlayerDebugSessionStart } from '@ui/player/core/playerDebugLog';

const HostContext = createContext<PlatformHost | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
  const host = useMemo(() => createPlatformHost(), []);
  useEffect(() => {
    void notePlayerDebugSessionStart(host);
  }, [host]);
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): PlatformHost {
  const ctx = useContext(HostContext);
  if (!ctx) {
    throw new Error('useHost must be used within HostProvider');
  }
  return ctx;
}
