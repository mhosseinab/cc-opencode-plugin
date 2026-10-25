# Architecture

Claude Code loads conventional plugin commands and a delegation skill. Those instructions call one small Node CLI, supplying typed-by-validation JSON on stdin. This keeps the installed plugin self-contained: no MCP daemon, localhost listener, background broker, npm install, or generated JavaScript is required.

The runtime calls the documented OpenCode noninteractive CLI instead of its HTTP API. OpenCode owns provider authentication, agent definitions, tool execution, and persistent sessions. Using the CLI gives normal OpenCode config resolution and avoids the divergent v1/v2 HTTP APIs. Version compatibility is deliberately narrow until tested.

## Modules

| Module          | Responsibility                                                                   |
| --------------- | -------------------------------------------------------------------------------- |
| `input.mjs`     | Request allowlist, type/range validation, bounded stdin                          |
| `process.mjs`   | Shell-free subprocesses, bounded capture, Git calls, owned process-group signals |
| `state.mjs`     | Canonical workspace identity, private state, atomic writes, exclusive lock       |
| `opencode.mjs`  | Version check, agent discovery, ephemeral config overlays, CLI arguments         |
| `review.mjs`    | Review scope, safe Git diff extraction, review prompt                            |
| `events.mjs`    | Incremental UTF-8 JSONL decoding and per-record limit                            |
| `runner.mjs`    | OpenCode execution, job transitions, output limits, cancellation, deadlines      |
| `companion.mjs` | CLI command dispatch and machine-readable results                                |

## Lifecycle

Validate → canonicalize checkout → acquire lock → verify version → resolve explicit continuation → prepare review or agent → create job → execute → persist terminal state → release lock.

Preflight failures produce an error without a model call or a fabricated job result. One JSON result is emitted on stdout; the startup job ID goes to stderr. External process exit codes are recorded. The CLI exits nonzero for every non-completed run.

Cancellation is a file request consumed by the owning runner, not `kill` against a stored PID. TERM targets the owned OpenCode process group; KILL follows after two seconds if it has not closed. State readers only use PID liveness to identify obvious interruptions. PID reuse can conservatively make a stale lock appear busy; no automatic recovery signals that PID.

A cancelled run can leave changes. A `SIGKILL`, host crash, or power failure can leave an orphaned OpenCode group and a stale lock; recovery requires human inspection. We choose a visible blocked checkout over an automatic stale-lock takeover that could allow overlapping writers.

## Review boundaries

A fresh named review agent overrides both top-level and agent-specific permissions to deny every tool except read/glob/grep. Sensitive environment/certificate patterns and external directories remain denied. Shell, network, task delegation, write tools, and arbitrary custom/MCP tools are not allowlisted. `--pure` disables external OpenCode plugins for review preflight and execution.

Diffs disable external Git diff and textconv drivers. Working-tree reviews include staged and unstaged tracked diffs plus untracked names, with file reads available for inspection. Branch reviews embed committed changes from the merge base; on-disk files can differ from the committed target. Large diffs fail explicitly rather than being silently truncated. The model supplies prose findings, which Claude must verify; findings are not a deterministic acceptance gate.

This is a tool boundary, not process isolation. Provider integrations and core OpenCode code still execute on the local machine. A separate OS/container sandbox would be needed for hostile runtime configuration.
