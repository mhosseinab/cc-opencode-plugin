import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { createSourceArchive } from '../scripts/package.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-package-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'checkout');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  const write = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('package.json', { name: 'cc-opencode-plugin', version: '1.0.0' });
  write('package-lock.json', { version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  write('plugins/opencode/.claude-plugin/plugin.json', { name: 'opencode', version: '1.0.0' });
  write('.claude-plugin/marketplace.json', { plugins: [{ name: 'opencode', version: '1.0.0' }] });
  write('.gitignore', '.env\n.npmrc\ndist/\n');
  write('README.md', 'Tracked source.\n');
  git('init', '--initial-branch=main');
  git('add', '.');
  return { root, base, git, write };
}

test('source archives exclude ignored and untracked local files', (t) => {
  const { root, write } = fixture(t);
  write('.env', 'SYNTHETIC_SECRET=not-a-real-secret\n');
  write('.npmrc', '//example.invalid/:_authToken=synthetic\n');
  write('local-notes.txt', 'Untracked private notes.\n');
  const archive = createSourceArchive(root);
  const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
  assert.ok(names.includes('cc-opencode-plugin/README.md'));
  for (const local of ['.env', '.npmrc', 'local-notes.txt']) {
    assert.equal(names.includes(`cc-opencode-plugin/${local}`), false, local);
  }
});

test('archives contain prepared release metadata from the working tree', (t) => {
  const { root, write } = fixture(t);
  write('package.json', { name: 'cc-opencode-plugin', version: '1.2.3' });
  write('package-lock.json', { version: '1.2.3', packages: { '': { version: '1.2.3' } } });
  write('plugins/opencode/.claude-plugin/plugin.json', { name: 'opencode', version: '1.2.3' });
  write('.claude-plugin/marketplace.json', { plugins: [{ name: 'opencode', version: '1.2.3' }] });
  const archive = createSourceArchive(root);
  for (const relative of [
    'package.json',
    'package-lock.json',
    'plugins/opencode/.claude-plugin/plugin.json',
  ]) {
    const content = execFileSync('tar', ['-xOzf', archive, `cc-opencode-plugin/${relative}`], {
      encoding: 'utf8',
    });
    assert.equal(JSON.parse(content).version, '1.2.3');
  }
  const catalog = JSON.parse(
    execFileSync('tar', ['-xOzf', archive, 'cc-opencode-plugin/.claude-plugin/marketplace.json'], {
      encoding: 'utf8',
    }),
  );
  assert.equal(catalog.plugins[0].version, '1.2.3');
});

test('packaging rejects tracked links to files outside the source checkout', (t) => {
  const { root, base, git } = fixture(t);
  const secret = path.join(base, 'synthetic-secret.txt');
  fs.writeFileSync(secret, 'Synthetic external data.\n');
  fs.symlinkSync(secret, path.join(root, 'linked-source.txt'));
  git('add', 'linked-source.txt');
  assert.throws(() => createSourceArchive(root), /nonregular or external source file/);
  assert.equal(fs.existsSync(path.join(root, 'dist/cc-opencode-plugin-1.0.0.tar.gz')), false);
});

test('archive CLI runs through a symlinked checkout path', (t) => {
  const { root, base, git } = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.resolve('scripts/package.mjs'), path.join(root, 'scripts/package.mjs'));
  git('add', 'scripts/package.mjs');
  const alias = path.join(base, 'checkout-alias');
  fs.symlinkSync(root, alias, 'dir');
  const output = execFileSync(process.execPath, [path.join(alias, 'scripts/package.mjs')], {
    cwd: alias,
    encoding: 'utf8',
  }).trim();
  assert.equal(output, path.join(fs.realpathSync(root), 'dist/cc-opencode-plugin-1.0.0.tar.gz'));
  assert.ok(fs.existsSync(output));
});
