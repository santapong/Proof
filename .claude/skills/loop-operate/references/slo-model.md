# The SLO model — the one number everything else reads

This file produces the number the rest of this skill consumes. `alerting.md` derives its thresholds from it, `on-call-triage.md` derives severity from it, `autonomy-and-rollback.md` gates the SCALE rung on it, and `../../loop-ship/references/release-gates.md` §4 evaluates every canary rung against it. Get this wrong and every downstream file is precisely wrong.

**What this file is not.** Design-time target *setting* — the requirements-intake table, availability math and the nines table, RTO/RPO, the scalability axis, cost, and build-vs-buy — lives in `../../loop-design/references/nfr.md` and is not restated here. The seam between the two files is checkable: **if answering the question requires reading a live metric, it is this file's; if it can be answered on a whiteboard before the service exists, it is `nfr.md`'s.** "How many nines can I afford?" is a design question. "Are we holding three nines this month, and how fast are we spending what's left?" is this one.

## 1. Choosing the SLI

An **SLI** is a measured ratio of *good events* to *valid events*, expressed as a percentage. Not a gauge, not an average — a ratio, because a ratio is what an error budget can be subtracted from. `good / valid` also forces you to define both halves explicitly, and most bad SLIs are bad because nobody defined "valid."

Four families cover nearly every service. Pick the one users actually feel; do not instrument all four and call it coverage.

| SLI family | The ratio | Reach for it when | The definitional trap |
|---|---|---|---|
| **Availability** | successful responses / valid requests | Request-driven services: APIs, web front ends, RPC backends | Which status codes are "good"? A 400 caused by the client is usually *valid but not our fault* — decide, write it down, and be consistent. A 429 you emitted under load almost certainly counts against you. |
| **Latency** | requests served faster than *T* / valid requests | Any interactive path where slow is indistinguishable from broken | This is a **threshold ratio, not a percentile of a percentile**. "p99 under 300ms" is a measurement; "99% of requests under 300ms over 28 days" is an SLI. Averaging percentiles across windows is arithmetically meaningless. |
| **Quality / correctness** | responses served at full fidelity / valid requests | Services that degrade rather than fail — a recommender falling back to a static list, a search returning a cached result set | Degraded responses are 200s. If the SLI only counts status codes, a fully-degraded service scores 100%. |
| **Freshness / throughput** | records processed within *T* of arrival / records | Pipelines, batch jobs, replication, event consumers | There is no request to count. Define the unit (record, partition, batch) and the staleness clock before instrumenting, or you will measure lag against the wrong reference. |

**Measure where the user feels it.** The load balancer, the API gateway, the CDN edge, or the client itself — not deep inside the service, where the numbers are always better because everything that failed before reaching you is invisible. A backend that reports 99.99% while the edge reports 99.5% is not disagreeing with the edge; it is failing to measure the half of the failures that never arrived. Client-side measurement is the most honest and the most expensive; edge measurement is the usual right answer.

**One SLI per critical user journey, not per service.** A journey ("check out", "search", "publish") is what a user notices. A microservice is not. Ten services on the checkout path share one checkout SLO; that is what makes it possible to say whether checkout is broken.

## 2. Setting the SLO target

An **SLO** is a target for an SLI over a rolling compliance window: *99.9% of valid requests succeed over 28 days*. Three rules govern the number, and they are all about resisting the pull toward a rounder, higher figure.

1. **Set it from user expectation and historical performance, not aspiration.** Measure the SLI for two to four weeks first. If the service has been running at 99.7% and nobody has complained, 99.9% is a defensible target and 99.99% is a fantasy that will be permanently in breach — at which point the whole apparatus gets ignored, which is worse than not having it.
2. **Set it below 100%, deliberately.** 100% is unattainable, infinitely expensive, and — the point people miss — it removes the room you need to ship. The gap between the SLO and 100% *is* the budget.
3. **The internal SLO is stricter than any external SLA.** An **SLA** is a contractual promise with financial consequences. Set the internal objective tighter so you burn your own budget and page yourself *before* you breach a customer's contract. If the SLA says 99.9%, the SLO is 99.95%, and the gap is your warning track.

**A 28-day rolling window is the sane default.** It is long enough to smooth a bad afternoon, short enough to still be about the present, and — unlike a calendar month — it does not reset your obligations on the first of the month or vary in length. Rolling windows make the budget continuously meaningful; calendar windows create an end-of-month cliff and a start-of-month amnesty.

**Choose the target per journey, and tier them.** The checkout path and the internal admin dashboard do not deserve the same number, and pretending they do means either over-paying for the dashboard or under-protecting checkout.

## 3. Error-budget arithmetic and burn rate

The **error budget** is `1 − SLO`, expressed over the compliance window. It is a quantity of permitted failure that you are *entitled to spend* — on releases, risky migrations, chaos experiments, load tests — and it converts "how much can we break things to move fast?" from a turf war into arithmetic.

At a 99.9% SLO over 28 days:

- Budget = 0.1% of 28 days = **40.3 minutes** of total failure, or 0.1% of all valid requests, depending on whether you are counting time or events. **Count events unless you have a reason not to** — time-based budgets over-weight low-traffic hours, when a total outage costs almost nothing but consumes budget at the same rate as a peak-hour one.

**Burn rate** is the budget-consumption rate normalized so that **1.0 means "exactly on pace to exhaust the budget at the end of the window."** It is the single most useful derived number in this file, because it is dimensionless and comparable across services with different SLOs.

```
burn rate = observed bad-event ratio / (1 − SLO)
```

Worked, at a 99.9% SLO (budget = 0.001):

| Observed error ratio | Burn rate | Budget gone in… | Reading |
|---|---|---|---|
| 0.1% | 1 | 28 days (exactly the window) | On pace. Not an emergency, not free either. |
| 0.6% | 6 | ~4.7 days | Serious. Something changed. |
| 1.44% | 14.4 | ~2 days | Page now. |
| 10% | 100 | ~6.7 hours | Effectively an outage. |

Two derived facts you will use constantly: a burn rate of **14.4 sustained for 1 hour consumes 2% of a 30-day budget** (14.4 / 720 hours), and a burn rate of **6 sustained for 6 hours consumes 5%**. Those two products are exactly the rows of the multi-window alerting table in `alerting.md` §4 — the table is not arbitrary, it is these thresholds chosen so that a page corresponds to a *specific, statable* fraction of the month's budget being gone.

**Burn rate is only meaningful above a minimum sample.** Two errors in eleven requests is a burn rate of 180 and means nothing. Before evaluating any threshold, require enough traffic that a single error cannot by itself cross it — `../../loop-ship/references/release-gates.md` states the same rule for canary rungs, and it applies identically to steady-state alerting on a low-traffic service.

## 4. The error-budget policy — the operational half

An error budget with no policy attached is a dashboard. The **policy** is the pre-agreed, written answer to "what happens when the budget runs out," decided while everyone is calm and nobody is losing money. This is the half a design-time treatment structurally cannot supply, because it is about behaviour under a live measurement.

A workable default policy, stated as thresholds rather than vibes:

| Budget remaining | What changes | Who decides |
|---|---|---|
| **> 50%** | Nothing. Ship. Take risks — this is what the budget is *for*, and an unspent budget at window close is a target set too loosely, not a triumph. | Team, no escalation |
| **25–50%** | Advisory. Feature work continues; risky migrations and multi-rung canaries get scheduled deliberately rather than opportunistically. | Team |
| **< 25%** | Reliability work is prioritized alongside features. New risk classes (schema migrations, dependency upgrades, infra changes) need an explicit decision. | Service owner |
| **0% (exhausted)** | **Feature freeze**: engineering effort moves to reliability until the rolling window recovers the budget. Only changes that *reduce* burn ship. | Service owner declares; only a named role above the team can waive |

**The feature-freeze precedent is the load-bearing part and also the most-violated.** It only works if three things are true: the freeze is automatic rather than negotiated at the moment of pain, the waiver has a **named owner** and is **recorded with a reason**, and the recorded waivers are reviewed — a policy waived every month is not a policy, it is a target set too tight, and the correct fix is to re-derive the SLO in §2, not to keep waiving.

**Waivers are a finding, not a failure.** Record every one: date, budget state, what shipped anyway, who approved, and what the observed consequence was. That record is the input to the next SLO review and it is the only thing that distinguishes "our target is wrong" from "our discipline is wrong."

**Practitioner depth.** Hidalgo's *Implementing Service Level Objectives* (1st ed., 2020) carries the fuller policy templates — stakeholder sign-off structure, multi-service and dependency-inherited budgets, and what to do when a shared dependency burns your budget for you. Treat it as doctrine, not specification; see `standards.md` for the authority grade.

## 5. How burn rate feeds everything downstream

This file is a producer. Four consumers read it, and each reads a *different* projection of the same number — which is why it is computed once, here.

- **`alerting.md`** reads burn rate as the **alert threshold input**. The multi-window table's rows are burn-rate values (14.4, 6, 1) paired with windows; nothing in that file is meaningful without §3's arithmetic.
- **`on-call-triage.md`** reads burn rate as the **severity axis**, crossed with blast radius. "How bad is it" stops being a judgment call and becomes "how much of the month is gone, and how fast."
- **`autonomy-and-rollback.md`** reads burn rate as the **SCALE gate**: an automatic rollback fires on a burn-rate breach during a bake window and on nothing else. It also reads *budget remaining* as a precondition — a service already at 0% budget does not get more autonomy, it gets less.
- **`../../loop-ship/references/release-gates.md`** reads burn rate as the **canary promotion criterion** during a ramp, using the abort/hold/promote thresholds in its §4 table. Those numbers and these must be derived from the same SLO definition, or a canary will promote on one standard and steady state will page on another.

**Cross-references, not copies.** For the design-time intake that decides what target is even affordable — the availability nines table, serial-dependency multiplication, RTO/RPO, and the pre-sign-off checklist — see `../../loop-design/references/nfr.md`. For what a burn-rate number *does* to a rollout in flight, see `../../loop-ship/references/release-gates.md`. Neither is reproduced here; two copies of an SLO definition is how two skills end up labelling the same service differently.
