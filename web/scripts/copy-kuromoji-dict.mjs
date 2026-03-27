#!/usr/bin/env node
/**
 * Copy kuromoji dictionary files to public/kuromoji-dict so the browser can load them.
 * Run after: pnpm install (e.g. via postinstall).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function copyDict(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const f of readdirSync(srcDir)) {
    copyFileSync(join(srcDir, f), join(destDir, f));
  }
  console.log('Copied kuromoji dict to public/kuromoji-dict');
}

// 1) node_modules/kuromoji/dict (npm or pnpm hoisted)
const direct = join(root, 'node_modules', 'kuromoji', 'dict');
if (existsSync(direct)) {
  copyDict(direct, join(root, 'public', 'kuromoji-dict'));
  process.exit(0);
}

// 2) pnpm: .pnpm/kuromoji@x.y.z/node_modules/kuromoji/dict
const pnpmDir = join(root, 'node_modules', '.pnpm');
if (existsSync(pnpmDir)) {
  for (const name of readdirSync(pnpmDir)) {
    if (name.startsWith('kuromoji@')) {
      const dictPath = join(pnpmDir, name, 'node_modules', 'kuromoji', 'dict');
      if (existsSync(dictPath)) {
        copyDict(dictPath, join(root, 'public', 'kuromoji-dict'));
        process.exit(0);
      }
    }
  }
}

// 3) require.resolve from project context
try {
  const { createRequire } = await import('module');
  const require = createRequire(join(root, 'package.json'));
  const kuromojiMain = require.resolve('kuromoji');
  const dictPath = join(dirname(kuromojiMain), 'dict');
  if (existsSync(dictPath)) {
    copyDict(dictPath, join(root, 'public', 'kuromoji-dict'));
    process.exit(0);
  }
} catch {
  // ignore
}

console.warn('kuromoji dict not found; Japanese kanji romanization may not work. Run: pnpm install && pnpm run copy:dict');
process.exit(0);
