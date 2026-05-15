import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createPlatformHost } from '@asmusic/shell';
import type { PlatformHost } from '@asmusic/core';

const HostContext = createContext<PlatformHost | null>(null);

export function HostProvider({ children }: { children: ReactNode }) {
  const host = useMemo(() => createPlatformHost(), []);
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): PlatformHost {
  const ctx = useContext(HostContext);
  if (!ctx) {
    throw new Error('useHost must be used within HostProvider');
  }
  return ctx;
}
