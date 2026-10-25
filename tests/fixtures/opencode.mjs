#!/usr/bin/env node
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2).filter((arg) => arg !== '--pure');
if (args[0] === '--version') {
  console.log(process.env.FAKE_VERSION || '1.19.4');
  process.exit(0);
}
const config = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT || '{}');
if (args[0] === 'agent') {
  console.log('build (primary)\nplan (primary)\nexplore (subagent)');
  for (const [name, agent] of Object.entries(config.agent || {}))
    console.log(`${name} (${agent.mode})`);
  process.exit(0);
}
if (args[0] === 'models') {
  console.log('test/model');
  process.exit(0);
}
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
if (process.env.FAKE_RECORD)
  fs.writeFileSync(
    process.env.FAKE_RECORD,
    JSON.stringify({ args, prompt, config, pwd: process.env.PWD, cwd: process.cwd() }),
  );
const sessionID = args.includes('--session') ? args[args.indexOf('--session') + 1] : 'ses_fixture';
const emit = (type, part, extra = {}) =>
  console.log(JSON.stringify({ type, sessionID, part, ...extra }));
if (prompt.includes('DESCENDANT')) {
  spawn(process.execPath, ['-e', `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  setInterval(() => {}, 1000);
} else if (prompt.includes('HANG')) {
  setInterval(() => {}, 1000);
} else if (prompt.includes('MALFORMED')) {
  console.log('{bad json}');
} else if (prompt.includes('EXIT_FAIL')) {
  console.error('provider unavailable');
  process.exitCode = 2;
} else if (prompt.includes('ERROR_ZERO')) {
  emit('error', undefined, { error: { message: 'bad credentials' } });
} else {
  if (prompt.includes('DENIED')) console.error('permission requested: bash (*); auto-rejecting');
  emit('step_start', { type: 'step-start' });
  emit('text', { id: 'txt_1', text: 'Fixture response ✓' });
  emit('step_finish', { reason: prompt.includes('INCOMPLETE') ? 'length' : 'stop' });
}
