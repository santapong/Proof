# The integration train — many task branches, one merge candidate

The pattern for the question "several branches of work are in flight on one project; how
do they reach `develop` and then `main`?" It generalizes the three-tier model
(`feature/* → dev → test → main`) this plugin's users already run, and it names the one
step no other skill owns: **collecting N finished task branches into one gated merge
candidate** before anything touches the integration branch.

## When a train is worth it — and when it is not

A train pays for itself in exactly two situations:

1. **The branches touch overlapping files** — merge order matters, and conflicts should
   be resolved once, on the train, not N times against `develop`.
2. **The full gate is expensive** — DB-backed tests, eval suites, chaos rehearsal. One
   train run replaces N per-branch runs.

If the branches are file-disjoint AND the gate is cheap, skip the train: merge each
branch to `develop` as it finishes, in dependency order. A train for three disjoint
one-file changes is ceremony. (The same read/write logic that governs fan-out governs
this: disjoint work integrates independently; coupled work integrates together —
`loop-context/references/shared-state.md` §When not to fan out.)

## The procedure

1. **Cut the train** from the integration branch's tip:
   `integration/<milestone>` off `develop`.
2. **Merge task branches onto the train in dependency order** — branches that others
   build on first, then consumers. Resolve conflicts ON the train, in the order that
   makes each conflict smallest. Never rebase a shared task branch to "clean up" —
   resolution happens at merge points, where it is recorded.
3. **Run the full gate once, on the train** — the whole release-gate chain
   (`release-gates.md`), including whatever is too expensive per-branch. A train that
   fails the gate is fixed on the train (or a bad wagon is dropped: revert that branch's
   merge commit, note it, continue).
4. **One merge to `develop`** — the train lands as a single reviewed unit whose gate run
   is attached. Delete the train branch; task branches die with their merges.
5. **Promotion is unchanged** — `develop → (test) → main` proceeds per the project's
   existing flow and this skill's gates; the train replaces nothing downstream of
   `develop`, it only disciplines what arrives there.

## Rules that keep trains honest

- **A train is short-lived.** Days, not weeks. A long-lived train is a second `develop`
  with none of its protections — the anti-pattern this file exists to prevent.
- **Nothing lands on a train except merges from task branches and conflict
  resolutions.** New work on the train is work that skipped review.
- **Dependency order is declared before the first merge**, not discovered during. If
  the order is unclear, that is a signal two branches share a decision and should have
  been one branch (write-heavy coupling — see the fan-out caution above).
- **Dropping a wagon is always available.** Revert-of-merge on the train is cheap
  precisely because nothing downstream has seen the train yet. That option expires the
  moment the train merges — which is the argument for the train.
- **The gate binds the train, not the wagons.** Per-branch fast checks still run on the
  task branches (that is CI hygiene, not the train's job); the train's job is the one
  expensive, whole-set gate.

## Worked shape

```
develop ──┬────────────────────────────────────────────▶ merge train ──▶ (test) ──▶ main
          └─ integration/m2 ◀─ feature/a ◀─ feature/b ◀─ fix/c
                       full gate runs HERE, once
```

Where the tasks were produced by parallel agent sessions (worktree-isolated branches,
`claude/*` or `feature/*`), the train is also where the **decision-record reconcile**
happens: parallel workers made independent implicit choices
(`loop-context/references/shared-state.md` Clause 4), and the train's conflict-and-gate
pass is the single place those choices are forced to cohere before integration.
