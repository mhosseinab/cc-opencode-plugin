# Upstream approach and adaptation

Inspected [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) at tree `db52e28f4d9ded852ab3942cea316258ae4ef346`, including its README, command definitions, hooks, job-control module, and app-server client. This project implements its own bridge; it does not vendor upstream source.

The upstream plugin is more than a model proxy. Its slash commands and rescue agent drive a Node companion, which communicates with Codex's app server, can reuse a broker connection, records jobs and threads, handles reviews, and supports an optional Stop-hook review gate. Claude orchestrates the work while Codex executes against the local checkout and its own configuration.

OpenCode already has noninteractive execution with structured events and native session IDs. A subprocess bridge is enough for delegation without translating Codex's app-server protocol or maintaining a new HTTP service. OpenCode's CLI directly exposes model, agent, variant, and session selection. Its current CLI silently falls back for missing agents and subagent-only modes; this bridge validates selection first and promotes only a chosen subagent's mode in ephemeral inline configuration.

| Capability                            | This plugin                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Delegate implementation/investigation | `task`, `rescue`                                                                   |
| Independent review                    | Fresh restricted OpenCode agent; OpenCode does not provide Codex's native reviewer |
| Steerable adversarial review          | `adversarial-review` with optional focus                                           |
| Background execution                  | Claude's native Bash background tasks                                              |
| Status/result/cancel                  | Persistent explicit job records and cooperative cancellation                       |
| Session continuation                  | Explicit prior job → recorded OpenCode session                                     |
| Handoff                               | Explicit visible-context summary via `transfer`; no whole transcript scraping      |
| Provider/agent/model selection        | OpenCode configuration plus per-job overrides                                      |
| Concurrent work                       | One plugin job per checkout; separate worktrees allowed                            |
| Stop-time automatic review gate       | Not included; no automatic review/fix loop                                         |
| Interactive terminal takeover         | Not included; recorded OpenCode session can be opened manually                     |
| Remote server/broker reuse            | Not included; one local OpenCode runtime per run                                   |

Changes compared with the inspected approach include literal stdin prompt handling, explicit-only continuation/cancellation, direct subagent support, a tool allowlist for review, conservative workspace locking, bounded output, strict tested-version checks, and a real-binary local-provider contract test. These are design tradeoffs rather than a claim that every upstream feature is reproduced.
