import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import semanticRelease from 'semantic-release';
import config from '../../release.config.mjs';

const [root, remote] = process.argv.slice(2);
const sink = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
// The fixture must use its own Git branch, including when invoked by a PR workflow.
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith('GITHUB_') && !key.startsWith('RUNNER_'),
  ),
);
env.GITHUB_REPOSITORY = 'example/cc-opencode-plugin';
env.CI = 'false';
for (const key of ['GITHUB_TOKEN', 'GH_TOKEN', 'GIT_ASKPASS', 'GIT_CONFIG_COUNT']) delete env[key];
// No GitHub API or other external publish plugin is invoked by this local integration test.
const plugins = config.plugins.filter(
  (plugin) =>
    !['@semantic-release/github', '@semantic-release/release-notes-generator'].includes(
      Array.isArray(plugin) ? plugin[0] : plugin,
    ),
);
const options = { ...config, plugins, ci: false, repositoryUrl: `file://${remote}` };
const context = { cwd: root, env, stdout: sink, stderr: sink };
const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const preview = await semanticRelease({ ...options, dryRun: true }, context);
assert.equal(preview.nextRelease.version, '1.0.0');
assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before);
assert.equal(fs.existsSync(path.join(root, 'dist')), false);
const result = await semanticRelease(options, context);
const second = await semanticRelease(options, context);
assert.equal(second, false);
console.log(
  `CC_RELEASE_RESULT ${JSON.stringify({ version: result.nextRelease.version, repeatedRelease: second })}`,
);
