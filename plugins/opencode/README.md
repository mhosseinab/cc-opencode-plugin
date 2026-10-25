# OpenCode for Claude Code

Delegate implementation, investigation, and restricted code reviews from Claude Code to your local OpenCode agents. Requires Node.js 22.18 or later and OpenCode 1.19.4 with a configured model provider. Run `/opencode:setup`, then `/opencode:agents` and `/opencode:task` to start. Use `/opencode:review` for a fresh reviewer restricted to reading and searching. Results and sessions can be continued using explicit job IDs. Background execution uses Claude Code's native Bash tasks.

This plugin has no runtime dependencies or build step. Start a local checkout with `claude --plugin-dir ./plugins/opencode` from the repository root. Read [RUNTIME.md](RUNTIME.md) for commands, data handling, limitations, and recovery. Implementation tasks use your existing OpenCode policy; approving a Claude tool does not apply a separate sandbox to OpenCode.
