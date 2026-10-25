import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';

const cli = path.resolve('plugins/opencode/scripts/companion.mjs');
test(
  'real OpenCode: local provider, continuation, and restricted review',
  {
    skip: !process.env.OPENCODE_LIVE_BIN,
    timeout: 120000,
  },
  async (t) => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-live-'));
    t.after(() => fs.rmSync(base, { recursive: true, force: true }));
    const root = path.join(base, 'repo');
    fs.mkdirSync(root);
    const requests = [];
    let issuedWrite = false;
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const request = JSON.parse(body);
      requests.push({ path: req.url, ...request });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta, finish_reason = null) =>
        res.write(
          `data: ${JSON.stringify({ id: 'chatcmpl-local', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
        );
      chunk({ role: 'assistant', content: '' });
      if (!issuedWrite && request.tools?.some((tool) => tool.function.name === 'write')) {
        issuedWrite = true;
        chunk({
          tool_calls: [
            {
              index: 0,
              id: 'call_fixture_write',
              type: 'function',
              function: {
                name: 'write',
                arguments: JSON.stringify({
                  filePath: path.join(root, 'implemented.txt'),
                  content: 'implemented by real OpenCode tool\n',
                }),
              },
            },
          ],
        });
        chunk({}, 'tool_calls');
      } else {
        chunk({ content: 'Local provider integration passed.' });
        chunk({}, 'stop');
      }
      res.end('data: [DONE]\n\n');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const env = {
      ...process.env,
      CC_OPENCODE_BIN: path.resolve(process.env.OPENCODE_LIVE_BIN),
      CC_OPENCODE_STATE_DIR: path.join(base, 'state'),
      XDG_CONFIG_HOME: path.join(base, 'config'),
      XDG_DATA_HOME: path.join(base, 'data'),
      XDG_CACHE_HOME: path.join(base, 'cache'),
      XDG_STATE_HOME: path.join(base, 'xdg-state'),
      OPENCODE_DISABLE_AUTOUPDATE: 'true',
      OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
      OPENCODE_DISABLE_MODELS_FETCH: 'true',
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        model: 'fixture/fixture',
        small_model: 'fixture/fixture',
        provider: {
          fixture: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Fixture',
            options: {
              baseURL: `http://127.0.0.1:${server.address().port}/v1`,
              apiKey: 'local-test-value',
            },
            models: { fixture: { name: 'Fixture', limit: { context: 32000, output: 2048 } } },
          },
        },
        agent: { scout: { mode: 'subagent', prompt: 'Return a short answer.' } },
      }),
    };
    const invoke = (command, input) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, command], {
          cwd: root,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('error', reject);
        child.on('close', (code) => {
          try {
            resolve({ code, stderr, data: stdout.trim() ? JSON.parse(stdout) : null });
          } catch (error) {
            reject(error);
          }
        });
        child.stdin.end(JSON.stringify(input));
      });
    const first = await invoke('task', {
      prompt: 'Say integration passed.',
      agent: 'scout',
      timeoutSeconds: 40,
    });
    assert.equal(
      first.code,
      0,
      JSON.stringify(first) +
        (first.data?.logDirectory
          ? fs.readFileSync(path.join(first.data.logDirectory, 'stderr.log'), 'utf8')
          : ''),
    );
    assert.match(first.data.text, /integration passed/);
    assert.equal(
      fs.readFileSync(path.join(root, 'implemented.txt'), 'utf8'),
      'implemented by real OpenCode tool\n',
    );
    assert.match(JSON.stringify(requests), /Return a short answer/);
    const next = await invoke('task', {
      prompt: 'Continue the same session.',
      resume: first.data.id,
      timeoutSeconds: 40,
    });
    assert.equal(next.code, 0, JSON.stringify(next));
    assert.equal(next.data.sessionID, first.data.sessionID);
    const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    fs.writeFileSync(path.join(root, 'test.txt'), 'before\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    fs.writeFileSync(path.join(root, 'test.txt'), 'after\n');
    const review = await invoke('review', { timeoutSeconds: 40 });
    assert.equal(review.code, 0, JSON.stringify(review));
    const reviewRequest = requests.findLast((r) =>
      r.messages?.some((m) => typeof m.content === 'string' && m.content.includes('<diff>')),
    );
    assert.ok(
      reviewRequest,
      JSON.stringify(requests.map((r) => ({ path: r.path, tools: r.tools }))),
    );
    const toolNames = reviewRequest.tools?.map((tool) => tool.function.name) ?? [];
    assert.ok(toolNames.includes('read'));
    assert.ok(toolNames.includes('glob'));
    assert.ok(toolNames.includes('grep'));
    for (const tool of toolNames)
      assert.ok(['read', 'glob', 'grep'].includes(tool), `Unexpected review tool: ${tool}`);
    assert.equal(fs.readFileSync(path.join(root, 'test.txt'), 'utf8'), 'after\n');
    assert.ok(requests.length >= 3);
  },
);
