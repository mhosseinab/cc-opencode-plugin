import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');
test('marketplace, package and installed plugin versions agree', () => {
  const pkg = JSON.parse(read('package.json'));
  const manifest = JSON.parse(read('plugins/opencode/.claude-plugin/plugin.json'));
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(manifest.version, pkg.version);
  assert.equal(marketplace.plugins[0].version, pkg.version);
  assert.equal(marketplace.plugins[0].name, manifest.name);
  assert.equal(marketplace.plugins[0].source, './plugins/opencode');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

test('installed commands and delegation skill use the self-contained runtime contract', () => {
  for (const command of [
    'task',
    'rescue',
    'review',
    'adversarial-review',
    'transfer',
    'setup',
    'status',
    'result',
    'cancel',
    'agents',
    'models',
  ]) {
    const text = read(`plugins/opencode/commands/${command}.md`);
    assert.match(text, /disable-model-invocation: true/);
    assert.match(text, /CLAUDE_PLUGIN_ROOT.*RUNTIME.md/);
    assert.doesNotMatch(text, /companion\.mjs.*\$ARGUMENTS/);
  }
  assert.match(read('plugins/opencode/skills/delegation/SKILL.md'), /independently run/);
  assert.match(read('plugins/opencode/RUNTIME.md'), /workspace.lock/);
});
