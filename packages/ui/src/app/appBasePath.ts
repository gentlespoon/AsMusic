/** Vite emits entry chunks under `/assets/`; dirname is the deploy directory. */
const ASSETS_PATH_SEGMENT = '/assets/';

let cachedDeployBasename: string | undefined;

function detectDeployBasename(): string {
  if (cachedDeployBasename !== undefined) return cachedDeployBasename;

  try {
    const pathname = new URL(import.meta.url).pathname;
    const assetsIndex = pathname.indexOf(ASSETS_PATH_SEGMENT);
    if (assetsIndex > 0) {
      cachedDeployBasename = pathname.slice(0, assetsIndex);
      return cachedDeployBasename;
    }
  } catch {
    // ignore
  }

  cachedDeployBasename = '/';
  return cachedDeployBasename;
}

/** React Router `basename` (no trailing slash). */
export function getAppRouterBasename(): string {
  const viteBase = import.meta.env.BASE_URL;
  if (viteBase && viteBase !== '/' && viteBase !== './') {
    return viteBase.replace(/\/$/, '');
  }
  return detectDeployBasename();
}

/** Resolve a `public/` asset under the deploy directory (e.g. `icon/icon.png`). */
export function appAssetUrl(path: string): string {
  const suffix = path.startsWith('/') ? path.slice(1) : path;
  const basename = getAppRouterBasename();
  if (basename === '/') return `/${suffix}`;
  return `${basename}/${suffix}`;
}
