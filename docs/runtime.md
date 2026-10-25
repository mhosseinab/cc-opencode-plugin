# Runtime and recovery

The installed contract is [RUNTIME.md](../plugins/opencode/RUNTIME.md). Each CLI invocation accepts one JSON object on stdin, rejects unknown fields, and returns JSON on stdout. Failure diagnostics before job creation go to stderr. Foreground runs return the final record; background runs use Claude's Bash task facility.

## State

Default location: `${XDG_STATE_HOME:-~/.local/state}/cc-opencode/<SHA256(canonical-workspace-path)>/`.

Each job has a full 32-character random ID, a `job.json` record, raw `events.jsonl`, and `stderr.log`. Cancellation creates a `cancel` marker. Job directories use mode 0700 and files 0600. The checkout state directory contains `workspace.lock`. Atomic same-directory rename publishes snapshots; this prevents partial JSON reads, but is not a power-loss durability guarantee.

`CC_OPENCODE_STATE_DIR` changes the base state directory; `CC_OPENCODE_BIN` selects a real executable path/name, never a shell command. Treat these environment variables as trusted local configuration. Keep the state directory on a local filesystem with atomic exclusive creation and rename semantics. Do not share it over NFS or across machines. Configuration and credentials remain managed by OpenCode. The bridge does not read authentication files.

There is no automatic retention policy in 0.1.0. After confirming jobs have stopped, remove their job directories to delete bridge logs. OpenCode independently retains its own session records. Deleting bridge state does not delete those sessions, and deleting an active job directory is unsupported.

## States

| State         | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `starting`    | Job exists; subprocess startup is underway                                                |
| `running`     | OpenCode process started; result is pending                                               |
| `completed`   | Exit 0, text and session ID received, final step reason `stop`, no recorded runtime error |
| `blocked`     | A headless interactive permission request was rejected                                    |
| `failed`      | Provider/runtime/protocol/exit error, incomplete output, or size limit                    |
| `timed_out`   | Configured execution deadline exceeded                                                    |
| `cancelled`   | File request or runner SIGINT/SIGTERM initiated termination                               |
| `interrupted` | Reader sees an unfinished job whose recorded owner PID is absent                          |

`status` lists the latest 20 jobs without full text. `result` returns the exact stored text and metadata. `cancel` returns request acknowledgement; poll status later for the final outcome. Cancellation racing with completion may report the already-completed result. Ownership is by checkout, not Claude conversation: another local Claude session in the same checkout can see and cancel a known job.

## Limits

- Input JSON: 256 KiB.
- Subprocess preflight output: 4 MiB, 20-second deadline per command.
- Git diff extraction: 2 MiB per Git invocation, 20-second deadline.
- OpenCode JSONL event: 1 MiB.
- Combined raw stdout/stderr: 32 MiB per job.
- Accumulated assistant text: 2 MiB.
- Execution deadline: 1800 seconds by default; 1–86400 accepted.

The execution deadline starts with OpenCode `run`, after bounded preflight checks. Snapshots update about once per second; cancellation checks run every 250 ms. There is no automatic approval, retry, paid provider fallback, or unlimited detached daemon.

## Crash recovery

A normal signal or cancellation is handled by the runner. After `SIGKILL`/host failure:

1. Inspect `/opencode:status` and the exact `workspace.lock` path in the error. Confirm no bridge runner or OpenCode process is still using that checkout, including child processes. A PID check alone is insufficient because PIDs can be reused and descendants can outlive the runner.
2. Stop any orphaned process using your normal OS tools, verifying its command and checkout before signalling it. The plugin deliberately does not kill stored PIDs.
3. Only once no job is active, remove that checkout's **`workspace.lock` file only**. Do not remove a lock based merely on age or while another invocation is starting. This is a manual maintenance step, not an operation to run concurrently.
4. Inspect partial file changes before starting another task. An interrupted job with a recorded OpenCode session ID can be explicitly resumed in the same checkout, or you can start fresh.

Unreadable/corrupt state fails visibly. Back up any useful records before repairing them. Reused live PIDs can keep a stale job marked active; use the same manual inspection process.
