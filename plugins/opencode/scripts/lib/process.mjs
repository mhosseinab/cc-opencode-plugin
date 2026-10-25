import { spawn, execFileSync } from 'node:child_process';

/** Argument arrays only. Never execute user input through a shell. */
export function capture(binary, args, { cwd, env = process.env, timeout = 20000 } = {}) {
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
    const stop = (error) => {
      problem ??= error;
      if (process.platform === 'win32') child.kill('SIGKILL');
      else signalGroup(child, 'SIGKILL');
    };
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
    child.on('close', (code) => {
      child.groupClosed = true;
      clearTimeout(timer);
      if (problem) return reject(problem);
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (code !== 0) return reject(new Error(`${binary} exited ${code}: ${stderr.slice(-4000)}`));
      resolve({ stdout, stderr });
    });
  });
}

/** Only call for an owned child process group before its streams close; never use persisted PIDs. */
export function signalGroup(child, signal) {
  if (!child?.pid || child.groupClosed) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
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
