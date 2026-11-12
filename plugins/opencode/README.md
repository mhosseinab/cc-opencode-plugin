# OpenCode for Claude Code

Delegate implementation, investigation, and code reviews to your local OpenCode agents, using your existing providers, models, and custom agents.

Requires Node.js 22.18+, OpenCode 1.19.4 or newer within 1.x, and a configured model provider. Git is required for reviews.

## Install

Inside Claude Code:

```text
/plugin marketplace add mhosseinab/cc-opencode-plugin
/plugin install opencode@cc-opencode
/reload-plugins
/opencode:setup
```

If OpenCode is not installed, run these in your terminal first:

```bash
npm install -g 'opencode-ai@^1.19.4'
opencode auth login
```

## Use

```text
/opencode:agents
/opencode:models
/opencode:task --agent build Implement the agreed change and run its tests
/opencode:review
```

Tasks support agent/model/variant selection, background execution, and continuation using an explicit job ID. Use `/opencode:status`, `/opencode:result JOB_ID`, and `/opencode:cancel JOB_ID` to manage jobs.

## Update

```text
/plugin marketplace update cc-opencode
/plugin update opencode@cc-opencode
/reload-plugins
/opencode:setup
```

Setup checks the installation and agents; a task verifies provider access. Implementation tasks use your OpenCode permissions. Reviews permit only read/glob/grep tools. Inspect and verify implementation changes before merging.

There is no plugin build step or runtime npm dependency. See [RUNTIME.md](RUNTIME.md) for the full command contract, permissions, limits, and recovery instructions. For development from a repository checkout, use `claude --plugin-dir ./plugins/opencode` from its root.
