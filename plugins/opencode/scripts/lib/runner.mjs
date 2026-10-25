import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { EventDecoder } from './events.mjs';
import { signalGroup } from './process.mjs';
import { acquire, atomicJSON, jobDirectory, readJob, snapshot } from './state.mjs';
import {
  agents,
  binary,
  inlineConfig,
  inspect,
  REVIEW_AGENT,
  reviewEnvironment,
  runArgs,
} from './opencode.mjs';
import { reviewPrompt } from './review.mjs';

const LOG_LIMIT = 32 * 1024 * 1024;
const TEXT_LIMIT = 2 * 1024 * 1024;

export async function run(command, input, root, state) {
  if (process.platform === 'win32')
    throw new Error('Use WSL2: native Windows process cancellation is not supported.');
  const id = randomBytes(16).toString('hex');
  const release = acquire(state, id);
  const dir = jobDirectory(state, id);
  let job;
  try {
    await inspect(root);
    let env = { ...process.env, PWD: root, NO_COLOR: '1', TERM: 'dumb' };
    let agent = input.agent;
    if (input.resume) {
      const previous = snapshot(readJob(state, input.resume));
      if (['starting', 'running'].includes(previous.status))
        throw new Error('Cannot resume an active job.');
      if (previous.command.includes('review'))
        throw new Error('Review sessions cannot be resumed as implementation jobs.');
      if (!previous.sessionID) throw new Error('Job has no resumable OpenCode session ID.');
      input = {
        ...input,
        sessionID: previous.sessionID,
        agent: input.agent ?? previous.agent,
        model: input.model ?? previous.model,
        variant: input.variant ?? previous.variant,
      };
      agent = input.agent;
    }
    let prompt = input.prompt;
    if (command.includes('review')) {
      env = reviewEnvironment(env);
      agent = REVIEW_AGENT;
      prompt = reviewPrompt(root, input, command === 'adversarial-review');
    }
    if (agent) {
      const entry = (await agents(root, env, command.includes('review'))).find(
        (entry) => entry.name === agent,
      );
      if (!entry) throw new Error(`Unknown agent: ${agent}. Run /opencode:agents.`);
      if (entry.mode === 'subagent') {
        // CLI otherwise silently falls back. Promote only mode, preserving agent prompt/tools/model.
        const config = env.OPENCODE_CONFIG_CONTENT ? JSON.parse(env.OPENCODE_CONFIG_CONTENT) : {};
        env = inlineConfig(env, { agent: { [agent]: { ...config.agent?.[agent], mode: 'all' } } });
      }
    }
    fs.mkdirSync(dir, { mode: 0o700 });
    job = {
      id,
      command,
      root,
      status: 'starting',
      createdAt: new Date().toISOString(),
      ownerPid: process.pid,
      agent: agent ?? null,
      model: input.model ?? null,
      variant: input.variant ?? null,
      resume: input.resume ?? null,
      timeoutSeconds: input.timeoutSeconds,
      sessionID: input.sessionID ?? null,
      progress: null,
      text: '',
      error: null,
      permissionDenied: false,
      logDirectory: dir,
    };
    const save = () => {
      job.updatedAt = new Date().toISOString();
      atomicJSON(path.join(dir, 'job.json'), job);
    };
    save();
    process.stderr.write(`OpenCode job ${id}\n`);
    await execute({ input, root, dir, env, agent, prompt, job, save });
    return job;
  } finally {
    release();
  }
}

async function execute({ input, root, dir, env, agent, prompt, job, save }) {
  const stdoutFile = fs.openSync(path.join(dir, 'events.jsonl'), 'wx', 0o600);
  const stderrFile = fs.openSync(path.join(dir, 'stderr.log'), 'wx', 0o600);
  let child;
  let timer;
  let forceTimer;
  let poll;
  let total = 0;
  let finalReason;
  let failure;
  let stopping;
  let stderrTail = '';
  let lastSave = 0;
  const texts = new Map();
  const stop = (status, message) => {
    if (stopping) return;
    stopping = status;
    failure = message;
    signalGroup(child, 'SIGTERM');
    forceTimer = setTimeout(() => signalGroup(child, 'SIGKILL'), 2000);
  };
  const interrupted = () =>
    stop('cancelled', 'Runner interrupted. Partial file changes may remain.');
  try {
    child = spawn(binary(), runArgs(input, agent), {
      cwd: root,
      env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    const closed = new Promise((resolve) => {
      child.on('error', (error) => {
        failure = error.message;
      });
      child.on('close', (code, signal) => {
        child.groupClosed = true;
        resolve({ code, signal });
      });
    });
    process.on('SIGINT', interrupted);
    process.on('SIGTERM', interrupted);
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') stop('failed', error.message);
    });
    // stdin avoids shell injection, process-list prompt exposure, and argument-size limits.
    child.stdin.end(prompt);
    job.status = 'running';
    save();
    const notice = (line) => {
      if (/falling back to default agent/i.test(line))
        stop('failed', 'OpenCode attempted an unexpected agent fallback.');
      if (/permission requested:.*auto-rejecting/i.test(line)) job.permissionDenied = true;
    };
    const decoder = new EventDecoder((event) => {
      if (event.sessionID) {
        if (typeof event.sessionID !== 'string') throw new Error('Invalid session ID in event.');
        if (job.sessionID && event.sessionID !== job.sessionID)
          throw new Error('Unexpected OpenCode session change.');
        job.sessionID = event.sessionID;
      }
      if (event.type === 'error') {
        failure = JSON.stringify(event.error ?? 'OpenCode reported an error.').slice(0, 4000);
      }
      if (event.type === 'text' && typeof event.part?.text === 'string') {
        texts.set(event.part.id ?? String(texts.size), event.part.text);
        job.text = [...texts.values()].join('\n\n');
        if (Buffer.byteLength(job.text) > TEXT_LIMIT)
          throw new Error('OpenCode text exceeds 2 MiB.');
      }
      if (event.type === 'step_finish') finalReason = event.part?.reason;
      if (event.type === 'tool_use')
        job.progress = `Tool: ${event.part?.tool ?? 'unknown'} (${event.part?.state?.status ?? 'unknown'})`;
      else job.progress = event.type;
    }, notice);
    const log = (fd, chunk) => {
      total += chunk.length;
      if (total > LOG_LIMIT) {
        stop('failed', 'OpenCode logs exceed 32 MiB.');
        return false;
      }
      fs.writeSync(fd, chunk);
      return true;
    };
    child.stdout.on('data', (chunk) => {
      try {
        if (log(stdoutFile, chunk)) decoder.push(chunk);
      } catch (error) {
        stop('failed', error.message);
      }
    });
    child.stderr.on('data', (chunk) => {
      try {
        log(stderrFile, chunk);
        stderrTail = (stderrTail + chunk.toString('utf8')).slice(-8000);
        notice(stderrTail);
      } catch (error) {
        stop('failed', error.message);
      }
    });
    timer = setTimeout(
      () => stop('timed_out', 'Deadline exceeded. Partial file changes may remain.'),
      input.timeoutSeconds * 1000,
    );
    poll = setInterval(() => {
      try {
        if (fs.existsSync(path.join(dir, 'cancel')))
          stop('cancelled', 'Cancellation requested. Partial file changes may remain.');
        if (Date.now() - lastSave >= 1000) {
          save();
          lastSave = Date.now();
        }
      } catch (error) {
        stop('failed', `Could not persist job: ${error.message}`);
      }
    }, 250);
    const { code, signal } = await closed;
    try {
      decoder.end();
    } catch (error) {
      failure ??= error.message;
    }
    job.exitCode = code;
    job.signal = signal;
    job.status =
      stopping ??
      (failure || code !== 0 ? 'failed' : job.permissionDenied ? 'blocked' : 'completed');
    if (
      job.status === 'completed' &&
      (!job.sessionID || !job.text.trim() || finalReason !== 'stop')
    ) {
      job.status = 'failed';
      failure = `Incomplete OpenCode output (final reason: ${finalReason ?? 'missing'}).`;
    }
    job.error =
      failure ??
      (job.status === 'failed'
        ? stderrTail.trim() || `OpenCode exited ${code}.`
        : job.status === 'blocked'
          ? 'OpenCode rejected at least one permission request. Inspect the result before continuing.'
          : null);
  } catch (error) {
    if (child) signalGroup(child, 'SIGKILL');
    job.status = 'failed';
    job.error = error.message;
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    clearInterval(poll);
    process.removeListener('SIGINT', interrupted);
    process.removeListener('SIGTERM', interrupted);
    fs.closeSync(stdoutFile);
    fs.closeSync(stderrFile);
    job.completedAt = new Date().toISOString();
    save();
  }
}
