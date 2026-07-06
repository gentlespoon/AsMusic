import { useEffect, useState } from 'react';

function readOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/** Browser online/offline status for gating network-only actions. */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(readOnline);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { isOnline };
}
