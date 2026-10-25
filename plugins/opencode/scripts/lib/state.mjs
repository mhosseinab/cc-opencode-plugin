import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { git } from './process.mjs';

export function workspace(cwd = process.cwd()) {
  const resolved = fs.realpathSync(cwd);
  if (!fs.statSync(resolved).isDirectory()) throw new Error('cwd must be a directory.');
  try {
    return fs.realpathSync(git(resolved, ['rev-parse', '--show-toplevel']).trim());
  } catch {
    return resolved;
  }
}

export function stateDirectory(root) {
  const base =
    process.env.CC_OPENCODE_STATE_DIR ||
    path.join(
      process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
      'cc-opencode',
    );
  const dir = path.join(base, createHash('sha256').update(root).digest('hex'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Reject a symlink for the workspace state itself. Parent directories are trusted user config.
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe state directory.');
  fs.chmodSync(dir, 0o700);
  return dir;
}

export function atomicJSON(file, value) {
  const temp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

export function jobDirectory(state, id) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid job ID.');
  return path.join(state, id);
}
export function readJob(state, id) {
  const file = path.join(jobDirectory(state, id), 'job.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Job not found: ${id}`, { cause: error });
    throw error;
  }
}
export function listJobs(state) {
  return fs
    .readdirSync(state)
    .filter((id) => /^[a-f0-9]{32}$/.test(id))
    .map((id) => readJob(state, id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function live(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}
export function snapshot(job) {
  if (['starting', 'running'].includes(job.status) && !live(job.ownerPid)) {
    return {
      ...job,
      status: 'interrupted',
      error: 'Runner exited before recording a final result. Files may have changed.',
    };
  }
  return job;
}

/** Exclusive creation is the cross-process lock. Never steal an active lock. */
export function acquire(state, id) {
  const file = path.join(state, 'workspace.lock');
  try {
    fs.writeFileSync(file, JSON.stringify({ id, pid: process.pid }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      throw new Error(`Workspace lock is unreadable: ${file}. See RUNTIME.md for recovery.`);
    }
    throw new Error(
      live(owner.pid)
        ? `Workspace busy with job ${owner.id}. Wait or cancel it first.`
        : `Stale workspace lock: ${file}. See RUNTIME.md for manual recovery.`,
      { cause: error },
    );
  }
  return () => {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (current.id === id) fs.unlinkSync(file);
  };
}
