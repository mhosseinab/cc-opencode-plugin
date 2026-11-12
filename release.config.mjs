export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    './scripts/semantic-release-plugin.mjs',
    [
      '@semantic-release/git',
      {
        assets: [
          'package.json',
          'package-lock.json',
          '.claude-plugin/marketplace.json',
          'plugins/opencode/.claude-plugin/plugin.json',
          'CHANGELOG.md',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [{ path: 'dist/cc-opencode-plugin-*.tar.gz', label: 'Complete plugin source' }],
        successComment: false,
        failComment: false,
        failTitle: false,
        releasedLabels: false,
      },
    ],
  ],
};
