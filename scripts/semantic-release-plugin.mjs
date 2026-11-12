import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { prepareRelease } from './release-version.mjs';

export function verifyConditions(_config, context) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(
      context.env.GITHUB_REPOSITORY ?? '',
    )
  ) {
    throw new Error('Set GITHUB_REPOSITORY to the actual owner/repository before releasing.');
  }
  context.logger.log('Release target: %s', context.env.GITHUB_REPOSITORY);
}

export function prepare(_config, context) {
  prepareRelease(context.cwd, context.nextRelease.version, context.env.GITHUB_REPOSITORY);
  // Format using the pinned local binary; no shell commands or npx downloads.
  execFileSync(
    process.execPath,
    [
      path.join(context.cwd, 'node_modules/prettier/bin/prettier.cjs'),
      '--write',
      'package.json',
      '.claude-plugin/marketplace.json',
      'plugins/opencode/.claude-plugin/plugin.json',
      'CHANGELOG.md',
    ],
    { cwd: context.cwd, stdio: 'inherit' },
  );
  execFileSync(process.execPath, [path.join(context.cwd, 'scripts/package.mjs')], {
    cwd: context.cwd,
    stdio: 'inherit',
  });
}
