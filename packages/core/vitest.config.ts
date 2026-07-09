import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@asmusic/core',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
