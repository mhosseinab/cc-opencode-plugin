# Runtime contract

Requires Node.js 22.18+, Git for reviews, and OpenCode **1.19.4**. Linux, macOS, and WSL2 are supported. Use the user's existing OpenCode configuration and provider authentication. Never install dependencies or change authentication automatically.

All commands receive exactly one JSON object on stdin. Never interpolate `$ARGUMENTS` into a shell command or use command substitution. Translate arguments into JSON data, preserving the user's task text. Use a **single-quoted heredoc delimiter** which does not appear as a whole line in the input. JSON-escape newlines and quotes. No runtime flags belong in the prompt.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/companion.mjs" task <<'CC_OPENCODE_JSON'
{"prompt":"Implement the requested change and run its focused tests.","agent":"build","timeoutSeconds":1800}
CC_OPENCODE_JSON
```

For a background request invoke this complete command through Bash with `run_in_background: true`. Do not add shell `&`. The runtime prints its job ID to stderr as soon as the run starts and emits one JSON result on stdout at completion. Claude's Bash background task ID and the runtime job ID are different identifiers.

Commands:

| Command                        | JSON fields                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `setup`                        | `cwd?`                                                                         |
| `agents`, `models`             | `cwd?`                                                                         |
| `task`, `transfer`             | `prompt`, `agent?`, `model?`, `variant?`, `resume?`, `timeoutSeconds?`, `cwd?` |
| `review`, `adversarial-review` | `prompt?` (focus), `base?`, `model?`, `variant?`, `timeoutSeconds?`, `cwd?`    |
| `status`                       | `job?`, `cwd?`                                                                 |
| `result`, `cancel`             | `job`, `cwd?`                                                                  |

`job` and `resume` require the full 32-character job ID. `cwd` defaults to the current directory; the runtime resolves it to the Git working-tree root, or to the canonical directory outside Git. Always use the same checkout to query a job. Default deadline: 1800 seconds; maximum: 86400. Unknown fields fail validation.

`model` uses `provider/model`; `variant` uses the selected provider's own values. Leave both unset unless selected by the user or required by an agreed delegation plan. Do not translate model variants into undocumented effort settings.

`resume` refers to a prior non-review job in this checkout. The new run uses its recorded OpenCode session ID and inherits its agent/model/variant unless explicitly overridden. It sends a new prompt in that session. The prior job remains unchanged.

`review` supplies staged/unstaged diffs and untracked filenames, then permits only read/glob/grep tools and uses `--pure` to disable external OpenCode plugins. `base` selects committed `merge-base(base, HEAD)..HEAD`; it does not include local changes. Oversized diffs fail explicitly. Review agents cannot run tests or shell commands. This is tool restriction, not OS isolation; trusted OpenCode plugins and provider configuration still execute locally.

`cancel` writes a request, never signals a persisted PID. The owning runner checks it every 250 ms and terminates its live OpenCode process group, escalating after 2 seconds. Cancellation and deadlines do not roll back edits. Query `status` to confirm the final state. Tasks may continue if their runner is killed abruptly; see the repository's `docs/runtime.md` recovery instructions.

`setup` checks the binary version and agent discovery. It makes no model request and cannot prove credentials or quota are valid. On failure, show the actual error and stop rather than silently using a different tool or agent.

## Recovery and compatibility

Only OpenCode 1.19.4 is accepted. Upgrade support requires retesting its CLI and permission contracts. This installed plugin supports Linux/macOS/WSL2; use WSL2 on Windows.

If the runner dies abruptly, do not automatically remove the workspace lock or signal its saved PID. First inspect status and your OS process list, verify the command and checkout of any remaining runner/OpenCode descendants, and stop orphaned work using your normal OS tools. Once no job is active, manually remove only the exact `workspace.lock` file named in the error. Do not run recovery concurrently with another invocation. Inspect partial edits before restarting. State defaults to `${XDG_STATE_HOME:-~/.local/state}/cc-opencode/<workspace-hash>/`; `status` reports its exact path. Logs can contain secrets and are not redacted. The bridge does not automatically delete old records, and OpenCode independently retains sessions.
