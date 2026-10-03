#!/usr/bin/env node
/**
 * Runs the component unit suite with Node's built-in test runner.
 *
 * The project does not ship jest, vitest or @testing-library, so the specs in
 * `tests/unit` are plain `node:test` files rendered with `react-dom/server`.
 * `tests/unit/loader-hooks.mjs` (backed by the existing `typescript`
 * devDependency) teaches Node how to load the app's TSX sources.
 *
 * Usage: `npm run test:unit`
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const UNIT_TESTS_DIR = path.join(REPO_ROOT, 'tests', 'unit');

function collectSpecFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const specFiles = collectSpecFiles(UNIT_TESTS_DIR).sort();

if (specFiles.length === 0) {
  console.error(`No component spec files found in ${path.relative(REPO_ROOT, UNIT_TESTS_DIR)}.`);
  process.exit(1);
}

const loaderUrl = pathToFileURL(path.join(UNIT_TESTS_DIR, 'register-loader.mjs')).href;

console.log(`Running ${specFiles.length} component spec file(s) with node:test...\n`);

const result = spawnSync(
  process.execPath,
  ['--import', loaderUrl, '--test', ...specFiles],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
