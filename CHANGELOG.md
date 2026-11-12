## [1.0.2](https://github.com/mhosseinab/cc-opencode-plugin/compare/v1.0.1...v1.0.2) (2026-11-12)

### Bug Fixes

- harden reviewer isolation, process cleanup, and release archives ([e4e6054](https://github.com/mhosseinab/cc-opencode-plugin/commit/e4e6054babdf484ac0586c221dd89b33edeea2dd))
- run source packaging through symlinked checkout paths ([ca8f02d](https://github.com/mhosseinab/cc-opencode-plugin/commit/ca8f02d71715098e3ab9eb1c75d9bccd39c687ed))

## [1.0.1](https://github.com/mhosseinab/cc-opencode-plugin/compare/v1.0.0...v1.0.1) (2026-11-12)

### Bug Fixes

- accept compatible OpenCode updates and simplify setup ([0c60677](https://github.com/mhosseinab/cc-opencode-plugin/commit/0c60677488e3d5b5bb029b5550559070d433410b))

# 1.0.0 (2026-11-12)

### Bug Fixes

- **ci:** restore release automation and unblock checks ([6b80c35](https://github.com/mhosseinab/cc-opencode-plugin/commit/6b80c35c66c3bce9954a2b6fb5ac752143b1b39e))
- **ci:** sync lockfiles with release dependencies ([77a6b5a](https://github.com/mhosseinab/cc-opencode-plugin/commit/77a6b5a23a13de807a449ea9103b232a79701eee))

### Features

- add Claude Code plugin for OpenCode agent delegation ([494024e](https://github.com/mhosseinab/cc-opencode-plugin/commit/494024e4bfca491bb8a884c1c2d917ab649c79fd))
- **ci:** automate plugin releases with semantic-release ([381031f](https://github.com/mhosseinab/cc-opencode-plugin/commit/381031f8f9f7a68ba61ab8401941708ec2b0738b))

# Changelog

## Unreleased

- Semantic-release CI, synchronized version metadata, and marketplace installs pinned to release tags.
- Claude Code plugin marketplace and delegation skill.
- Task/rescue/transfer commands with custom agent, provider/model, and variant selection.
- Restricted normal and adversarial reviews with working-tree or branch targets.
- Explicit job-based continuation, private records, status/result/cancel, deadlines, and workspace locking.
- Direct subagent execution through ephemeral mode promotion.
- Zero runtime dependencies; unit/process tests and a real OpenCode local-provider contract test.
- OpenCode 1.19.4 compatibility gate and Linux/macOS CI configuration.
