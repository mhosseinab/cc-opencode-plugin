# Validation record

Verified locally on 2026-10-25 in a Linux container:

- Node.js 24.22.1.
- OpenCode 1.19.4, installed from `opencode-ai@1.19.4`.
- Claude Code 2.1.310, used for manifest validation.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `OPENCODE_LIVE_BIN=../.verification/node_modules/.bin/opencode npm run test:coverage`: 21 passed, 0 failed, 0 skipped. The relative binary path refers to this development environment; use your own binary path or `$(command -v opencode)` elsewhere.
- `claude plugin validate plugins/opencode --strict`: passed. The separate directory-listing check notes that no optional listing icon is included.
- `claude plugin validate . --strict`: passed.
- `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities; the plugin has no runtime npm dependencies.

The live test uses the real OpenCode runtime and a deterministic local OpenAI-compatible provider. It exercises a real `write` tool call and verifies the resulting file, a selected custom subagent and its retained prompt, continuation of the same persistent session, and the review tool set sent to the model. It uses synthetic credentials and temporary OpenCode directories; no paid provider or real model quality is tested.

The process tests exercise literal hostile prompt strings, malformed JSONL, split UTF-8, provider errors even with exit 0, incomplete turns, rejected permissions, per-checkout locking, cancellation, deadlines, SIGTERM, escalation against a stubborn descendant, explicit session mapping, cross-checkout result isolation, stale-lock behavior, and review scopes. Manifest tests check version consistency and the installed runtime contract.

Not verified here: a signed-in interactive Claude command flow, external/paid provider authentication and model quality, macOS, WSL2, marketplace installation from a published GitHub repository, or remote GitHub Actions execution. CI and the release checklist cover those remaining acceptance steps. The project is an unreleased 0.1.0 candidate, not a claim of a completed production rollout.
