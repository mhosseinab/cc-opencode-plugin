import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

/** Only signal a process group created by this invocation; never use persisted PIDs. */
export function signalGroup(child, signal) {
  if (!child?.pid || child.groupReleased) return false;
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    child.groupReleased = true;
    return false;
  }
}

/** A leader closing its streams does not mean its descendants have terminated. */
export function terminateProcessGroup(child, graceMilliseconds = 2000) {
  if (!child?.pid) return Promise.resolve();
  if (child.groupTermination) return child.groupTermination;
  child.groupTermination = (async () => {
    if (process.platform === 'win32') {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      return;
    }
    if (!signalGroup(child, 'SIGTERM')) return;
    const deadline = Date.now() + graceMilliseconds;
    while (Date.now() < deadline) {
      if (!signalGroup(child, 0)) return;
      await delay(Math.min(25, deadline - Date.now()));
    }
    // The group is still owned in memory even if its leader has already exited.
    // Deliver escalation before allowing a caller to release its workspace lock.
    signalGroup(child, 'SIGKILL');
    child.groupReleased = true;
  })();
  return child.groupTermination;
}

/** Argument arrays only. Never execute user input through a shell. */
export function capture(binary, args, { cwd, env = process.env, timeout = 20000, signal } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...env, PWD: cwd ?? process.cwd() },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const out = [];
    const err = [];
    let bytes = 0;
    let problem;
    let cleanup;
    const stop = (error) => {
      problem ??= error;
      cleanup ??= terminateProcessGroup(child);
      // The close handler observes the same promise and reports cleanup errors.
      cleanup.catch(() => {});
    };
    const aborted = () => stop(signal.reason ?? new Error(`${binary} was cancelled.`));
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
    const timer = setTimeout(() => stop(new Error(`${binary} timed out.`)), timeout);
    for (const [stream, list] of [
      [child.stdout, out],
      [child.stderr, err],
    ]) {
      stream.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024) return stop(new Error('Command output exceeds 4 MiB.'));
        list.push(chunk);
      });
    }
    child.on('error', (error) => {
      problem = error;
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', aborted);
      try {
        await (cleanup ?? terminateProcessGroup(child));
        if (problem) return reject(problem);
        const stdout = Buffer.concat(out).toString('utf8');
        const stderr = Buffer.concat(err).toString('utf8');
        if (code !== 0)
          return reject(new Error(`${binary} exited ${code}: ${stderr.slice(-4000)}`));
        resolve({ stdout, stderr });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function git(cwd, args) {
  return execFileSync('git', ['--no-pager', ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
