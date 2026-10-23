# Proof repository working rules

- Read [the branch policy](docs/branch-policy.md) before creating, merging, pushing,
  releasing, or deleting branches. Use plain `git`; do not use `gh`.
- Start ordinary work from freshly fetched `origin/develop` on a named temporary
  branch. `main` is the release line; `develop` is the integration line.
- Keep changes focused and run the relevant checks in `CONTRIBUTING.md`.
- Use pull requests for integration once the documented GitHub protections are
  active. Do not bypass protection or treat a requested develop merge as a release.
- After an authorized merge, verify that the intended commits reached the remote
  target, then delete that merged temporary branch remotely and locally. Verify
  ancestry for Git merges; for squash/rebase merges require the merged PR record.
  Preserve branches with unmerged work, branches used by another worktree, `main`,
  and `develop`. Fetch with pruning after cleanup and report what was deleted.
- GitHub settings and PR creation follow the user's web-step working agreement.
  A checked-in ruleset file does not prove that GitHub protections are active.
