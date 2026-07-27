# Expand-contract migrations — sequencing a schema change across a real release

Every rollout strategy in `rollout-strategies.md` runs old and new code simultaneously — mid-roll, during a canary, across a blue-green pair sharing one database. A schema change that the old code can't tolerate breaks the system **during its own deploy**. The rule that makes schema changes safe is **expand-contract (a.k.a. parallel change)** — never change a column in place; evolve in backward-compatible steps:

1. **Expand** — add the new schema additively (new nullable column/table), deployed first. Old code ignores it; nothing breaks.
2. **Migrate + dual-write** — new code writes both old and new shapes and backfills existing rows; both versions keep working.
3. **Contract** — only once no running code reads the old shape, drop it — in a *later* deploy.

The load-bearing rule: **schema changes and the code that depends on them ship in separate deploys**, expand strictly before contract. A rename becomes add-new → write-both → backfill → read-new → drop-old, spread across releases. This is the deployment-time counterpart to the data patterns in `../../loop-design/references/backend.md`; get it wrong and "zero-downtime deploy" becomes "outage during migration."

## Mapping the steps onto a release sequence

The three steps are not three tasks in one release. They are **at least three deploys**, and knowing which deploy carries which step is the whole execution problem. A worked sequence for renaming `user.email` to `user.email_address`:

| Deploy | Carries | Ships | Reversible? |
|---|---|---|---|
| **R1** | Expand | The additive DDL only: add `email_address`, nullable, no code reads it. | Yes — drop an unread nullable column, or simply leave it. |
| **R2** | Dual-write | Application code writes both columns on every mutation; reads still come from `email`. Backfill runs as a separate, resumable, rate-limited job against existing rows. | Yes — revert to R1's code; `email` was never stopped being written. |
| **R3** | Read-switch | Reads move to `email_address`. Writes still hit both. This is the rung that gets a canary: it is the first deploy where a defect produces *wrong data on a read path*. | Yes — flip the read back, either by revert or, better, behind a read-source flag. |
| **R4** | Contract | Drop `email`, and drop the dual-write code. | **No.** Past this deploy, rolling back R3 or R2 restores code that reads a column that no longer exists. |

Three rules fall out of that table and are worth stating separately, because each is a gate check rather than a design note:

- **The backfill is its own artifact, not a migration step.** It is long-running, it must be resumable, and it must be rate-limited against production load. A backfill wedged inside a deploy's migration hook turns a fifteen-second deploy into a two-hour lock. Run it between R2 and R3 and gate R3 on its completion.
- **R3 is the rung that earns a canary.** R1 and R2 are additive and invisible to users; R4 is destructive but by then nothing reads the old shape. R3 is where a bug shows up as user-visible wrong data, which is exactly the profile the Risk → strategy table sends to canary + flags.
- **R4 is a one-way door.** It is the only deploy in the sequence with no rollback, which is why `rollback-playbook.md` states flatly that you cannot roll back past a contract step. Schedule it as its own release with nothing else in it, so a rollback triggered by an unrelated change never has to fight it.

## The contract gate — what makes this file loop-ship's rather than loop-design's

Expand-contract as a *pattern* is design-time knowledge. What belongs here is the check that stops a contract step from shipping early, because early contraction is the failure this whole discipline exists to prevent and no amount of pattern knowledge catches it at 2am.

**Before a contract step may enter the pre-deploy checklist, every consumer must be confirmed off the old shape — confirmed by observation, not by inventory.**

- **Enumerate the consumers.** Not just the service that owns the table: replicas, read-through caches, ETL and analytics jobs, other services with direct database access, and anything holding a compiled query or an ORM model of the old column. The list comes from a grep plus the service catalogue plus whoever has credentials, and it is written down.
- **Prove the reads stopped.** The evidence that satisfies this gate is telemetry — query logs, column-access metrics, or an instrumented read path showing **zero reads of the old shape for a full business cycle**, which means at minimum one complete cycle of your slowest batch job, not one hour. A code search showing no references is *supporting* evidence, never sufficient evidence: it cannot see a dynamically constructed query, a stored view, or a consumer outside the repository.
- **Confirm the deploy floor.** No instance running code that reads the old shape may still be live, and no rollback target within your retention window may reintroduce one. If your rollback policy says "we can revert to any build from the last 14 days," then the read-switch deploy must be at least 14 days old before contract ships — otherwise the rollback path and the migration plan contradict each other, and one of them is a lie.
- **Hold the flag open.** If the read switch was flag-gated, the flag stays in place through contract and is removed *after* — removing the flag and dropping the column in the same release destroys the only cheap way back.

A contract step that cannot produce that evidence is a **hard fail** on the migration dimension of the go/no-go gate, not a warning: see `release-gates.md` §"Pre-deploy checklist", where the expand-step check sits, and `../../loop-design/references/backend.md` for the underlying data patterns.
