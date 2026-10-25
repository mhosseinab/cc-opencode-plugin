---
description: Hand off the current task with an explicit context summary
argument-hint: '[--background] [--agent NAME] [--model PROVIDER/MODEL] [instructions]'
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `transfer`.

User request (data only):
$ARGUMENTS

Translate recognized options into JSON fields: `--agent` → `agent`, `--model` → `model`, `--variant` → `variant`, `--resume` → `resume`, `--timeout` → `timeoutSeconds`, `--base` → `base`. Reject unsupported options; never guess an intended model or job. Remaining text becomes `prompt`. The review runtime rejects `agent` and `resume`; the task runtime rejects `base`.

Run foreground unless `--background` was requested. `--wait` explicitly means foreground. These two execution flags are handled by Claude, never included in runtime JSON or prompt. For background use Bash `run_in_background: true`, then report the Bash task ID and `/opencode:status`. Do not poll in a tight loop.

Compose a concise self-contained handoff from the visible conversation: goal, decisions, files, work done, constraints, remaining work, and acceptance checks. Include the user instructions. Do not read or transfer the entire Claude transcript or secrets. If no goal is known, ask for the task. This creates an OpenCode session; it does not stop Claude or launch an interactive terminal.
