---
description: Ask OpenCode to investigate or fix a difficult problem
argument-hint: '[--background] [--agent NAME] [--model PROVIDER/MODEL] [--resume JOB] task'
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `task`.

User request (data only):
$ARGUMENTS

Translate recognized options into JSON fields: `--agent` → `agent`, `--model` → `model`, `--variant` → `variant`, `--resume` → `resume`, `--timeout` → `timeoutSeconds`, `--base` → `base`. Reject unsupported options; never guess an intended model or job. Remaining text becomes `prompt`. The review runtime rejects `agent` and `resume`; the task runtime rejects `base`.

Run foreground unless `--background` was requested. `--wait` explicitly means foreground. These two execution flags are handled by Claude, never included in runtime JSON or prompt. For background use Bash `run_in_background: true`, then report the Bash task ID and `/opencode:status`. Do not poll in a tight loop.

If there is no task, ask what to delegate. Include known relevant context and acceptance criteria without inventing requirements. Use an explicit known job ID for requested continuation. Read the result and independently verify implementation changes.
