# Compatibility

The runtime accepts **stable OpenCode releases in the range `>=1.19.4 <2.0.0`**, including 1.19.5 and later 1.x releases. Updating OpenCode within that range does not require a plugin update or a downgrade to 1.19.4.

Version components are compared numerically. Releases below 1.19.4, other major versions, prereleases, and unrecognized version strings are rejected with the accepted range in the error. Stable versions with build metadata are accepted.

Accepted versions and tested versions are different: CI exercises 1.19.4 on Node 22/24 and 1.19.5 on Node 24, on Linux and macOS. Other newer stable 1.x versions are accepted based on the same CLI contract; this does not claim that every future release has been tested.

## Requirements and checks

| Component       | Requirement / verification                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| Node.js         | 22.18+; CI tests Node 22 and 24                                                          |
| OpenCode        | Stable `>=1.19.4 <2.0.0`; real-binary tests target 1.19.4 and 1.19.5                     |
| Claude Code     | Plugin support; manifests and marketplace installation verified with 2.1.310             |
| Git             | Required for reviews and canonical Git checkout resolution                               |
| Linux and macOS | Tested in GitHub Actions                                                                 |
| Windows         | Use WSL2; native Windows process-group cancellation is unsupported                       |
| Model provider  | Uses your existing OpenCode configuration and credentials; CI uses a local mock provider |

The real-binary test checks stdin prompts, JSON events, actual file creation, custom subagent selection, session continuation, configuration overlays, and the tools exposed to the reviewer. Unit/process tests cover the version range, including a regression test for setup and delegation with 1.19.5.

Marketplace installation and setup are tested in an isolated Claude configuration. This does not validate your provider credentials, paid model access, or a model's coding quality. Run a small task to check your own provider.

When changing the minimum or supporting another major version, inspect the CLI/event/permission contracts, run the real-binary tests, and update the CI versions and this document. Keep compatibility errors visible rather than silently choosing another agent or provider.

References: [OpenCode CLI](https://opencode.ai/docs/cli), [agents](https://opencode.ai/docs/agents), [permissions](https://opencode.ai/docs/permissions), [OpenCode source](https://github.com/anomalyco/opencode), [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference).
