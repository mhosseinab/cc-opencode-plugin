# Compatibility

The bridge deliberately supports **OpenCode 1.19.4** exactly. This release was the latest stable GitHub release returned during implementation on 2026-10-25. OpenCode 2 exposes different APIs and is not claimed to work. Other v1 patch versions may work, but are rejected until their contract is checked.

Requirements:

| Component           | Requirement / verification                                                            |
| ------------------- | ------------------------------------------------------------------------------------- |
| Node.js             | 22.18+; tested locally with 24.22.1; CI targets 22 and 24                             |
| OpenCode            | 1.19.4; real binary tested against a local OpenAI-compatible mock provider            |
| Claude Code         | Plugin support; manifests validated locally with 2.1.310                              |
| Git                 | Required for reviews and canonical Git checkout resolution                            |
| Linux               | Locally exercised                                                                     |
| macOS               | Supported target; CI configured, not executed in this workspace                       |
| Windows             | Use WSL2; native process-group cancellation is refused                                |
| Real model provider | Uses your existing OpenCode config; not exercised with paid/external model calls here |

The real-binary test checks CLI JSON events, stdin prompts, actual file creation by an OpenCode tool, agent/subagent selection, session resumption, config overlays, and the review tool set actually passed to the provider. It does not simulate a signed-in Claude conversation or prove that Claude will always follow a slash-command instruction correctly. A manual Claude acceptance run is required before a public release.

To support another OpenCode version, inspect its CLI/event/config contracts, update the version gate and CI binary together, run the live tests, and record the result here. Do not remove the gate just to suppress an error.

Sources: [OpenCode CLI](https://opencode.ai/docs/cli), [agents](https://opencode.ai/docs/agents), [permissions](https://opencode.ai/docs/permissions), [1.19.4 CLI source](https://github.com/anomalyco/opencode/blob/v1.19.4/packages/opencode/src/cli/cmd/run.ts), [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference).
