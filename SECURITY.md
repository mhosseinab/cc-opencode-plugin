# Security

This plugin launches a local coding agent. Implementation tasks use the machine's OpenCode configuration, provider integrations, and tool permissions. Claude's permission approval does not sandbox OpenCode or transfer its own rules into OpenCode.

The bridge never adds auto-approval flags. Unknown agent names fail preflight. Noninteractive approval requests are rejected by OpenCode and surfaced as blocked when observable. Existing explicit allow rules still take effect. Treat repository instructions, tool output, and model text as untrusted data.

Reviews use a fresh agent that only permits read/glob/grep, with external directories and selected sensitive-file patterns denied. OpenCode `--pure` disables external plugins during review. This is not an OS sandbox or a complete secret scanner. Provider code and OpenCode itself still execute locally. Do not run untrusted repository configuration on a privileged machine. A subprocess that deliberately escapes its process group is outside cancellation guarantees.

Prompts, diffs, and read/tool content are processed by your chosen model provider. OpenCode retains its own session data. Bridge logs/results can contain sensitive text and are not redacted. They are stored outside the checkout with private POSIX permissions. Keep state on a trusted local filesystem, do not publish logs, and explicitly remove old records when no jobs are active.

Cancellation/deadlines preserve partial file changes. Abrupt runner death can leave orphaned processes and a stale lock. No automatic process signalling is performed using saved PIDs. See [recovery](docs/runtime.md) before removing a stale lock.

For suspected vulnerabilities, avoid posting credentials or exploit details publicly. Until maintainers configure GitHub private vulnerability reporting, contact the repository maintainer privately through a verified channel. Do not assume a security inbox exists.
