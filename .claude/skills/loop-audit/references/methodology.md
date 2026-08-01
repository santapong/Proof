# Change-Audit Methodology

The full procedure behind the `loop-audit` skill: turn a set of changes — a working tree, a commit range, a PR, or a release span — into a risk-ranked audit through precise scoping, per-change classification, blast-radius tracing, a risk-factor pass, and a coverage assessment. The orchestration shape (parallel tracing, adversarial risk verification) is governed by the `loop-engine` skill's harness and loop policies. Read this before any non-trivial audit.

An audit is not a code review. A review asks "is this code correct?"; an audit asks "what could this change break, how far does it reach, and is that reach tested?" You inventory and rank risk across the whole change set — you do not need to prove a bug to flag a change as high-risk, only to show it touches something dangerous or far-reaching.

## Step 1 — Establish the change set precisely

**You cannot audit what you have not bounded — pin the exact set of changes before reading a single hunk.** An audit against the wrong base is worse than none: it silently omits changes or invents them.

Pick the boundary that matches the ask, then materialize it:

| Ask | Boundary | Command |
|---|---|---|
| "audit my changes" | working tree vs base | `git diff --stat` then `git diff <base>` |
| "audit this branch / PR" | merge base → head | `git merge-base main HEAD`, then `git diff <mergeBase>..HEAD` |
| "audit this release" | tag → tag | `git diff <prevTag>..<newTag> --stat` |
| "audit commit X" | single commit | `git show <sha>` |

Start with `--stat` for the shape — how many files, how big, where the churn concentrates — then the full diff for content. For a PR, reconcile the diff against the PR's file list so a force-push or a stale base doesn't leave you auditing the wrong revision. Record the base and head SHAs in the report; a reader must be able to reproduce the exact set you judged. Note deleted and renamed files explicitly — `git diff -M` surfaces renames — because a rename that changes a public path is a breaking change hiding as a move.

## Step 2 — Classify each change and flag what breaks

**Every changed hunk gets one classification, and any semver-breaking change is flagged loudly regardless of how small the diff is.** A one-line default change can break every caller; diff size is not risk size.

Classify each logical change into exactly one bucket: `feature`, `fix`, `refactor`, `breaking`, `docs`, `chore`. Refactor means behavior-preserving by intent — if you cannot convince yourself behavior is preserved, it is not a refactor, it is an unlabeled feature or fix and should be traced as one.

Then run the semver-breaking filter over the change set. Flag as **breaking** any of:

- **Removed or renamed public API** — an exported function, class, method, endpoint, CLI flag, or env var that external callers depend on, deleted or renamed.
- **Changed signature** — added required parameter, reordered or removed parameters, narrowed accepted types, changed return type or shape.
- **Changed default** — a config default, feature-flag default, timeout, retry count, or behavioral default flipped. Callers who relied on the old default get new behavior silently.
- **Data or schema migration** — a DB migration, serialization-format change, wire-protocol change, or on-disk format change. These are breaking *and* often irreversible (see Step 4).

"Public" is relative to the module's contract: for a library it is the exported surface; for a service it is its API and events; for an internal module it is whatever other modules import. Judge against the actual dependents (Step 3), not a guess.

## Step 3 — Blast-radius tracing

**For every changed symbol, trace who depends on it; the audit's headline is local-vs-far-reaching, and you establish that by finding callers, not by eyeballing the diff.** A three-line change to a leaf utility called in two hundred places is a bigger event than a hundred-line change to a script nobody imports.

For each changed symbol (function, type, constant, config key, table, endpoint), trace outward:

- **Callers / dependents** — grep the repo for every reference to the symbol. Count and locate them. For an exported symbol, note that dependents may live outside this repo (downstream consumers) and say so.
- **Public surface** — is this symbol reachable from an API, CLI, event, or exported module? If yes, its blast radius crosses the repo boundary.
- **Config touchpoints** — does the change read or write a config key, env var, or feature flag? Trace every read site; a changed default reaches all of them.
- **Data touchpoints** — does it touch a schema, migration, cache key, serialized format, or persisted file? Data changes reach every producer and consumer, past and future, including data already written.

Then classify each change as **local** (blast radius contained within the changed file or module, few internal callers, no public/data surface) or **far-reaching** (many dependents, crosses the public/API/data boundary, or touches shared state). Far-reaching changes are the ones that carry the report. State the radius concretely — "17 call sites across 6 modules, 2 of them public endpoints" — not "widely used".

## Step 4 — Risk-factor checklist

**Run this checklist over every change; a change matching any factor is elevated even if the code looks correct, because the audit ranks exposure, not just defects.** Correctness is Step 5's and the reviewer's job. The audit's job is to say where a mistake would hurt most.

Score each change against these factors and tally which it hits:

- **Breaking API** — anything flagged in Step 2. Downstream fallout.
- **DB / schema migration** — new columns, dropped columns, type changes, index changes, backfills. Ordering and rollback matter.
- **Irreversible / destructive ops** — deletes, drops, truncates, overwrites, one-way migrations, sends (emails, payments, webhooks). Cannot be undone by revert.
- **Concurrency** — new threads, async, locks, shared mutable state, transactions, ordering assumptions. Bugs here are non-deterministic and escape tests.
- **Security-sensitive code** — auth, authz, crypto, secrets, input parsing, deserialization, file paths, SQL. Cross-reference the `loop-review` skill for a deep security pass; the audit only flags that this change lives in that zone.
- **Wide blast radius** — the far-reaching verdict from Step 3.
- **Low test coverage** — the changed behavior is thinly tested or untested (Step 5).
- **Large diff** — big enough that review fidelity drops and a subtle change can hide in the noise.

A change hitting several factors — a large diff that migrates a schema irreversibly and is thinly tested — is a top-of-report item. A `docs` change hitting none is a footnote. The output is a risk-ranked list, most-exposed first, each item naming the factors it hit and its blast radius. When an audit runs as a workflow, verify the high-risk flags adversarially: a skeptic per flagged change, prompted to argue the change is actually safe, defaulting to "risk stands" if it cannot (harness policy H4). This kills the "looks scary, is inert" false positives that erode trust in the ranking.

## Step 5 — Coverage assessment

**Map each changed behavior to the tests that exercise it; an untested change to a far-reaching or destructive symbol is the audit's highest-value finding.** Risk you cannot catch in CI is risk that ships.

For each changed behavior, ask which tests reach it:

- Find tests that import or drive the changed symbol — grep test files for the symbol and its callers.
- Distinguish "a test file was touched in this diff" from "the changed behavior is asserted". A diff that edits code and its tests together still needs the *new* behavior asserted, not just the old test kept passing.
- Flag changed behaviors with **no** exercising test, and weight that flag by the Step 3 radius and Step 4 factors — an untested one-line default flip that fans out to 200 call sites outranks an untested typo fix.
- Note coverage you cannot determine from reading (e.g. integration or manual coverage) as an explicit gap rather than assuming either way.

Coverage feeds back into the Step 4 ranking: "low test coverage" is only meaningful once you have actually looked for the tests.

## Worked mini-example

A one-file diff in a payments library:

```diff
--- a/billing/refund.py
+++ b/billing/refund.py
@@ def issue_refund(charge_id, amount, reason):
-def issue_refund(charge_id, amount, reason):
-    return gateway.refund(charge_id, amount)
+def issue_refund(charge_id, amount=None, reason=None):
+    if amount is None:
+        amount = gateway.get_charge(charge_id).total   # full refund by default
+    return gateway.refund(charge_id, amount)
```

- **Step 1 — change set**: one file, `billing/refund.py`, `git diff --stat` shows +4/-1. Small diff.
- **Step 2 — classify + breaking**: labelled by the author as a `feature` (optional-amount convenience). But the signature changed — `amount` went from required to optional with a new default behavior — so it is **breaking**. A caller that previously passed a partial `amount` is unaffected, but a caller relying on the old "amount required" contract, or any wrapper that introspects arity, is now inconsistent. Flag it.
- **Step 3 — blast radius**: grep for `issue_refund` → 11 call sites across 4 modules, plus one exposed as a `POST /refunds` handler. The default path (`amount is None`) issues a **full** refund. So this crosses the public/API boundary → **far-reaching**.
- **Step 4 — risk factors**: hits **breaking API** (signature + default), **irreversible/destructive op** (a refund sends money and cannot be undone by a code revert), **security-sensitive** (money movement), and **wide blast radius**. Four factors, one of them irreversible money movement → **top of the report**.
- **Step 5 — coverage**: grep tests for `issue_refund` → the existing test only asserts the two-arg partial-refund path. The new `amount is None` full-refund branch has **no test**. Untested + irreversible + public → the single highest-value finding: "a mistyped call now silently issues a full refund, exercised by no test."

The diff is four lines. The audit finding is a shippable, untested, irreversible full-refund path reachable from a public endpoint. Diff size told you nothing; the trace and the risk pass told you everything.

## The blast-radius underestimation catalogue — change shapes that read smaller than they are

**Certain change shapes are systematically under-rated, and the miss is always the same: the reviewer rates the diff they can see, while the blast radius lives in readers the diff never shows.** Steps 3–4 tell you how to trace and rate; this catalogue names the shapes where the trace gets skipped because the diff looks harmless. Each entry carries a **floor** — the minimum Step 4 rating the change holds, on the report's fixed Low/Medium/High/Critical scale (`report-template.md`), until its tracing move has been *completed* and shows otherwise. Floors are rebuttable by a finished trace, never by intuition — except where a row says the floor holds regardless — and Step 4's factors can raise a change above its floor but nothing lowers it below one. This is Step 2's "diff size is not risk size" made mechanical for the shapes where reviewers get it wrong most.

| Change shape | Why reviewers under-rate it | The tracing move that surfaces the real radius | Floor |
|---|---|---|---|
| **Config / flag change** | One line, no code path visibly changes, review takes seconds — and the diff shows the writer of the value, never its readers. | Step 3's config-touchpoint trace, run to completion: every read site of the key, plus every environment and overlay where the effective value differs — a flipped default behaves differently per environment, and the diff shows none of them. | **Medium**; **High** when the flag gates destructive, security-sensitive, or money-moving behavior (Step 4's irreversible and security factors). |
| **Dependency bump** | The diff is a version string. The real change — the transitive graph — lives in a lockfile diff nobody reads, in code nobody in the room wrote. | Read the lockfile diff, not just the manifest: list transitive additions, removals, and major bumps; read the changelog of every direct bump; grep the repo for the APIs the release notes call changed. An unread lockfile diff is untraced radius, not absent radius. | **Medium**; **High** for a major-version bump of anything on the serving path, or whenever the lockfile diff went unread. |
| **Schema migration** | Reviewed as DDL — "adds a column" — while the radius is every reader of the table, and rollback is asymmetric: code reverts in seconds, data written under the new schema does not. | Enumerate every reader of the touched columns — queries, ORM models, ETL, reports, other services sharing the database — then write the rollback story down explicitly: if the reverse migration loses rows written in the interim, the report says so (Step 4's irreversibility factor). | **High**. A destructive or backfilling migration does not drop below High on any trace; Step 2 already flags it breaking. |
| **Shared-utility edit** | The helper's name promises one behavior, but each of its call sites encodes its own assumptions — null handling, rounding, timezone, error type — that the helper's tests never wrote down. Fixing the helper for one caller breaks the callers relying on the old behavior, bug included. | Step 3's caller trace, but *per call site*: for each caller, name which behavior of the old helper it depends on. Sampling a few callers and extrapolating is exactly how this miss happens — the radius is the assumptions, not the call count. | **Medium**; **High** when the edit changes semantics (return shape, edge-case behavior, error contract) rather than adding a parameter that defaults to the old behavior. |
| **Serialization / contract change** | The reviewer checks the code compiles against itself. But the wire crosses time: old readers receive new data during rollout, and new readers receive old data — from queues, caches, retries, and persisted blobs — long after. Half the compatibility matrix is never in the diff. | Fill the 2×2 explicitly: old-reader/new-data and new-reader/old-data, naming where each mixed pairing actually occurs (rolling deploy, replayed queue, cache entry, blob on disk). Persisted formats keep the mixed cells live forever, not just during the rollout window. | **High** until both mixed cells are shown compatible; Step 2 already classifies the change breaking. |
| **Deletion of "dead" code** | Liveness gets judged by grep, but reflection, config-driven dispatch, string-built imports, scheduled jobs, and external callers make liveness undecidable from the repo alone. Absence of references is absence of evidence. | Beyond grep: search for the symbol *as a string*; check config and dispatch tables, route registries, cron and job definitions; for anything exported, state that external callers cannot be ruled out from the repo (Step 3 already demands this for exports). Runtime evidence — access logs, deprecation telemetry, a tombstone period — is the only trace that lowers this floor. | **Medium**; **High** for exported or endpoint-shaped symbols deleted with no runtime evidence of deadness. |
| **CI / build-script change** | It touches no product code, so it reads as `chore` and gets waved through — and its failure mode is invisible until the next release, when the person debugging it is not the person who made it. | Trace to the artifact: which pipelines execute this script, and what artifact, signing, publish, or rollback steps sit downstream of the changed lines. Then run the changed path once before merge, not for the first time at release. | **Medium**; **High** when it touches signing, publishing, or the release/rollback path itself — a broken rollback pipeline converts every future incident into a worse one. |

The second column is the argument: none of these shapes is under-rated because the reviewer is careless. Each is under-rated because the diff genuinely does not contain the radius — the readers, the transitive graph, the already-written data, the callers' private assumptions, the other half of the compatibility matrix, the reflective dispatch, the next release. The floor exists because "looks small" is the one heuristic guaranteed to fail on exactly these shapes, and the cost of a floored rating is a completed trace, while the cost of the miss is Step 4's worst rows shipping unranked.

### The worst-plausible-reader rule

Every shape above fails the same way: the reviewer rates the change against its **intended** reader — the one call site being fixed, the current deploy, the config value production holds today — while the blast radius is defined by the **worst plausible** reader: the caller relying on the old edge case, the consumer replaying last week's queue, the environment with a different overlay, the release pipeline run during an outage. So the closing rule of every blast-radius trace: **rate risk by the worst plausible reader of the change, not the intended one.** A floor is that rule made mechanical — it stands until the tracing move has shown the worst reader does not exist, and it never falls because nobody thought of them.

## Depth control

- **Small change set (a few files, no public/data surface)** — run Steps 1–5 inline in this session; do not spin up agents to audit a two-file diff.
- **Large or release-scale audit (big PR, many files, tag-to-tag span)** — run it as a workflow: fan out blast-radius tracing per changed symbol in parallel (barrier only where a later step truly needs all traces — harness policy H2), then an adversarial risk-verification pass (H4), then a ranked synthesis. Handle the empty change set and the untraceable symbol as explicit nulls, not crashes (H5). If new dependents keep surfacing as you trace, loop the trace until two consecutive rounds add no new touchpoints (loop-until-dry, loop policy L1) rather than stopping at a fixed count. Invoke the `loop-engine` skill to author and run it, following the skill's own `templates/change-audit.workflow.js` (a specialization of the `loop-engine` skill's `templates/parallel.workflow.js`).
