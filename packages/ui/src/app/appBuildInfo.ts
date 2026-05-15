import { getEmbeddedAppBuildInfo } from '@asmusic/core';
import { Capacitor } from '@capacitor/core';

export type AppBuildInfo = {
  version: string;
  build: string;
};

function formatBuildLabel(version: string, build: string): string {
  return `${version} (${build})`;
}

function readWebBuildInfoFromEnv(): AppBuildInfo | null {
  const version = import.meta.env.VITE_APP_VERSION;
  const build = import.meta.env.VITE_APP_BUILD;
  if (typeof version === 'string' && version && typeof build === 'string' && build) {
    return { version, build };
  }
  return null;
}

async function readWebBuildInfoFromManifest(): Promise<AppBuildInfo | null> {
  try {
    const response = await fetch('/app-info.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (
      data &&
      typeof data === 'object' &&
      'version' in data &&
      'build' in data &&
      typeof (data as AppBuildInfo).version === 'string' &&
      typeof (data as AppBuildInfo).build === 'string'
    ) {
      const { version, build } = data as AppBuildInfo;
      if (version && build) return { version, build };
    }
  } catch {
    // ignore
  }
  return null;
}

async function readNativeBuildInfo(): Promise<AppBuildInfo | null> {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    if (info.version && info.build) {
      return { version: info.version, build: info.build };
    }
  } catch {
    // @capacitor/app may be unavailable until cap sync registers the plugin
  }
  return null;
}

/** Resolved app version + build for About and diagnostics. */
export async function getAppBuildInfo(): Promise<AppBuildInfo | null> {
  if (Capacitor.isNativePlatform()) {
    const native = await readNativeBuildInfo();
    if (native) return native;
  }

  const embedded = getEmbeddedAppBuildInfo();
  if (embedded) return embedded;

  const fromEnv = readWebBuildInfoFromEnv();
  if (fromEnv) return fromEnv;

  return readWebBuildInfoFromManifest();
}

/** Display label matching legacy About: `2.0.0 (42)`. */
export async function getAppBuildLabel(): Promise<string> {
  const info = await getAppBuildInfo();
  if (info) return formatBuildLabel(info.version, info.build);
  if (import.meta.env.DEV) return 'dev (web)';
  return '—';
}
