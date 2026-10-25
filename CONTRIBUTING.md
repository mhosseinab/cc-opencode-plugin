# Contributing

Use Node.js 22.18 or later. Install development dependencies with `npm ci`; run `npm run check` before submitting changes. Keep runtime dependencies at zero and avoid generated build artifacts in the installed plugin.

Add meaningful regression coverage for behavior changes, especially subprocess lifecycles, permission boundaries, explicit job/session mapping, malformed events, concurrency, and output limits. For OpenCode contract changes, run the real-binary local-provider test and update compatibility documentation. Do not use paid model credentials in automated tests.

Use argument arrays and stdin for subprocess data. Never interpolate prompts, refs, or agent names into shell commands. Validate the complete request before mutation. Keep errors actionable and distinguish successful runtime completion from verified code correctness.

Keep user-facing commands thin: runtime code enforces rules, while Claude owns task context and independent verification. Do not introduce automatic approval, provider fallback, state cleanup, pushes, or releases as hidden side effects. Keep patches focused and document any version/behavior compatibility change.

When filing a bug, include OS, Node/OpenCode/Claude versions, the command, the terminal job state, and a minimal reproduction. Scrub prompts, paths, credentials, and raw logs before sharing.
