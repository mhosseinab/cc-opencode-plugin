import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'plugins/opencode/.claude-plugin/plugin.json'), 'utf8'),
);
if (manifest.version !== version) throw new Error('Plugin/package version mismatch.');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const output = path.join(root, 'dist', `cc-opencode-plugin-${version}.tar.gz`);
execFileSync('tar', [
  '--exclude=node_modules',
  '--exclude=.git',
  '--exclude=dist',
  '--exclude=coverage',
  '-czf',
  output,
  '-C',
  path.dirname(root),
  path.basename(root),
]);
console.log(output);
