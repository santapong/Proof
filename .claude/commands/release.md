---
description: Cut a release from develop to main — version bump, changelog, tag, verify
argument-hint: <version, e.g. 2.0.0>
---
Release $ARGUMENTS from develop to main, following `docs/branch-policy.md`:

1. Fetch origin, confirm a clean tree, and branch `release/$ARGUMENTS` from current
   `origin/develop`. Run every gate in /gate and `claude plugin validate . --strict`.
2. Decide the bump is right: new/renamed/removed skill or any breaking identifier
   (server id, tool prefix, URI scheme, env var) = MAJOR; new skill or feature = MINOR;
   fixes only = PATCH. If $ARGUMENTS disagrees with the changelog contents, SAY SO first.
3. CHANGELOG.md: move [Unreleased] content under `## [$ARGUMENTS] — <today>`, leave
   `_Nothing yet._` under [Unreleased].
4. Bump "version" in `.claude-plugin/plugin.json` AND `.claude-plugin/marketplace.json`.
5. Commit and push the release branch. Provide the GitHub comparison URL with
   `main` as base for the release PR. Require green `validate` and `branch-policy`
   checks, review the diff, and merge using a merge commit under the active rules.
6. Fetch and verify the merged remote main commit and its CI result. Tag that exact
   release commit `v$ARGUMENTS` (annotated) and push the tag as part of this requested
   release. Never bypass protections or tag an unverified local merge.
7. Synchronize `main` back to `develop` through a PR. Delete the merged release
   branch after verifying its remote integration; preserve both permanent branches.
   Report the release commit/tag, validation, synchronization, and anything deferred.
