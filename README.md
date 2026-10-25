# OpenCode plugin for Claude Code

Let Claude Code plan and coordinate work while OpenCode agents implement, investigate, or provide an independent review. Uses your local OpenCode installation, providers, models, and agent definitions.

An independent implementation inspired by [OpenAI's Codex plugin](https://github.com/openai/codex-plugin-cc). Not affiliated with OpenAI, Anthropic, or OpenCode.

## Quick start

Requires **Node.js 22.18+**, **OpenCode 1.19.4**, and Claude Code with plugin support. Linux, macOS, and WSL2 are supported targets; see [compatibility](docs/compatibility.md) for what has actually been verified. Git is required for reviews.

If OpenCode is not installed, install the tested version yourself:

```bash
npm install -g opencode-ai@1.19.4
opencode auth login
```

Configure your preferred providers and agents in OpenCode as usual. The plugin does not host a model, proxy credentials, or require a particular model vendor.

From a local checkout of this repository:

```bash
claude --plugin-dir ./plugins/opencode
```

Inside Claude Code:

```text
/opencode:setup
/opencode:agents
/opencode:task --agent build Fix the failing pagination test and run the focused tests
/opencode:review
```

No `npm install` or build step is needed to **use** the plugin. Development tooling is separate.

After publishing this repository on GitHub, replace `YOUR-ACCOUNT` below with the actual owner:

```text
/plugin marketplace add YOUR-ACCOUNT/cc-opencode-plugin
/plugin install opencode@cc-opencode
/reload-plugins
```

## Commands

| Command                        | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `/opencode:task`               | Delegate implementation or investigation                            |
| `/opencode:rescue`             | Alias workflow for difficult investigations or fixes                |
| `/opencode:review`             | Restricted review of staged, unstaged, and untracked work           |
| `/opencode:adversarial-review` | Challenge assumptions, design, and failure handling                 |
| `/opencode:transfer`           | Hand off a task using a concise summary of the visible conversation |
| `/opencode:agents`             | Discover primary agents and subagents                               |
| `/opencode:models`             | List models from your OpenCode providers                            |
| `/opencode:status`             | Inspect recent jobs in this checkout                                |
| `/opencode:result JOB`         | Retrieve one job's complete recorded output                         |
| `/opencode:cancel JOB`         | Request cancellation of one explicit job                            |
| `/opencode:setup`              | Check binary version and agent discovery                            |

Examples:

```text
/opencode:task --background --agent build Implement the agreed API change and run its tests
/opencode:status
/opencode:result FULL_JOB_ID_FROM_STATUS
/opencode:task --resume FULL_JOB_ID_FROM_STATUS Address the remaining failing test
/opencode:cancel FULL_JOB_ID_FROM_STATUS
/opencode:review --base main Focus on authorization and race conditions
/opencode:adversarial-review --background Challenge the retry and rollback design
/opencode:task --agent YOUR_AGENT --model YOUR_PROVIDER/YOUR_MODEL Investigate the memory leak
```

`YOUR_AGENT`, model names, account names, and job IDs above are placeholders. Discover real values with `agents`, `models`, and `status`.

Foreground is the default. `--background` uses Claude Code's native Bash background tasks. `--wait` explicitly selects foreground. Task commands also accept `--variant`, `--timeout SECONDS`, and explicit `--resume JOB`. Reviews accept model, variant, timeout, optional focus text, and `--base REF`, but deliberately reject agent/session overrides.

Claude can use the included delegation skill when OpenCode delegation is requested, without a slash command. Claude remains responsible for task scope, integration, and independent verification. The plugin cannot guarantee that a model follows a skill instruction; the runtime enforces its own option, lock, version, and review-tool checks.

## What the bridge does

- Runs `opencode run --format json` with argument arrays and the prompt on stdin.
- Preserves custom agent prompts, models, and permissions. For an explicitly selected subagent, temporarily changes only its mode to `all` so the CLI can run it directly.
- Rejects unknown agents instead of accepting OpenCode's silent fallback.
- Records explicit job/session mappings for continuation; never resumes an unrelated global “last session.”
- Uses an exclusive lock per canonical checkout to prevent simultaneous plugin jobs from editing it.
- Records bounded logs and results outside the repository, in private directories/files.
- Handles deadlines, cancellation, provider errors, malformed events, incomplete turns, and permission rejections distinctly.
- Uses a fresh reviewer with a tool allowlist and OpenCode's `--pure` flag to disable external OpenCode plugins during review.

Implementation jobs retain your OpenCode policy. The bridge never passes `--auto`; OpenCode rejects unresolved interactive approval requests in headless mode. A job may finish as `blocked` when that happens. Explicit existing `allow` permissions still permit actions. Claude permissions do **not** automatically become OpenCode permissions.

Review restrictions are **not an operating-system sandbox**. Configure only trusted OpenCode providers and repository configuration. Diffs and code can contain sensitive data and are sent to the selected model provider. Stored tool output may contain secrets; it is not automatically redacted. See [security](SECURITY.md).

## Verification and limits

The repository contains unit/integration tests plus an optional test that runs the real OpenCode binary against an in-process, deterministic OpenAI-compatible mock provider. That test verifies session continuation, direct subagent execution, and the actual tools sent to the reviewer model. It does not measure a real model's coding quality or validate your provider credentials.

`completed` means a complete OpenCode turn was received, **not** that its changes are correct or its claimed tests passed. Inspect the diff and run the appropriate checks before merging.

One plugin job per checkout; separate Git worktrees can run concurrently. The lock does not stop humans, Claude, or other programs from editing. Background jobs depend on Claude's host process. Cancellation does not undo file changes. Automatic review-on-stop loops, transcript scraping, remote server attachment, and automatic worktree merging are not included in this release.

## Development

```bash
npm ci
npm run check
npm run test:coverage
OPENCODE_LIVE_BIN="$(command -v opencode)" npm test
npm run package
```

The live integration test is skipped unless `OPENCODE_LIVE_BIN` is set. It uses temporary OpenCode config/data directories and no real API credentials. Lint/format tools are development-only dependencies. Runtime code uses Node's standard library.

See [architecture](docs/architecture.md), [runtime/recovery](docs/runtime.md), [compatibility](docs/compatibility.md), [upstream analysis](docs/upstream-analysis.md), and [release checklist](docs/releasing.md).
