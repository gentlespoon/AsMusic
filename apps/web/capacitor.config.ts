import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.angdasoft.AsMusic',
  appName: 'AsMusic',
  webDir: 'dist',
  ios: {
    path: '../../ios',
    // Capacitor defaults to scheme "App"; must match xcshareddata/xcschemes/AsMusic.xcscheme.
    scheme: 'AsMusic',
  },
};

export default config;
