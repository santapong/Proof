# Branch policy

`main` carries releases. `develop` integrates the next release. Work branches are
temporary and have one owner and one purpose. A merge into `develop` does not
publish a release or authorize a merge into `main`.

## Branch names and destinations

| Branch | Start from | PR target | Lifetime |
| --- | --- | --- | --- |
| `main` | Existing release line | `develop` to synchronize a release/hotfix | Permanent |
| `develop` | Existing integration line | `main` for an explicitly requested release | Permanent |
| `feat/<topic>` | `develop` | `develop` | New feature |
| `fix/<topic>` | `develop` | `develop` | Ordinary bug fix |
| `docs/<topic>` | `develop` | `develop` | Documentation |
| `chore/<topic>`, `ci/<topic>`, `build/<topic>` | `develop` | `develop` | Maintenance, CI, packaging |
| `refactor/<topic>`, `perf/<topic>`, `test/<topic>` | `develop` | `develop` | Refactoring, performance, tests |
| `experiment/<topic>` | `develop` | `develop` | Bounded experiment; label unproven results |
| `revert/<topic>` | `develop` | `develop` | Reviewed reversal of an integrated change |
| `release/<major>.<minor>.<patch>` | `develop` | `main` | Optional release preparation |
| `hotfix/<topic>` | `main` | `main` | Urgent fix to the released version |

Topics use lowercase letters, digits, and single hyphens, such as
`feat/ml-context-ranking` or `fix/123-invalid-reference`. Use exactly one slash;
avoid personal prefixes, spaces, underscores, and empty topics. Release names
use three numeric components without leading zeroes, such as `release/3.1.0`.
Create these branches when needed; do not create empty placeholder branches.

Normal flow: `feat/*` → `develop` → `main` → `develop`.
Urgent flow: `hotfix/*` → `main` → `develop`.
The final synchronization preserves release preparation and hotfix commits in
the integration line. Never delete either permanent branch during this flow.

## Start and integrate work

```bash
git fetch origin --prune
git switch -c feat/example origin/develop
# Make and verify the focused change.
git push -u origin feat/example
```

Open a PR with `develop` selected explicitly as the base; GitHub's default branch
can remain `main`. Use a draft while work is incomplete. Record the concrete
change and check results in the PR. Review the current diff before merging.

The `validate` workflow runs the existing repository gates and a `branch-policy`
job. On PRs, that job checks the source name and allowed target. It rejects, for
example, `feat/example` → `main` and `hotfix/example` → `develop`. It also runs the
policy's regression checks on pushes. Run the same checks locally:

```bash
node scripts/test-branch-policy.mjs
node scripts/check-branch-policy.mjs --head feat/example --base develop
```

This check validates names and PR direction. It does not prove the fork point,
release authorization, content quality, or reviews. It blocks merging only when
GitHub requires its status check. Changes to policy/checker/workflows themselves
must be reviewed; contributor-editable CI is not a security boundary.

Prefer merge commits, particularly between permanent branches, so ancestry and
cleanup remain directly verifiable. Never force-push `main` or `develop`. Once
protections are active, integrate through PRs rather than direct target pushes.

## Releases and hotfixes

Release only when requested. Update both plugin manifests and the changelog on
`release/<version>` from `develop`, or prepare them in a normal work PR to
`develop` before a `develop` → `main` release PR. Run `/gate` and strict manifest
validation, then merge the release PR and verify remote `main` and CI. Tag the
verified release commit only when the requested release includes tagging. Open
a `main` → `develop` synchronization PR after release.

For a hotfix, branch from fresh `origin/main`, fix and verify the released
version, then merge to `main` through a PR. Synchronize `main` back to `develop`
before starting the next release. Deleting the hotfix branch after its main PR
merges is safe because `main` preserves it; synchronization is still required.

## Delete merged work branches

After a PR merges, let GitHub delete its temporary head branch. Protect `main`
and `develop` from deletion before enabling this feature, since either can be a
PR head during release or synchronization. GitHub's setting applies to merged
PRs; a local `git merge` followed by `git push` does not trigger it.

After an authorized local Git merge, the integrating agent also cleans up the
temporary branch once the remote target contains it. Fetch first, verify the
remote source tip is an ancestor of the intended remote target, and ensure that
no worktree uses the branch. Refuse deletion if it has moved or has unique work.
For example, after merging `feat/example` to `develop`:

```bash
git fetch origin --prune
git merge-base --is-ancestor origin/feat/example origin/develop
# Continue only if that command succeeds; inspect worktrees before deletion.
git worktree list
git push origin --delete feat/example
git switch develop
git branch -d feat/example
git fetch origin --prune
```

Recheck the remote source tip immediately before deleting; use an exact ref
lease if concurrent pushes are possible. Check local branch ancestry separately
before removing it. Do not use forced local deletion as a shortcut. For a squash
or rebase merge, ancestry can fail despite a completed PR: retain the local
branch until the merged PR and absence of later work are verified. An unmerged
closed PR is not a cleanup candidate. Deleting a branch used in another worktree
requires coordination with its owner.

## GitHub setup

The repository includes an importable
[permanent-branch ruleset](../.github/rulesets/permanent-branches.json). Source
files alone do not change GitHub settings. Apply these steps in the web UI:

1. Integrate this policy into `develop` and wait for `validate` and `branch-policy`
   to pass. Do not enable a required check that has never run.
2. Open [Rulesets](https://github.com/santapong/Proof/settings/rules), choose
   **New ruleset → Import a ruleset**, and import the JSON. Review and activate
   **Proof permanent branches** targeting exactly `main` and `develop`. It blocks
   deletion and force pushes, requires PRs, resolved review conversations, and
   the up-to-date `validate` and `branch-policy` checks. It has no bypass actors.
3. The initial review count is zero so a sole maintainer can merge their own
   PRs after checks. Increase it to one when a second reviewer is available.
   PR descriptions and a deliberate review of the diff are still required.
4. In [General → Pull Requests](https://github.com/santapong/Proof/settings#merge-button-settings),
   enable **Automatically delete head branches**. Keep **Allow merge commits**
   enabled. This is separate from **Allow auto-merge**; it does not authorize
   unattended merging.
5. Reopen both pages to verify the saved settings. On the next actual merged
   work PR, verify its temporary branch disappears and both permanent branches
   remain. Do not describe automatic deletion as tested until that happens.

The workflow containing the new check reaches `main` with the next authorized
release. An older hotfix branch may need the policy/workflow commits first so
its PR can report the required check. Do not bypass the check to release it.

Observed setup before this policy was created, 2026-09-09: GitHub automatic head
deletion was off; no rulesets or classic branch protections were configured.
This is a historical observation, not an assertion about future live settings.

GitHub documents [automatic head-branch deletion](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)
and [ruleset creation/import](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).
