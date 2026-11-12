# Automated releases

`.github/workflows/ci.yml` tests pull requests and pushes. Its `release` job runs only for a push to `main`, after every Linux/macOS Node 22/24 check and Claude manifest validation job succeeds. Release jobs are serialized and are never cancelled midway by a newer push. Release tooling uses Node 24 and pinned npm development dependencies from the lockfile.

## Repository setup

1. Push this repository to GitHub with `main` as its release branch. The workflow reads the actual owner/repository from GitHub's `GITHUB_REPOSITORY`; no account placeholder belongs in the release config.
2. Make sure your repository or organization allows the job's `contents: write` permission. The provided workflow uses GitHub's automatic `GITHUB_TOKEN`, so no npm token or extra secret is needed for an unprotected repository that allows those writes.
3. If rules require pull requests or prohibit bot pushes/tags, the default token cannot bypass them. Use a dedicated GitHub App with a short-lived installation token and an explicitly permitted actor under your rules. Supply that token as `GITHUB_TOKEN` in the release step. Keep protections for human changes; do not assume `contents: write` overrides branch rules.
4. Merge using Conventional Commit messages. With squash merges, set the PR's final squash title/body to the intended Conventional Commit. A breaking change must retain its `BREAKING CHANGE:` footer.
5. Complete an initial manual Claude/provider acceptance run before merging the first releasable change. CI uses a local mock provider rather than real paid model credentials.

## What gets published

The configured plugins analyze commits, generate release notes/changelog, synchronize metadata, build the source archive, commit release metadata to `main`, tag that exact release commit, and publish a GitHub release with its archive attached. No npm publish plugin is configured; the root package remains private.

The prepare hook updates:

- `package.json` and both root version fields in `package-lock.json`.
- `plugins/opencode/.claude-plugin/plugin.json`.
- The `opencode` entry in `.claude-plugin/marketplace.json`.

The marketplace entry becomes a `git-subdir` source pointing to `plugins/opencode` at `v<version>` in the actual GitHub repository. Users can therefore read the catalog from `main` while receiving the tagged plugin rather than later unreleased code. The initial local catalog uses a relative source until the first release.

`@semantic-release/git` commits only the explicit metadata/changelog allowlist using `chore(release): <version> [skip ci]`. The tag and archive carry matching versions. The GitHub plugin's issue/PR comments and release labels are disabled, so the job needs only repository contents write permission. Release archives are attachments for users; Claude installs from the tagged Git source.

## Version rules

| Commit                                                      | Release               |
| ----------------------------------------------------------- | --------------------- |
| `fix: handle cancelled jobs`                                | Patch                 |
| `feat: add another agent option`                            | Minor                 |
| A commit with a `BREAKING CHANGE:` footer                   | Major                 |
| `docs:`, `test:`, `chore:` without a breaking-change footer | No release by default |

With no previous release tag, semantic-release starts at **1.0.0** when it finds a releasable commit. The development `0.1.0` package field does not change that initial version. If you already published a version, tag its actual released commit with its matching `vX.Y.Z` tag before enabling this workflow. Never add a historical version tag to an arbitrary current commit just to influence the next version.

## Install and update

Inside Claude Code, users install and check the plugin with:

```text
/plugin marketplace add mhosseinab/cc-opencode-plugin
/plugin install opencode@cc-opencode
/reload-plugins
/opencode:setup
```

To pick up a subsequent release:

```text
/plugin marketplace update cc-opencode
/plugin update opencode@cc-opencode
/reload-plugins
/opencode:setup
```

A GitHub marketplace is installable without a GitHub Release, but release automation gives versions, tagged source, notes, and an archive. This workflow does not submit the plugin to Anthropic's official directory.

## Preview and recovery

After `npm ci`, run this from a Git checkout with its real GitHub origin and release history:

```bash
GITHUB_REPOSITORY=mhosseinab/cc-opencode-plugin npm run release:dry-run
```

Set `GITHUB_TOKEN` in your environment when the repository/API requires authentication. Dry-run checks authentication and repository access and reports the proposed version/notes, but skips preparation, new release commits/tags, and publication. Do not paste tokens into commands or commits.

After a failed release, inspect whether the release commit, tag, and GitHub Release were already created before retrying. These operations are not an atomic transaction. If the tag exists but publishing its GitHub Release failed, a simple rerun may find no new commits; recover the missing release/asset from that exact tag rather than creating a different version or force-moving a published tag.

The local integration test exercises version preparation, semantic-release dry-run, a metadata commit, a pushed tag, archive creation, and no-op repeat runs against an isolated local bare Git remote. It does not publish to GitHub or prove your repository permissions; the first real release remains an acceptance check.

References: [semantic-release GitHub Actions recipe](https://semantic-release.gitbook.io/semantic-release/recipes/ci-configurations/github-actions), [git release assets](https://github.com/semantic-release/git), [GitHub release plugin](https://github.com/semantic-release/github), [Claude marketplace sources](https://code.claude.com/docs/en/plugins/marketplace-reference).
