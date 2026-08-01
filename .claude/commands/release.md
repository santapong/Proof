---
description: Cut a release from develop to main — version bump, changelog, tag, verify
argument-hint: <version, e.g. 2.0.0>
---
Release $ARGUMENTS from develop to main, following the repo's release procedure:

1. Confirm on `develop`, clean tree, and all three gates green (/gate).
2. Decide the bump is right: new/renamed/removed skill or any breaking identifier
   (server id, tool prefix, URI scheme, env var) = MAJOR; new skill or feature = MINOR;
   fixes only = PATCH. If $ARGUMENTS disagrees with the changelog contents, SAY SO first.
3. CHANGELOG.md: move [Unreleased] content under `## [$ARGUMENTS] — <today>`, leave
   `_Nothing yet._` under [Unreleased].
4. Bump "version" in `.claude-plugin/plugin.json` AND `.claude-plugin/marketplace.json`.
5. Commit on develop, push, merge --no-ff into main with a `Release v$ARGUMENTS: <summary>`
   message, tag `v$ARGUMENTS` (annotated), push main + tag, return to develop.
6. Re-run validate on main before pushing. Report the release line and anything deferred.
