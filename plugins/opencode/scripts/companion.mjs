#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readInput, validate, RUN_COMMANDS, COMMANDS } from './lib/input.mjs';
import {
  listJobs,
  readJob,
  snapshot,
  stateDirectory,
  workspace,
  jobDirectory,
} from './lib/state.mjs';
import { agents, binary, inspect } from './lib/opencode.mjs';
import { capture } from './lib/process.mjs';
import { run } from './lib/runner.mjs';

async function main() {
  const command = process.argv[2];
  if (command === '--help' || !command) {
    console.log(
      `Usage: node companion.mjs <${COMMANDS.join('|')}>\nSupply one JSON object on stdin. See docs/runtime.md.`,
    );
    return;
  }
  if (process.argv.length > 3)
    throw new Error('Supply options as JSON on stdin, not shell arguments.');
  const input = validate(command, await readInput(process.stdin));
  const root = workspace(input.cwd);
  if (['setup', 'agents', 'models'].includes(command)) {
    const info = await inspect(root);
    if (command === 'setup') {
      return {
        ...info,
        root,
        binary: binary(),
        agents: await agents(root),
        authentication: 'not_verified',
        note: 'No provider request was made. Use a small task to verify credentials and model access.',
      };
    }
    if (command === 'agents') return { ...info, agents: await agents(root) };
    return { ...info, models: (await capture(binary(), ['models'], { cwd: root })).stdout };
  }
  const state = stateDirectory(root);
  if (RUN_COMMANDS.includes(command)) {
    const result = await run(command, input, root, state);
    if (result.status !== 'completed') process.exitCode = 1;
    return result;
  }
  if (command === 'status') {
    const jobs = input.job ? [readJob(state, input.job)] : listJobs(state).slice(0, 20);
    return {
      root,
      stateDirectory: state,
      jobs: jobs.map((job) => {
        const { text, ...rest } = snapshot(job);
        return { ...rest, outputCharacters: text.length };
      }),
    };
  }
  const job = snapshot(readJob(state, input.job));
  if (command === 'result') return job;
  if (!['starting', 'running'].includes(job.status))
    return { id: job.id, status: job.status, cancellationRequested: false };
  fs.writeFileSync(path.join(jobDirectory(state, job.id), 'cancel'), '', { mode: 0o600 });
  return {
    id: job.id,
    status: job.status,
    cancellationRequested: true,
    note: 'Cancellation is cooperative. Check status for the final outcome; file changes are not rolled back.',
  };
}

try {
  const result = await main();
  if (result !== undefined) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
