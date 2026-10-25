import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { validate } from '../plugins/opencode/scripts/lib/input.mjs';
import { EventDecoder } from '../plugins/opencode/scripts/lib/events.mjs';
import { reviewEnvironment, parseAgents } from '../plugins/opencode/scripts/lib/opencode.mjs';
import { workspace } from '../plugins/opencode/scripts/lib/state.mjs';

const cli = path.resolve('plugins/opencode/scripts/companion.mjs');
const fake = path.resolve('tests/fixtures/opencode.mjs');
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'checkout with spaces');
  fs.mkdirSync(root);
  return {
    base,
    root,
    env: { ...process.env, CC_OPENCODE_BIN: fake, CC_OPENCODE_STATE_DIR: path.join(base, 'state') },
  };
}
function invoke(f, command, input = {}) {
  const child = spawn(process.execPath, [cli, command], {
    cwd: f.root,
    env: f.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.stdin.end(JSON.stringify(input));
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({ code, stdout, stderr, data: stdout.trim() ? JSON.parse(stdout) : null }),
    );
  });
  return { child, done };
}
async function call(f, command, input = {}) {
  return invoke(f, command, input).done;
}
async function runningJob(f) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const { data } = await call(f, 'status');
    const job = data.jobs.find((j) => j.status === 'running');
    if (job) return job;
    await delay(50);
  }
  throw new Error('Job did not start.');
}

test('validation rejects unsafe and ambiguous requests', () => {
  assert.equal(validate('task', { prompt: 'fix it' }).timeoutSeconds, 1800);
  for (const [command, input] of [
    ['task', {}],
    ['task', { prompt: 'x', unknown: true }],
    ['review', { agent: 'build' }],
    ['review', { resume: 'a'.repeat(32) }],
    ['task', { prompt: 'x', timeoutSeconds: 0 }],
    ['task', { prompt: 'x', model: 'guess' }],
    ['cancel', {}],
    ['result', { job: '../secret' }],
    ['review', { base: '--output=bad' }],
    ['task', []],
    ['task', { prompt: 'a\0b' }],
    ['setup', { job: 'a'.repeat(32) }],
  ])
    assert.throws(() => validate(command, input));
});

test('JSONL handles split UTF-8, notices, and unterminated final records', () => {
  const events = [];
  const notices = [];
  const decoder = new EventDecoder(
    (e) => events.push(e),
    (n) => notices.push(n),
  );
  for (const byte of Buffer.from('notice\n{"type":"text","part":{"text":"سلام ✓"}}'))
    decoder.push(Buffer.from([byte]));
  decoder.end();
  assert.equal(events[0].part.text, 'سلام ✓');
  assert.deepEqual(notices, ['notice']);
  assert.throws(
    () =>
      new EventDecoder(
        () => {},
        () => {},
      ).push(Buffer.from('{broken}\n')),
    /Malformed/,
  );
  assert.throws(
    () =>
      new EventDecoder(
        () => {},
        () => {},
      ).push(Buffer.alloc(1024 * 1024 + 1, 120)),
    /exceeds/,
  );
});

test('review policy overrides permissive inline config and preserves other settings', () => {
  const env = reviewEnvironment({
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      model: 'local/model',
      permission: 'allow',
      agent: { custom: { mode: 'all' } },
    }),
  });
  const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(config.model, 'local/model');
  assert.equal(config.permission['*'], 'deny');
  assert.equal(config.agent['cc-opencode-review'].permission['*'], 'deny');
  assert.equal(config.agent.custom.mode, 'all');
  assert.equal(config.permission.read['*.env'], 'deny');
  assert.deepEqual(parseAgents('build (primary)\n  []\nexplore (subagent)\n'), [
    { name: 'build', mode: 'primary' },
    { name: 'explore', mode: 'subagent' },
  ]);
});

test('task preserves literal hostile input, records private state, and returns its result', async (t) => {
  const f = fixture(t);
  f.env.FAKE_RECORD = path.join(f.base, 'record.json');
  const prompt = 'Fix "quotes"; $(touch injected) `touch bad`\n--model fake\nسلام';
  const out = await call(f, 'task', {
    prompt,
    agent: 'build',
    model: 'test/model',
    variant: 'high',
  });
  assert.equal(out.code, 0, out.stderr);
  assert.equal(out.data.status, 'completed');
  const record = JSON.parse(fs.readFileSync(f.env.FAKE_RECORD, 'utf8'));
  assert.equal(record.prompt, prompt);
  assert.equal(record.pwd, fs.realpathSync(f.root));
  assert.equal(record.cwd, fs.realpathSync(f.root));
  assert.deepEqual(record.args, [
    'run',
    '--format',
    'json',
    '--agent',
    'build',
    '--model',
    'test/model',
    '--variant',
    'high',
  ]);
  assert.equal(fs.existsSync(path.join(f.root, 'injected')), false);
  assert.equal(fs.statSync(out.data.logDirectory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(out.data.logDirectory, 'job.json')).mode & 0o777, 0o600);
  assert.equal((await call(f, 'result', { job: out.data.id })).data.text, 'Fixture response ✓');
  assert.equal(
    (await call(f, 'status')).data.jobs[0].outputCharacters,
    'Fixture response ✓'.length,
  );
});

test('resume uses an explicit recorded session and inherits selection', async (t) => {
  const f = fixture(t);
  const first = await call(f, 'task', { prompt: 'first', agent: 'build', model: 'test/model' });
  f.env.FAKE_RECORD = path.join(f.base, 'resume.json');
  const next = await call(f, 'task', { prompt: 'continue', resume: first.data.id });
  assert.equal(next.code, 0, next.stderr);
  const record = JSON.parse(fs.readFileSync(f.env.FAKE_RECORD, 'utf8'));
  assert.equal(record.args.at(-1), 'ses_fixture');
  assert.ok(record.args.includes('--session'));
  assert.equal(next.data.model, 'test/model');
  const elsewhere = path.join(f.base, 'elsewhere');
  fs.mkdirSync(elsewhere);
  assert.equal((await call(f, 'result', { cwd: elsewhere, job: first.data.id })).code, 1);
});

test('subagents are promoted ephemerally and unknown agents fail closed', async (t) => {
  const f = fixture(t);
  f.env.FAKE_RECORD = path.join(f.base, 'subagent.json');
  const out = await call(f, 'task', { prompt: 'inspect', agent: 'explore' });
  assert.equal(out.code, 0, out.stderr);
  assert.equal(
    JSON.parse(fs.readFileSync(f.env.FAKE_RECORD, 'utf8')).config.agent.explore.mode,
    'all',
  );
  const bad = await call(f, 'task', { prompt: 'x', agent: 'nonexistent' });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /Unknown agent/);
  assert.equal((await call(f, 'task', { prompt: 'after failure' })).code, 0);
});

for (const [prompt, status] of [
  ['MALFORMED', 'failed'],
  ['EXIT_FAIL', 'failed'],
  ['ERROR_ZERO', 'failed'],
  ['INCOMPLETE', 'failed'],
  ['DENIED', 'blocked'],
])
  test(`${prompt} does not become a successful job`, async (t) => {
    const f = fixture(t);
    const out = await call(f, 'task', { prompt });
    assert.equal(out.code, 1, out.stderr);
    assert.equal(out.data.status, status);
  });

test('deadline terminates a hung run and releases its lock', async (t) => {
  const f = fixture(t);
  assert.equal(
    (await call(f, 'task', { prompt: 'HANG', timeoutSeconds: 1 })).data.status,
    'timed_out',
  );
  assert.equal((await call(f, 'task', { prompt: 'next' })).code, 0);
});

test('concurrent runs are refused; cancellation is scoped and idempotent', async (t) => {
  const f = fixture(t);
  const run = invoke(f, 'task', { prompt: 'HANG', timeoutSeconds: 10 });
  t.after(() => run.child.kill('SIGTERM'));
  const active = await runningJob(f);
  const busy = await call(f, 'task', { prompt: 'conflict' });
  assert.equal(busy.code, 1);
  assert.match(busy.stderr, /Workspace busy/);
  assert.equal((await call(f, 'cancel', { job: active.id })).data.cancellationRequested, true);
  assert.equal((await run.done).data.status, 'cancelled');
  assert.equal((await call(f, 'cancel', { job: active.id })).data.cancellationRequested, false);
});

test('SIGTERM records cancellation and cleans up the live child', async (t) => {
  const f = fixture(t);
  const run = invoke(f, 'task', { prompt: 'HANG', timeoutSeconds: 10 });
  await runningJob(f);
  run.child.kill('SIGTERM');
  assert.equal((await run.done).data.status, 'cancelled');
});

test('unsupported OpenCode versions are refused before running a model', async (t) => {
  const f = fixture(t);
  f.env.FAKE_VERSION = '2.0.0';
  const out = await call(f, 'task', { prompt: 'x' });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /Supported OpenCode version/);
});

test('review captures staged, unstaged, and untracked evidence with restrictive config', async (t) => {
  const f = fixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: f.root, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  fs.writeFileSync(path.join(f.root, 'a.txt'), 'base\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  fs.writeFileSync(path.join(f.root, 'a.txt'), 'staged\n');
  git('add', '.');
  fs.writeFileSync(path.join(f.root, 'a.txt'), 'unstaged\n');
  fs.writeFileSync(path.join(f.root, 'untracked.txt'), 'new\n');
  f.env.FAKE_RECORD = path.join(f.base, 'review.json');
  const out = await call(f, 'review', { prompt: 'focus on regression' });
  assert.equal(out.code, 0, out.stderr);
  const record = JSON.parse(fs.readFileSync(f.env.FAKE_RECORD, 'utf8'));
  for (const text of ['untracked.txt', 'staged', 'unstaged', 'focus on regression'])
    assert.ok(record.prompt.includes(text));
  assert.equal(record.config.agent['cc-opencode-review'].permission['*'], 'deny');
  assert.equal((await call(f, 'task', { prompt: 'resume', resume: out.data.id })).code, 1);
  assert.equal((await call(f, 'review', { base: 'HEAD' })).code, 0);
  assert.doesNotMatch(
    JSON.parse(fs.readFileSync(f.env.FAKE_RECORD, 'utf8')).prompt,
    /untracked.txt/,
  );
  const subdir = path.join(f.root, 'subdir');
  fs.mkdirSync(subdir);
  assert.equal(workspace(subdir), fs.realpathSync(f.root));
});

test(
  'deadline escalates for a descendant that outlives its process-group leader',
  { timeout: 10000 },
  async (t) => {
    const f = fixture(t);
    const out = await call(f, 'task', { prompt: 'DESCENDANT', timeoutSeconds: 1 });
    assert.equal(out.data.status, 'timed_out');
    assert.equal((await call(f, 'task', { prompt: 'next' })).code, 0);
  },
);

test('stale locks are reported rather than silently removed', async (t) => {
  const f = fixture(t);
  const status = await call(f, 'status');
  const lock = path.join(status.data.stateDirectory, 'workspace.lock');
  fs.writeFileSync(lock, JSON.stringify({ id: 'a'.repeat(32), pid: 2147483647 }));
  const out = await call(f, 'task', { prompt: 'blocked by stale lock' });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /Stale workspace lock/);
  assert.ok(fs.existsSync(lock));
});
