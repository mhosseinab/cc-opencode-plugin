# Release checklist

The code and manifests form a release candidate. Passing automated checks is necessary; it does not replace a manual Claude session with your configured provider.

1. Run `npm ci && npm run check` from a clean checkout.
2. Install the tested OpenCode version and run `OPENCODE_LIVE_BIN="$(command -v opencode)" npm test`.
3. Run `claude plugin validate plugins/opencode --strict` and `claude plugin validate . --strict`. Anthropic directory listing checks are a separate profile; an optional listing icon is not included.
4. Start `claude --plugin-dir ./plugins/opencode` in a disposable sample repository. Exercise setup, agents, a real implementation, an independent review, a background run, status/result/cancel, explicit resume, transfer, and a named custom subagent. Confirm diffs and tests. Review an untracked file as well as a branch diff.
5. Confirm OpenCode rejects disallowed operations under your actual config and provider. Confirm Claude does not claim paid-provider authentication was verified by setup alone.
6. Run CI on Linux and macOS. Inspect packaging with `npm run package` and `tar -tzf dist/cc-opencode-plugin-0.1.0.tar.gz`.
7. Choose the actual GitHub owner. Update README install examples if the repository name differs; add repository/homepage fields only once their real URLs exist. Review the MIT license and author metadata.
8. Create/push the GitHub repository, then verify marketplace installation from that repository. Do not publish a tag until the remote CI checks and manual acceptance run pass.
9. Keep root package, plugin manifest, and marketplace entry versions synchronized. Update CHANGELOG.md; tag `v0.1.0` only after acceptance. Attach the archive and describe verified environments and known limits.

CI uses no real credentials. Its live test uses a pinned OpenCode binary and a local mock provider. No release workflow pushes to npm or creates a public release automatically.
