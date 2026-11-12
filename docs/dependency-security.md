# Development dependency security

Checked on 2026-11-12. The installed plugin uses Node's standard library and has no runtime npm dependencies. Development and release tooling has a separate npm dependency graph.

## Changes made

- Updated ESLint to the supported 10.14.0 release.
- Pinned the transitive npm CLI to 11.21.2, which bundles the patched Undici 6.29.1 and ip-address 10.7.5 versions. Its Node requirement (`^20.17.0 || >=22.9.0`) preserves this project's Node 22.18+ floor.
- Overrode minimatch to the maintainer-patched 11.0.1 release for the non-bundled dependency graph. This version supports Node 22 and 24; lint and local release tests verify the use made by this project.
- Kept matching effective overrides in `package.json` for npm and `pnpm-workspace.yaml` for pnpm. Generated lockfiles are committed. No audit suppression or package installation-time source rewriting is used.

## Remaining upstream advisories

The npm 11.21.2 package still bundles glob 13.0.6 and minimatch 10.2.5 inside its own `node_modules`. npm does not apply the root overrides inside that bundle. The two remaining unique advisories are:

| Bundled dependency | Advisory                                                                                                                                                        | Maintainer-patched version |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| glob 13.0.6        | [GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4): traversal may continue after cancellation                   | 14.0.2                     |
| minimatch 10.2.5   | [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249): attacker-controlled patterns can amplify CPU and memory use | 11.0.1                     |

The full audit reports these as 35 affected development-package entries through dependency propagation, not 35 independent vulnerabilities. Both unique advisories are moderate. `npm audit --omit=dev` reports zero findings. The remaining findings are visible and are not claimed to be fixed.

The chain is `semantic-release → @semantic-release/npm → npm`. This repository does not configure the npm publication plugin, but the package remains installed as a dependency of semantic-release. No exploit of this project's execution paths was demonstrated; that is not proof that the vulnerable code can never be reached during development.

As checked on the review date, the latest supported npm 11 release is 11.21.2. npm 12.2.2 also declares glob 13/minimatch 10 and raises the Node floor, so switching to it would not solve this issue. Do not blindly downgrade semantic-release or force unsupported major versions just to change audit output.

## Follow-up verification

When npm or semantic-release ships an upstream resolution, update the supported pins, regenerate both lockfiles, run `npm audit` and `npm audit --omit=dev`, and verify lint, the local release integration, and Node 22/24 CI. Remove an override only after the resolved dependency graph contains the patched version without it.

Primary references: [npm 11.21.2 release](https://github.com/npm/cli/releases/tag/v11.21.2), [Undici remediation](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx), and the maintainer advisories linked above.
