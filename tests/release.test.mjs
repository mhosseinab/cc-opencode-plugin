import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import config from '../release.config.mjs';
import { prepareRelease } from '../scripts/release-version.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-release-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'checkout');
  const source = path.resolve('.');
  fs.cpSync(source, root, {
    recursive: true,
    filter: (file) => {
      const relative = path.relative(source, file);
      return !['.git', 'node_modules', 'dist', 'coverage'].some(
        (dir) => relative === dir || relative.startsWith(`${dir}${path.sep}`),
      );
    },
  });
  return { root, base };
}
const json = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('release preparation synchronizes versions and pins the install source to its tag', (t) => {
  const { root } = fixture(t);
  prepareRelease(root, '1.2.3', 'example/cc-opencode-plugin');
  for (const file of [
    'package.json',
    'package-lock.json',
    'plugins/opencode/.claude-plugin/plugin.json',
  ]) {
    assert.equal(json(root, file).version, '1.2.3');
  }
  assert.equal(json(root, 'package-lock.json').packages[''].version, '1.2.3');
  const entry = json(root, '.claude-plugin/marketplace.json').plugins[0];
  assert.equal(entry.version, '1.2.3');
  assert.deepEqual(entry.source, {
    source: 'git-subdir',
    url: 'https://github.com/example/cc-opencode-plugin.git',
    path: 'plugins/opencode',
    ref: 'v1.2.3',
  });
  const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  assert.throws(() => prepareRelease(root, '1.2.3; touch bad', 'example/repo'), /SemVer/);
  assert.throws(() => prepareRelease(root, '1.2.3', 'not-a-repository'), /GITHUB_REPOSITORY/);
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before);
});

test('Conventional Commits produce patch, minor, major, or no release', async () => {
  for (const [message, expected] of [
    ['fix: correct cancellation', 'patch'],
    ['feat: select agents', 'minor'],
    ['feat: change API\n\nBREAKING CHANGE: remove old flags', 'major'],
    ['docs: clarify installation', null],
  ]) {
    assert.equal(
      await analyzeCommits(
        {},
        { cwd: process.cwd(), commits: [{ message }], logger: { log() {} } },
      ),
      expected,
    );
  }
  assert.ok(
    !config.plugins.some(
      (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === '@semantic-release/npm',
    ),
  );
});

test(
  'semantic-release prepares, commits, tags, and packages against a local bare Git remote',
  { timeout: 30000 },
  async (t) => {
    const { root, base } = fixture(t);
    const remote = path.join(base, 'remote.git');
    const git = (...args) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
    execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'pipe' });
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release@example.invalid');
    git('remote', 'add', 'origin', `file://${remote}`);
    git('add', '.');
    git('commit', '-m', 'feat: add OpenCode delegation');
    git('push', 'origin', 'main');
    const output = execFileSync(
      process.execPath,
      [path.resolve('tests/fixtures/release-harness.mjs'), root, remote],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 25000,
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_REF: 'refs/pull/999/merge',
          GITHUB_HEAD_REF: 'test-feature',
          GITHUB_BASE_REF: 'main',
        },
      },
    );
    const result = JSON.parse(
      output
        .split('\n')
        .find((line) => line.startsWith('CC_RELEASE_RESULT '))
        .slice('CC_RELEASE_RESULT '.length),
    );
    assert.equal(result.version, '1.0.0');
    assert.equal(result.repeatedRelease, false);
    assert.equal(
      git('show', 'v1.0.0:plugins/opencode/.claude-plugin/plugin.json').includes(
        '"version": "1.0.0"',
      ),
      true,
    );
    assert.equal(git('log', '-1', '--format=%s'), 'chore(release): 1.0.0 [skip ci]');
    const remoteHead = execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], {
      encoding: 'utf8',
    }).trim();
    assert.equal(remoteHead, git('rev-parse', 'HEAD'));
    const archive = path.join(root, 'dist/cc-opencode-plugin-1.0.0.tar.gz');
    assert.ok(fs.existsSync(archive));
  },
);
