import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type AppVersionFile = {
  version: string;
  build: string;
};

function loadAppVersion(repoRoot: string): AppVersionFile {
  const fromEnv = {
    version: process.env.VITE_APP_VERSION,
    build: process.env.VITE_APP_BUILD,
  };
  if (fromEnv.version && fromEnv.build) {
    return { version: fromEnv.version, build: fromEnv.build };
  }

  const versionPath = path.join(repoRoot, 'version.json');
  const parsed = JSON.parse(readFileSync(versionPath, 'utf8')) as Partial<AppVersionFile>;
  if (!parsed.version || !parsed.build) {
    throw new Error(`Invalid ${versionPath}: expected "version" and "build" strings`);
  }
  return { version: parsed.version, build: parsed.build };
}

function appInfoAssetPlugin(info: AppVersionFile): Plugin {
  const source = JSON.stringify(info);
  return {
    name: 'asmusic-app-info',
    configureServer(server) {
      server.middlewares.use('/app-info.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'app-info.json',
        source,
      });
    },
  };
}

export default defineConfig(() => {
  const repoRoot = path.resolve(__dirname, '../..');
  const appVersion = loadAppVersion(repoRoot);

  return {
    plugins: [react(), appInfoAssetPlugin(appVersion)],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion.version),
      'import.meta.env.VITE_APP_BUILD': JSON.stringify(appVersion.build),
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 3000,
      proxy: {},
    },
  };
});
