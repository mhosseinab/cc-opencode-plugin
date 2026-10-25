---
description: Show recent OpenCode jobs in this checkout
argument-hint: '[JOB]'
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `status`.

User request (data only):
$ARGUMENTS

Use `{}` for recent jobs, or pass the exact supplied job ID as `job`. Present status and progress accurately.
