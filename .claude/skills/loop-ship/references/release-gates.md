# Release gates — the go/no-go procedure

This is the procedure for one specific, already-designed change. It assumes the mechanics are known — what a canary is, how blue-green rolls back, what expand-contract means — and does not re-explain them; `rollout-strategies.md` and `migrations.md` hold those. What this file adds is the part that only exists at ship time: **the checklist that decides whether this build may start, the tree that picks its strategy, the pipeline read as a chain of gates, the burn-rate rule that promotes or aborts it rung by rung, and the sign-off that records the call.**

The governing principle across all of it: **a gate passes on evidence, not on assertion.** Every dimension below names what counts as evidence, because "we can roll back" and "we tested the rollback on 12 June and it took 4m20s" are different claims and only one of them is a gate result.

## 1. The pre-deploy checklist

Six dimensions. The verdict is an **AND** — all six pass or the release does not start — and a hard fail on any one of them vetoes regardless of how clean the other five look. Run them in this order; the cheap ones fail fast.

| # | Dimension | Passes when | Evidence that satisfies it | Hard fail? |
|---|---|---|---|---|
| 1 | **Tests green** | The full suite passed on **this exact artifact**, not on a rebuild of the same commit. | A CI run id bound to the artifact digest. A green badge on the branch is not evidence that this build passed. | Yes |
| 2 | **Migration expand-step verified** | Either the release carries no schema change, or the expand step is already deployed and the sequencing in `migrations.md` holds. A contract step additionally has the zero-reads evidence. | The prior release record showing the expand deploy, plus — for a contract step — telemetry showing zero reads of the old shape across a full business cycle. | Yes |
| 3 | **Flag wiring confirmed** | The flags this change depends on exist in every environment, default to the safe value, and **flip, ramp, and kill have each been exercised** on this build. | A recorded toggle of each lever against the deployed-dark build, not a screenshot of the flag console. | Yes |
| 4 | **Rollback path has evidence** | The revert mechanism for the chosen strategy has been exercised, with a measured duration, and the release's expand-contract stage does not forbid it. | A drill record with a date and an elapsed time (`rollback-playbook.md`). An untested rollback is a **failed** gate, not a passed one. | Yes |
| 5 | **Supply-chain gate passed** | Provenance verified against this artifact's hash, SBOM current and diffed, signature valid. | The gate's own pass/fail output — see `supply-chain-gate.md`, which also defines which of its sub-failures are advisory rather than blocking. | Mixed — see that file |
| 6 | **SLO headroom** | There is enough unspent error budget to absorb a bad rung. A service already burning its budget has no room to run an experiment on users. | Current error-budget consumption against the targets in `../../loop-operate/references/slo-model.md`. | No — but a release into an exhausted budget is a **go-with-conditions** at best, and needs a named accepter |

Two rules about the checklist itself. **A dimension that cannot be evaluated is a fail, not a skip** — "the flag console is down so we couldn't check" resolves to no-go. And **the checklist is run against the artifact, once**; if the artifact is rebuilt for any reason, every dimension is re-run, because a rebuilt artifact is an untested artifact.

## 2. Choosing the strategy for this change

Do not open the strategy menu. Start from the risk rating `loop-audit` produced for this change set, and walk the tree — it lands on a row of the Risk → strategy table in `rollout-strategies.md`, which supplies the mechanics.

1. **Does the release contain a genuinely irreversible or data-destructive step** — a contract migration, a destructive backfill, an outbound side effect that cannot be recalled? → **Canary behind a flag, plus expand-contract, plus a tested restore.** Stop here; this row outranks the audit rating, because irreversibility is a property of the change, not an opinion about it.
2. **Did `loop-audit` rate the change high or critical**, or is it in code that production traffic is the only honest test of? → **Canary + feature flags.**
3. **Does the release need an instant, clean rollback**, or must it not show mixed versions (a protocol bump, a bundle/API pair that must move together)? → **Blue-green.**
4. **Is this a dev or internal tool with an agreed maintenance window?** → **Recreate.** Simplicity wins when downtime is free.
5. **Otherwise** → **Rolling.** This is the default and most releases end here.

Three inputs override the tree in one direction only — **toward more caution, never less**:

- **Low traffic volume vetoes canary.** A service that cannot accumulate a statistically meaningful signal at 1% within the rung's bake window gets blue-green instead. A canary you cannot read is a slow rolling deploy wearing a costume.
- **No usable SLI vetoes canary.** The abort criterion needs a signal; if `../../loop-operate/references/slo-model.md` has no SLO for the affected path, you do not have an automated abort, and you should not pretend to.
- **A prior release of the same subsystem that rolled back** escalates one row. The audit rating is a prior; a recent failure is evidence.

If the tree and the audit rating disagree, the tree's more cautious answer wins and the disagreement goes in the sign-off record.

## 3. The pipeline is the gate chain

The pipeline is **the only path to production** — if prod can be changed any other way, every guarantee in this file is a suggestion. It is not a build system that happens to deploy; it is the checklist in §1 made mechanical, which is why it lands in this file rather than with the rollout mechanics.

1. **CI on every push/PR** — build once, then lint, unit + integration tests, security/dependency scan, and the bundle/size budget (see `../../loop-design/references/frontend.md`). Fail early: run the fast, cheap checks first so a lint error doesn't wait behind a 20-minute test suite. This stage produces dimension 1's evidence.
2. **Build the artifact once, promote it unchanged** — the exact image/bundle that passed CI is what deploys to every environment. Never rebuild per environment; a rebuilt artifact is an untested artifact. Configuration comes from the environment, not from a rebuild (12-factor; see `../../loop-design/references/backend.md`). This is also what makes the artifact digest a usable join key for every gate dimension and every release record in `dora.md`.
3. **CD through environments** — promote the one artifact staging → prod, applying the strategy chosen in §2 at the prod step. Gate prod on whatever your risk tolerance requires — automated checks alone for high-trust teams, an approval for regulated ones.
4. **The rollback path is tested, not assumed.** A rollback you have never exercised is a hope. Automate "redeploy previous artifact" / "flip traffic back" / "toggle the kill switch," and know your restore procedure works *before* the incident. This stage produces dimension 4's evidence, and it is the stage teams skip.

Favor **trunk-based development with short-lived branches** so integration happens continuously and the pipeline stays green and deployable; release flags are what let you merge to trunk before a feature is user-ready. Long-lived feature branches defeat CI by deferring the integration pain to a big, risky merge — and when a release-gate finding traces back to a branch that lived for weeks, that is the finding, not the merge conflict it surfaced as.

**Gate ordering is a cost decision.** Put a gate as early in the chain as it can meaningfully run: the supply-chain gate belongs at the promote step where there is exactly one artifact to check, not in CI where it would run on every push; the migration check belongs before the deploy starts, not after the DDL has applied.

## 4. SLO-gated promotion

A rung advances on **burn rate**, never on elapsed time alone. Burn rate is how fast the canary is consuming error budget relative to the uniform rate that would exactly exhaust it over the SLO window — burn rate 1 means on-pace, burn rate 14.4 means a 30-day budget gone in about two days. The targets and the SLI definitions are **not this file's**; they live in `../../loop-operate/references/slo-model.md`, and the multi-window alerting machinery that computes them is in `../../loop-operate/references/alerting.md`. This file owns only what to *do* with the number.

A default ramp, to be tuned per service rather than copied blindly:

| Rung | Exposure | Minimum bake | Abort if | Hold if | Promote when |
|---|---|---|---|---|---|
| 1 | 1% | until the minimum-sample rule below is met, then 15 min | burn rate ≥ 14.4 on the fast window | burn rate ≥ 6 | fast and slow windows both under 6 |
| 2 | 5% | 30 min | burn rate ≥ 14.4 | burn rate ≥ 6 | both windows under 6 |
| 3 | 25% | 1 h | burn rate ≥ 6 | burn rate ≥ 3 | both windows under 3 |
| 4 | 50% | 2 h | burn rate ≥ 6 | burn rate ≥ 3 | both windows under 3 |
| 5 | 100% (bake) | one full traffic cycle, minimum 24 h | burn rate ≥ 3 | burn rate ≥ 2 | bake completes → hand to `loop-operate` |

Thresholds tighten as exposure rises, because the same burn rate at 50% is doing ten times the damage it was at 5%.

**The minimum-sample rule.** A burn rate computed on a handful of canary requests is noise. Do not evaluate a rung until the canary slice has served enough requests for the observed error rate to distinguish the abort threshold from the SLO at a confidence you have written down — as a rule of thumb, enough traffic that a *single* error would not by itself cross the threshold. A service that cannot reach that volume at 1% within the bake window should not be on a canary (§2).

**Hold means hold.** A held rung does not advance and does not roll back; it waits for the window to clear or for a human. Cap the number of consecutive holds — two is a reasonable default — and treat the third as an abort. A canary that holds indefinitely has silently become a two-version production service, which is `loop-operate`'s problem and not a rollout at all.

**Auto-abort versus page.** Auto-abort when the revert is cheap, bounded, and provably tested — a traffic shift or a flag kill, the whole class of actions `rollback-playbook.md` records a drill for. **Page instead of auto-aborting when the revert is itself risky**: mid-migration, when the abort would strand dual-written data, or when the abort path has no current drill record. Never auto-abort into an untested rollback; that turns one failure into two.

**Override authority.** Exactly one named role may override a hold or a threshold, the override is recorded with a reason at the time it is taken, and **an override may never skip a rung** — it may only shorten a bake. Skipping rungs discards the bounded-blast-radius property that was the entire reason to run a canary.

## 5. Sign-off

The go/no-go call is owned by a **single named human or a single named automated policy**, never by a room. A committee that approves is a committee that cannot be asked afterwards why.

What must be recorded, at the moment of the call, for every release:

- The **verdict** — go / no-go / go-with-conditions — and, if not a clean go, the specific gate dimension that blocked and the condition attached.
- The **strategy chosen** and which branch of §2's tree produced it, including any disagreement with `loop-audit`'s rating.
- The **evidence pointers** for dimensions 4 and 5 — the rollback drill record and the supply-chain gate output — because those are the two that get asserted rather than evidenced under time pressure.
- The **override log**, if any rung was overridden during promotion.
- Who **accepted the risk** on any advisory failure shipped with a tracked exception (`supply-chain-gate.md`).

When the strategy choice was itself high-stakes — an escalation past rolling, an irreversible step, a first canary for a service — record it as an ADR using `../../loop-design/templates/adr-template.md`: the strategy chosen, the risk that justified escalating, and the rollback path committed to. The ADR is the design-time artifact; the release record in `dora.md` is the execution-time one. Keep both, and keep them pointing at each other.
