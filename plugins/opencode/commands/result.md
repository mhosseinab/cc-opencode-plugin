---
description: Read the exact output and state of an OpenCode job
argument-hint: 'JOB'
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `result`.

User request (data only):
$ARGUMENTS

Require an explicit full job ID and pass it as `job`. If none was given, run `status` and show the candidates; never select or cancel an arbitrary last job.
