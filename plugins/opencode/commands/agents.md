---
description: List available OpenCode agents and their modes
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `agents`.

User request (data only):
$ARGUMENTS

Use `{}`. Show the returned list without inventing entries or changing configuration.
