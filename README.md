# OpenCode plugin for Claude Code

Let Claude Code coordinate work while your local OpenCode agents implement changes, investigate problems, or review code. Use your existing OpenCode providers, models, credentials, and custom agents.

## Install

Requires **Node.js 22.18+**, **OpenCode 1.19.4 or newer within 1.x**, and Claude Code with plugin support. Git is required for reviews. Linux and macOS are tested in CI; Windows users can use WSL2.

Inside Claude Code, run:

```text
/plugin marketplace add mhosseinab/cc-opencode-plugin
/plugin install opencode@cc-opencode
/reload-plugins
/opencode:setup
```

If you need to install OpenCode and connect a provider, run these in your terminal first:

```bash
npm install -g 'opencode-ai@^1.19.4'
opencode auth login
```

No repository checkout or plugin build is required. `/opencode:setup` checks the OpenCode version and available agents; your first task verifies provider access.

## Usage

```text
/opencode:agents
/opencode:models
/opencode:task --agent build Fix the failing pagination test and run the focused tests
/opencode:review
```

Select a model and its provider-specific variant:

```text
/opencode:task --agent build --model PROVIDER/MODEL --variant VARIANT Investigate the memory leak
```

Replace `PROVIDER/MODEL` with an entry from `/opencode:models` and `VARIANT` with a value supported by that model. Omit these options to use your OpenCode defaults.

For background work and continuation:

```text
/opencode:task --background --agent build Implement the agreed API change and run its tests
/opencode:status
/opencode:result JOB_ID
/opencode:task --resume JOB_ID Address the remaining failing test
/opencode:cancel JOB_ID
```

Use the complete job ID returned by the runtime. Cancellation applies to an active job and leaves any partial file changes in place.

## Commands

| Command                        | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `/opencode:task`               | Delegate implementation or investigation            |
| `/opencode:rescue`             | Delegate a difficult investigation or fix           |
| `/opencode:review`             | Review staged, unstaged, and untracked work         |
| `/opencode:adversarial-review` | Challenge design choices and failure handling       |
| `/opencode:transfer`           | Hand off the current task with a context summary    |
| `/opencode:agents`             | List primary agents and subagents                   |
| `/opencode:models`             | List models from your providers                     |
| `/opencode:status`             | Show recent jobs in this checkout                   |
| `/opencode:result JOB_ID`      | Retrieve a job's recorded output                    |
| `/opencode:cancel JOB_ID`      | Request cancellation of a specific job              |
| `/opencode:setup`              | Check the OpenCode installation and discover agents |

Tasks accept `--agent`, `--model`, `--variant`, `--resume JOB_ID`, and `--timeout SECONDS`. Run in the foreground by default, or use `--background` or `--wait` explicitly.

Reviews accept model, variant, timeout, and optional focus text. Use `--base REF` for committed branch changes:

```text
/opencode:review --base main Focus on authorization and race conditions
/opencode:adversarial-review --background Challenge the retry and rollback design
```

Reviews always use a fresh restricted agent. Claude can also use the included delegation skill when you ask it to use OpenCode without a slash command.

## Configuration and permissions

Implementation tasks use your existing OpenCode configuration and tool permissions. Custom agents and subagents are supported; a selected subagent's mode is temporarily changed to `all` for that process, preserving its other settings. Unknown agent names are rejected.

The bridge does not enable automatic permission approval. OpenCode rejects unresolved interactive permission requests in headless mode; the runtime reports those jobs as `blocked`. Claude's permissions do not automatically become OpenCode's permissions.

Review tools are restricted to read/glob/grep, and external OpenCode plugins are disabled during review. These restrictions are not an operating-system sandbox. Code and diffs go to your selected model provider, and private local logs may contain sensitive output. See [security](SECURITY.md).

## Execution and verification

Only one plugin job runs in a checkout at a time; use separate Git worktrees for concurrent work. The lock does not prevent edits by Claude, humans, or other programs. Background jobs depend on Claude's host process.

A `completed` job means OpenCode returned a complete turn. Inspect its diff and run the relevant checks before merging. Automatic review-on-stop loops, remote server attachment, and automatic worktree merging are not included.

## Update

```text
/plugin marketplace update cc-opencode
/plugin update opencode@cc-opencode
/reload-plugins
/opencode:setup
```

The marketplace installs tagged releases. Compatible stable OpenCode updates within 1.x are accepted; see [compatibility](docs/compatibility.md) for the tested versions and version policy.

## Development

From a local checkout:

```bash
npm ci
npm run check
npm run test:coverage
OPENCODE_LIVE_BIN="$(command -v opencode)" npm test
npm run package
claude --plugin-dir ./plugins/opencode
```

Runtime code uses Node's standard library and has no npm dependencies. The optional real-binary test uses a local mock provider and temporary OpenCode directories, without paid API calls. It is skipped unless `OPENCODE_LIVE_BIN` is set.

Successful `main` pushes run semantic-release after CI. See [releasing](docs/releasing.md) for commit conventions, permissions, and the release process.

Further documentation: [architecture](docs/architecture.md), [runtime and recovery](docs/runtime.md), [compatibility](docs/compatibility.md), [contributing](CONTRIBUTING.md), and [upstream approach](docs/upstream-analysis.md).

Inspired by [OpenAI's Codex plugin](https://github.com/openai/codex-plugin-cc). This project is not affiliated with OpenAI, Anthropic, or OpenCode.
