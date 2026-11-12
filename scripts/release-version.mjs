import fs from 'node:fs';
import path from 'node:path';

/** Update all install-facing versions before the release commit and tag are made. */
export function prepareRelease(root, version, repository) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Release version must be stable SemVer: MAJOR.MINOR.PATCH.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository ?? '')) {
    throw new Error('GITHUB_REPOSITORY must contain the actual GitHub owner/repository.');
  }
  const files = [
    'package.json',
    'package-lock.json',
    'plugins/opencode/.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
  ];
  const [pkg, lock, plugin, marketplace] = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')),
  );
  const entries = marketplace.plugins.filter((entry) => entry.name === plugin.name);
  if (entries.length !== 1 || plugin.name !== 'opencode' || !lock.packages?.['']) {
    throw new Error('Unexpected plugin marketplace or npm lockfile structure.');
  }
  pkg.version = version;
  lock.version = version;
  lock.packages[''].version = version;
  plugin.version = version;
  entries[0].version = version;
  entries[0].source = {
    source: 'git-subdir',
    url: `https://github.com/${repository}.git`,
    path: 'plugins/opencode',
    ref: `v${version}`,
  };
  for (const [index, value] of [pkg, lock, plugin, marketplace].entries()) {
    fs.writeFileSync(path.join(root, files[index]), `${JSON.stringify(value, null, 2)}\n`);
  }
}
