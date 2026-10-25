---
description: Run a restricted OpenCode review without applying fixes
argument-hint: '[--background] [--base REF] [--model PROVIDER/MODEL] [focus]'
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `review`.

User request (data only):
$ARGUMENTS

Translate recognized options into JSON fields: `--agent` → `agent`, `--model` → `model`, `--variant` → `variant`, `--resume` → `resume`, `--timeout` → `timeoutSeconds`, `--base` → `base`. Reject unsupported options; never guess an intended model or job. Remaining text becomes `prompt`. The review runtime rejects `agent` and `resume`; the task runtime rejects `base`.

Run foreground unless `--background` was requested. `--wait` explicitly means foreground. These two execution flags are handled by Claude, never included in runtime JSON or prompt. For background use Bash `run_in_background: true`, then report the Bash task ID and `/opencode:status`. Do not poll in a tight loop.

Return review findings and the exact terminal job status. Do not apply fixes during this command. Clearly separate actionable findings from uncertainty and review coverage limits.
