# On-call triage — from a firing alert to a routed action or a clean handoff

An alert has fired. This file decides three things in order: **how bad is it**, **who or what acts**, and — if this skill cannot clear it — **exactly what gets handed to `loop-incident`**. It is the operational restatement of the boundary predicate, made in the terms an on-call actually has in front of them at 3am.

## 1. Severity from burn rate × blast radius

**Severity is computed, not felt.** Two axes, both readable from telemetry, both defined elsewhere in this skill:

- **Burn rate** — from `slo-model.md` §3. How fast the error budget is being consumed, normalized so it is comparable across services. This is the *speed* axis.
- **Blast radius** — from `observability.md` §5's requirement that the affected slice be derivable. Percentage of traffic, number of tenants, whether a whole region or a single client version, and whether the affected journey is revenue-bearing. This is the *breadth* axis.

| | Blast radius: narrow (one tenant, one client version, <5% of traffic) | Blast radius: broad (a region, a whole journey, >25% of traffic) |
|---|---|---|
| **Burn rate ≥ 14.4** (2% of budget in an hour) | **High** — page, attempt the runbook immediately | **Critical** — page, attempt the runbook, and pre-warm the `loop-incident` handoff in parallel; do not wait for the runbook to fail |
| **Burn rate 6–14.4** | **Medium** — runbook on the approval path if the rung requires it | **High** — page and attempt the runbook |
| **Burn rate 1–6** | **Low** — ticket. Not urgent per the `alerting.md` §5 bar | **Medium** — ticket, but review within the business day; a slow broad burn exhausts the month |
| **Burn rate < 1** | Not an alert. If something fired here, `alerting.md` §5 has a demotion to do | **Low** — ticket |

**Three modifiers that override the grid upward, never downward:**

1. **Budget already exhausted.** A burn rate of 3 against a budget with 4% left is materially worse than the same burn rate at 80% remaining. Read *remaining budget* alongside burn rate; the grid assumes a healthy budget.
2. **Data integrity is in question.** Any suspicion of data loss, corruption, or incorrect writes escalates to Critical regardless of burn rate, and — because mitigating first may destroy evidence — it goes straight to `loop-incident`, which owns the one sanctioned exception to mitigate-before-diagnose.
3. **Two or more independent journeys affected.** This is a signal that the cause is below the service layer (platform, network, a shared dependency), and cause-below-the-service is by definition outside any single service's runbook.

**Severity is provisional and gets re-scored** as evidence arrives, in exactly the way `loop-incident` re-scores it. A severity that never moves during a long-running condition usually means nobody re-read it.

## 2. The decision tree

Run it in order. Each node is answerable from data already in hand; none of them requires a judgement call the workflow cannot make.

```
1. Does a runbook's trigger condition match this alert?
   NO  → no automated path exists → PAGE + hand off to loop-incident (§3).
         Log "skipped — no matching runbook" (runbooks.md §5): this names
         the runbook that should exist, and it is a postmortem action item
         that loop-incident will route back here.
   YES → 2

2. Is the action class eligible at the CURRENT rung (runbooks.md §3)?
   NEVER-row  → PAGE. Never auto-run, at any rung, for any severity.
   Not yet at this rung → PAGE with the runbook attached as a
         recommendation, so the human executes a known-good action rather
         than improvising one.
   Eligible, approval required → open the approval, STOP. Do not act while
         waiting; a half-executed approval path is worse than none.
   Eligible, pre-approved → 3

3. Is the target resource free (runbooks.md §4 lock)?
   NO  → defer or drop, and LOG the reason. Never act on a locked target.
   YES → 4

4. Is severity Critical AND blast radius broad?
   YES → execute the runbook AND open the loop-incident handoff in
         parallel. At this severity the runbook succeeding is the good
         case, not the expected case, and a handoff prepared late is a
         handoff assembled from memory.
   NO  → 5

5. Execute the runbook. Wait the success-check interval. Evaluate the
   success check against the SLI or burn rate — NOT against whether the
   alert stopped firing.
   CLEARED     → close. Append to the audit trail (autonomy-and-rollback.md §4).
   NOT CLEARED → 6

6. Is there a next runbook in the escalation path, and attempts remaining?
   YES → back to 2 with the next runbook.
   NO  → hand off to loop-incident (§3). This skill is done.
```

**The one rule that governs the whole tree: this skill's exit is always either "cleared" or "handed off."** There is no third state where it keeps trying, and no state where it starts investigating. Investigation is `loop-incident`'s, and root cause is `loop-debug`'s.

## 3. The handoff payload — a contract, not a summary

When triage escalates, `loop-incident` should begin from where this skill stopped, not from the original alert text. The payload below is a **contract**: `loop-incident`'s §1 (declare and stand up command) and §3 (reconstruct the timeline) are written to consume exactly these fields, and a handoff missing them forces incident response to re-derive information that was already computed.

**1. Current burn state** — everything `loop-incident` needs to score severity without recomputing it:

- The SLO in breach, named, with its target and compliance window.
- Current burn rate on each alerting window that is firing, and **budget remaining** as a percentage.
- The first moment the SLI deviated — which is usually **earlier than the first alert**, and is the single most useful timestamp in the package.
- Blast radius as measured: affected slice, percentage of traffic, tenants or regions, and whether a revenue-bearing journey is involved.
- The computed severity and the two axis values it came from, so it can be argued with rather than merely inherited.

**2. Runbooks already attempted, and their outcomes** — the part that most often goes missing and costs the most:

- For each: the runbook id, the exact action taken, the timestamp, the success-check query and its result, and whether the target lock was held.
- **Runbooks that were skipped, with the reason** — no match, rung too low, class ineligible, target locked. A skip is evidence: "no matching runbook" tells the incident commander immediately that this is a novel condition.
- An explicit flag that **every action taken is a mitigation attempt, not a fix**, so nothing in the package is mistaken for a diagnosis. `loop-incident` carries the same flag into `loop-debug`, and the chain only stays honest if it starts honest here.

**3. The timeline so far** — the events this skill already has, in the shape `loop-incident`'s reconstruction expects:

- Alert firing and resolution events, with the rule and threshold that produced each.
- Every automated action attempted and skipped (`runbooks.md` §5's records, verbatim).
- Deploy, config, and feature-flag change events inside the window (`observability.md` §5 requires these be emitted; if they are not, say so as a gap rather than as an absence of change).
- Correlation IDs for the failing requests observed, so `loop-incident` can pull traces rather than search for them.
- **Known gaps, named.** An un-instrumented source is not the same as a quiet one, and a gap left silent reads later as a period in which nothing happened.

**Hand the payload over and stop.** Do not continue attempting remediations after the handoff — two systems acting on one condition is exactly the concurrency failure `runbooks.md` §4 exists to prevent, and now one of them is a human.

## 4. The boundary, in this file's own terms

**"Did a known runbook clear it" is this skill. "Someone must coordinate response, communicate status, and write a postmortem" is `loop-incident`.** The same predicate `SKILL.md` opens with, restated where it is actually applied.

Three things this skill **never** does, stated as flatly as the payload above:

- **It never writes a postmortem.** Not a draft, not a summary, not a "quick note for the record." Only `loop-incident` writes postmortems, and a second document describing the same event is how two accounts of one outage end up disagreeing.
- **It never root-causes.** Triage names *what is burning and what was tried*. It does not name why. If a runbook fails to clear an alert and the cause is a code defect rather than capacity or configuration, the path is **`loop-incident` → `loop-debug`**, per the handoff chain: this skill detects, `loop-incident` mitigates and builds the reproduction, `loop-debug` finds the root cause, `loop-test` writes the regression test, `loop-ship` redeploys. This skill appears once, at the front.
- **It never designs a new mitigation lever mid-page.** Only levers already in place may be pulled — the same constraint `loop-incident` operates under. A lever that would have to be built is a `loop-ship` action item and, if it is a new runbook or a new alert, it comes back here as work, not as an improvisation now.

**What comes back.** `loop-incident`'s postmortem action items route alert, runbook, SLO and instrumentation work to this skill. That is the return leg of the same contract, and it is where "no matching runbook" from §2 becomes an actual runbook — which is the loop this skill exists to close.
