import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [join(directory, entry.name)] : []);
}

test('presentational components and pages do not access HTTP services directly', () => {
  for (const file of files(join(root, 'features'))) {
    const path = relative(root, file);
    if (!/\/(components|pages)\//.test(path)) continue;
    const content = readFileSync(file, 'utf8');
    assert.ok(!/from ['"][^'"]*\/api\//.test(content), `${path} must use a hook, not an API module`);
    assert.ok(!/\bfetch\(/.test(content), `${path} must not own HTTP transport`);
  }
});

test('shared utilities and domain models are independent of feature UI', () => {
  for (const file of files(root)) {
    const path = relative(root, file);
    const content = readFileSync(file, 'utf8');
    if (path.startsWith('shared/')) assert.ok(!/from ['"][^'"]*features\//.test(content), `${path} must remain feature-independent`);
    if (path.includes('/model/')) assert.ok(!/from ['"]react|\bfetch\(/.test(content), `${path} must be a pure model`);
  }
});
