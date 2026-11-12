import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertReviewPolicy,
  reviewEnvironment,
  runArgs,
} from '../plugins/opencode/scripts/lib/opencode.mjs';

const name = 'cc-opencode-review-0123456789abcdef0123456789abcdef';
const config = JSON.parse(reviewEnvironment({}, name).OPENCODE_CONFIG_CONTENT);
const rules = Object.entries(config.agent[name].permission).flatMap(([permission, value]) =>
  typeof value === 'string'
    ? [{ permission, pattern: '*', action: value }]
    : Object.entries(value).map(([pattern, action]) => ({ permission, pattern, action })),
);
const output = (policy) => `${name} (primary)\n${JSON.stringify(policy)}\nother (subagent)\n[]`;

test('generated reviewers use pure mode and their own restrictive policy', () => {
  assert.equal(runArgs({}, name)[0], '--pure');
  assert.doesNotThrow(() => assertReviewPolicy(output(rules), name));
  assert.doesNotThrow(() =>
    assertReviewPolicy(
      output([{ permission: 'bash', pattern: '*', action: 'allow' }, ...rules]),
      name,
    ),
  );
});

test('effective reviewer policy rejects merged tool grants and malformed CLI output', () => {
  for (const permission of ['bash', 'edit', 'task', 'webfetch', 'read', 'external_directory']) {
    assert.throws(
      () =>
        assertReviewPolicy(output([...rules, { permission, pattern: '*', action: 'allow' }]), name),
      /Review aborted/,
    );
  }
  for (const text of ['', `${name} (primary)`, output({}), output(rules.slice(1))]) {
    assert.throws(() => assertReviewPolicy(text, name), /Review aborted/);
  }
});

test('only OpenCode own tool-output directory exception is accepted', () => {
  const env = { XDG_DATA_HOME: '/test/data' };
  assert.doesNotThrow(() =>
    assertReviewPolicy(
      output([
        ...rules,
        {
          permission: 'external_directory',
          pattern: '/test/data/opencode/tool-output/*',
          action: 'allow',
        },
      ]),
      name,
      env,
    ),
  );
  assert.throws(
    () =>
      assertReviewPolicy(
        output([
          ...rules,
          { permission: 'external_directory', pattern: '/arbitrary/*', action: 'allow' },
        ]),
        name,
        env,
      ),
    /Review aborted/,
  );
});
