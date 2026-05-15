import versionFile from '../../../../version.json';

/** Version/build baked in at Vite build time from repo-root version.json. */
export function getEmbeddedAppBuildInfo(): { version: string; build: string } | null {
  const { version, build } = versionFile;
  if (typeof version === 'string' && version && typeof build === 'string' && build) {
    return { version, build };
  }
  return null;
}
