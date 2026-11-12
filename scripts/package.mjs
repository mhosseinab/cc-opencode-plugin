import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Package tracked source using current file bytes, including prepared release versions. */
export function createSourceArchive(directory) {
  const root = fs.realpathSync(directory);
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  const required = [
    'package.json',
    'package-lock.json',
    '.claude-plugin/marketplace.json',
    'plugins/opencode/.claude-plugin/plugin.json',
  ];
  if (required.some((file) => !tracked.includes(file))) {
    throw new Error('Packaging requires a Git checkout with tracked package and plugin manifests.');
  }
  const sourceFile = (relative) => {
    const source = path.resolve(root, relative);
    const actual = fs.realpathSync(source);
    const inside = path.relative(root, actual);
    if (
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).includes('..') ||
      inside === '..' ||
      inside.startsWith(`..${path.sep}`) ||
      path.isAbsolute(inside) ||
      fs.lstatSync(source).isSymbolicLink() ||
      !fs.statSync(source).isFile()
    ) {
      throw new Error(`Refusing to package a nonregular or external source file: ${relative}`);
    }
    return source;
  };
  const readJSON = (file) => JSON.parse(fs.readFileSync(sourceFile(file), 'utf8'));
  const pkg = readJSON('package.json');
  const lock = readJSON('package-lock.json');
  const manifest = readJSON('plugins/opencode/.claude-plugin/plugin.json');
  const marketplace = readJSON('.claude-plugin/marketplace.json');
  const version = pkg.version;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Package version must be stable SemVer: MAJOR.MINOR.PATCH.');
  }
  const entry = marketplace.plugins.find((plugin) => plugin.name === manifest.name);
  if (
    manifest.version !== version ||
    lock.version !== version ||
    lock.packages?.['']?.version !== version ||
    entry?.version !== version
  ) {
    throw new Error('Package, lockfile, plugin, and marketplace versions must agree.');
  }
  const outputDirectory = path.join(root, 'dist');
  fs.mkdirSync(outputDirectory, { recursive: true });
  if (fs.lstatSync(outputDirectory).isSymbolicLink()) {
    throw new Error('Refusing to write an archive through a symlinked dist directory.');
  }
  const output = path.join(outputDirectory, `cc-opencode-plugin-${version}.tar.gz`);
  const temporaryOutput = path.join(
    outputDirectory,
    `.package-${randomBytes(16).toString('hex')}.tmp`,
  );
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-package-'));
  const archiveRoot = 'cc-opencode-plugin';
  try {
    for (const relative of new Set(tracked)) {
      // Generated directories never belong in a source distribution, even if staged by mistake.
      if (['.git', 'node_modules', 'dist', 'coverage'].includes(relative.split('/')[0])) continue;
      const source = sourceFile(relative);
      const destination = path.join(staging, archiveRoot, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      fs.chmodSync(destination, fs.statSync(source).mode & 0o777);
    }
    execFileSync('tar', ['-czf', temporaryOutput, '-C', staging, archiveRoot]);
    fs.renameSync(temporaryOutput, output);
    return output;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(temporaryOutput, { force: true });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(createSourceArchive(path.resolve(import.meta.dirname, '..')));
}
