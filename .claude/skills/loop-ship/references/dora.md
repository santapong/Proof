# DORA — instrumenting the release you just shipped

Everything in `rollout-strategies.md` and `release-gates.md` is a *practice*; these metrics are how you know the practices are working. DORA (DevOps Research and Assessment) validated them across years of research as the measures that correlate with software delivery performance. They split into two axes that, crucially, **move together rather than trade off** — the same disciplines (small batches, automation, CD, trunk-based flow) improve both:

**Throughput — how fast you deliver:**

- **Deployment frequency** — how often you release to production.
- **Lead time for changes** — commit → running in production.

**Stability — how well it holds:**

- **Change failure rate** — the share of deployments that cause a failure needing remediation (rollback, hotfix, patch).
- **Failed deployment recovery time** — how long to restore service after a failed deployment. DORA's **2024** report renamed this metric; it was framed as **MTTR** in earlier reports and a great deal of tooling still carries the old label. Treat them as the same measurement under two names, and say which name you are using.

| Metric | Axis | What it pressures you to improve |
|---|---|---|
| Deployment frequency | Throughput | Batch size, automation, pipeline speed |
| Lead time for changes | Throughput | CI/CD friction, review/queue latency, branch lifetime |
| Change failure rate | Stability | Test coverage, rollout safety (canary/flags), review quality |
| Failed deployment recovery time (formerly MTTR) | Stability | Rollback automation, observability, on-call readiness |

**The load-bearing insight:** these are a *set*. Chase throughput alone and you ship breakage faster; chase stability alone and you freeze into slow, giant, risky releases. The finding that reframes deployment is that high performers get both at once, because the practices this skill executes — deploy ≠ release, small reversible changes, canary + flags, tested rollback, IaC, CD — raise velocity and stability *together*. Treat the four as one balanced scorecard: use throughput to catch a process gone timid, and stability to catch one gone reckless.

## Core four, watch the fifth

The four keys are not a fixed constant, and a document that treats them as one goes stale quietly. Two live changes as of this shelf's pin:

- The **2025** State of DevOps Report **pilots a fifth metric, Rework Rate**, alongside a **Reliability quasi-metric** that is reported but not treated as a peer of the four. Neither is settled. Instrument the core four as your commitment; carry rework rate as an experiment you are watching, and label it as such in any report so nobody downstream treats a pilot as a ratified key.
- The recovery metric's **rename in 2024** (MTTR → failed deployment recovery time) is not cosmetic: MTTR in general SRE usage means time to recover from *any* incident, while DORA's metric is scoped to *failed deployments specifically*. Instrumenting one and labelling it the other produces a number nobody can act on.

**Name the report year before you quote a tier.** The elite/high/medium/low boundaries move between annual reports — the number of performance clusters has itself changed across editions — so "elite is under one hour" is only a true statement with a year attached to it. The popularly cited shape of the elite band (on-demand deployment, lead time in hours not days, change failure rate in the low tens of percent, recovery in under a day) is fine as a direction of travel, but **do not put a specific boundary in a release report without naming the report edition it came from, and prefer your own trend line over any published tier.** A team improving against itself is measuring something real; a team measuring itself against last year's published band is measuring a stale constant.

## Per-release instrumentation — what loop-ship actually tags

The concept is `loop-design`'s and `loop-audit`'s to reason about. What this skill adds is the tagging, so the release-execution loop is measurable one release at a time rather than as a quarterly aggregate someone assembles by hand.

Every change that goes out through this skill's gate carries a release record with these fields. They are chosen so the four keys are *derivable* from a stack of release records — no separate metrics pipeline:

| Field | Captured at | Derives |
|---|---|---|
| `releaseId`, `artifactDigest` | Pre-deploy gate | Joins every later field to one promotable artifact (the same digest the supply-chain gate verified — see `supply-chain-gate.md`). |
| `commitShas`, `firstCommitAt` | Pre-deploy gate | Lead time for changes, when differenced against `releasedAt`. Use the *first* commit in the batch, not the merge — measuring from the merge hides queue latency, which is the thing lead time is supposed to expose. |
| `deployStartedAt`, `releasedAt` | Deploy and release steps | Deployment frequency (count of `releasedAt` per window), and the deploy≠release gap itself, which is worth watching on its own. |
| `strategy`, `rungSchedule` | Strategy decision | Lets change failure rate be sliced by rollout strategy — the single most useful cut, because it shows whether escalating to canary is actually buying anything. |
| `outcome` ∈ `{completed, rolled-back, rolled-forward, aborted-in-gate}` | Bake complete or abort | Change failure rate. See the counting rule below. |
| `remediationStartedAt`, `restoredAt` | Rollback/roll-forward | Failed deployment recovery time. Recorded by `rollback-playbook.md`'s closing step. |
| `blockingGate` (nullable) | Go/no-go | Not a DORA key, but the highest-value local metric this skill produces: which gate dimension blocks releases most often is a direct read on where the delivery process is weakest. |

**The counting rule, stated once so it is not re-litigated per release.** A release that fails **inside the gate** — caught by the pre-deploy checklist, never promoted — is `aborted-in-gate` and is **not** a change failure. Change failure rate measures deployments that reached production and needed remediation; counting gate catches against it punishes the gate for working and creates a direct incentive to weaken it. A canary that was aborted at 1% **is** a change failure: it reached production and needed remediation, and the fact that the blast radius was small is captured by the strategy field, not by excusing the count.

## Where this feeds, and what it does not duplicate

`loop-audit` already cites change failure rate as part of its own reason to exist — it produces a backward-looking risk memo over a diff and frames "how often do changes like this one fail" as a property of the change set. **This file does not re-derive that framing.** It supplies the per-release records that make the framing measurable: `loop-audit` reasons about risk, this skill records what actually happened, and the second is what keeps the first honest over time.

The recovery-time half of the instrumentation is written by `rollback-playbook.md` at the moment a rollback or roll-forward completes, which is the only point at which `restoredAt` is knowable. If the trigger was a live user-facing outage rather than a gate catch, the incident record belongs to `loop-incident` and this skill's release record simply points at it — do not maintain two timelines of the same event.

Track your own trend against your SLOs (`../../loop-operate/references/slo-model.md`), not last year's published numbers. Editions, tier boundaries, and the status of the piloted fifth metric are pinned in `standards.md`.
