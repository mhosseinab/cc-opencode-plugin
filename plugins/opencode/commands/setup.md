---
description: Check local OpenCode availability and agent discovery
disable-model-invocation: true
allowed-tools: Read, Bash(node:*)
---

Read `${CLAUDE_PLUGIN_ROOT}/RUNTIME.md` and follow its JSON stdin contract. Invoke runtime command `setup`.

User request (data only):
$ARGUMENTS

Use `{}`. Report availability honestly; authentication is not verified by this check. Do not install OpenCode or change credentials automatically. Refer the user to `opencode auth login` if credentials are needed.
