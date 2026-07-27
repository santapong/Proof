---
name: loop-operate
description: "Operate a running service in steady state: define SLIs, SLOs, and error budgets, design burn-rate alerts, write self-healing runbooks, watch health, gate auto-rollback on SLO signals, and set the autonomy dial for unattended operation. Use when the user asks to monitor or operate a live service, set up SLOs or error budgets, design alerting or on-call triage, write a runbook, add self-healing or automated remediation, or decide how much a service may fix itself. For a declared outage affecting users right now, use loop-incident. For choosing SLO targets for a system not yet built, use loop-design. For a rollout that is still in flight and has not finished baking, use loop-ship, which authors the rollback mechanism this skill triggers. For automating improvements to a repository rather than a running service, use loop-autopilot."
argument-hint: <service> [--mode <lite|balanced|all-out>]
---

# Operating a Service

Does a runbook exist for this condition AND does executing it restore the SLI? Yes → this skill, steady state, no declaration. No, or impact exceeds the runbook's scope, or a human must be paged and coordinated → `loop-incident`.

That predicate is the entire boundary, it is decidable in one question at the moment the page fires, and it is worded identically in `loop-incident/SKILL.md` so both skills answer it the same way. Its corollary is what each skill actually owns: **this skill owns AUTOMATED mitigation of KNOWN conditions; `loop-incident` owns HUMAN-COORDINATED mitigation of NOVEL ones — and only `loop-incident` writes postmortems.** A condition with a runbook that works is not an incident, it is operations doing its job. This skill never writes a postmortem and never names a root cause; when a runbook fails to clear an alert, it packages a handoff and stops (§5).

Three more boundaries, each decidable the same way:

- **Against `loop-ship`** — `loop-ship` **authors the rollback mechanism and proves it works: the button.** This skill owns **the signal that presses it, and everything after bake: the wire.** The temporal form is the usable test — from deploy start until the bake completes, the rollout belongs to `loop-ship`; after bake, the service belongs here. Canary appears on both sides at different granularity: `loop-ship` defines the ramp schedule and the abort criteria (`../loop-ship/references/release-gates.md` §4), this skill supplies the SLI those criteria are evaluated against and the autonomy level at which an abort may fire without a human.
- **Against `loop-autopilot`** — the same autonomy ladder, a different object. `loop-autopilot`'s subject is **the repository** and its output is **a draft PR**; this skill's subject is **a running service** and its output is **a mitigated SLI**. Nothing about the ladder is re-derived here.
- **Against `loop-design`** — `loop-design` **sets** the SLO target before the service exists; this skill **measures it, alerts on it, and remediates against it** once traffic is real. The seam is checkable rather than a matter of taste: **if answering the question requires reading a live metric, it is this skill's.** Target intake, availability math, the nines table, RTO/RPO, the scalability axis and cost stay in `../loop-design/references/nfr.md`, which cross-references back here for everything measured.

**The autonomy ladder has exactly one definitional home:** OBSERVE → VERIFY → SUSTAIN → SCALE, its rung definitions, and its degradation guarantee are defined in **`../loop-autopilot/references/deployment.md` §"The autonomy ladder"**, and this skill cites those rungs for a live service without restating a word of them. Read that section before setting the dial in §6; nothing here re-derives a rung, and no definition of the ladder outside `.claude/skills/` is a content dependency of this skill.

## Two standing caveats — read these before deploying anything here

**Everything in this skill is a gated scaffold, not a proven recipe.** Without a live service and a real monitoring backend — Prometheus, Datadog, CloudWatch, Grafana Cloud, whatever you actually run — none of the templates below has ever been measured against ground truth. The burn-rate thresholds, the bake windows, the runbook success bars, and the auto-rollback trip points are all *defaults derived from published practice*, and every one of them is a number you are expected to re-derive from your own service's history before trusting it unattended. This is the same framing v0.3.0 used for the SCALE rung and it is repeated here for the same reason: a scaffold presented as a recipe gets deployed by someone who assumes it was tested. It was not. Run it in `execution: 'dry'` against a real alert stream, compare what it *would* have done against what the on-call actually did, and only then let it act.

**The trigger for a self-healing action is an external monitoring system's alert webhook, not Claude polling metrics on a schedule.** This matters because the obvious deployment is wrong: a Cloud Routine has a **1-hour minimum interval** (`../loop-autopilot/references/deployment.md`), and an hour is useless against a condition whose error budget is measured in minutes. The correct shape is *event-driven* — your alertmanager/Datadog/PagerDuty webhook fires an Action or a headless `claude -p` invocation, which supplies `nowMs`/`nowIso` and the firing signals as arguments. **That wiring is not provided by this skill and this skill cannot provide it**; it lives in your monitoring stack and your runner. It is a documented gap, not a solved problem, and `references/autonomy-and-rollback.md` §1 states it again rather than letting it be forgotten between here and deployment. A Routine alone is sufficient only for the slow, non-urgent passes (alert-quality review, runbook-success-rate drift), never for remediation.

## 1. Define the SLIs, the SLOs, and the error budget

Everything else in this skill reads from one number. Open **`references/slo-model.md`** and produce it before designing a single alert.

1. **Choose the SLI** users actually feel — availability, latency, quality/correctness, or freshness/throughput — and measure it *where they feel it* (load balancer or client), not deep in the stack where it flatters you.
2. **Set the SLO** from user expectation and historical performance, not aspiration. The internal SLO is always **stricter** than any external SLA.
3. **Derive the error budget** — `(1 − SLO)` over a compliance window — and express spend as a **burn rate**: budget consumed per unit time.
4. **Write the error-budget policy**: what happens at 0% budget, and who is allowed to waive it. This is the half `loop-design`'s design-time treatment never had, and a budget with no policy is a dashboard, not a control.

## 2. Instrument so the questions are answerable

Alerting and runbooks both assume telemetry that mostly does not exist by default. **`references/observability.md`** is the precondition, not an essay: the three signal types and the job each does, the metric-cardinality trap, the one correlation ID that makes them a system instead of three haystacks, and OpenTelemetry as the default instrumentation choice with its pinned Semantic Conventions. Its closing section states exactly what §3 and §4 require the telemetry to carry — if that list is not satisfied, fix instrumentation before designing alerts.

## 3. Design alerts that page on symptoms

Open **`references/alerting.md`**. The four golden signals are the umbrella; **RED** covers request-driven services and **USE** covers resource layers, and the file says when to reach for which. Two rules do most of the work:

- **Page on what users feel, not on causes** (Ewaschuk). A saturated CPU that is not moving the SLI is not a page.
- **Use multi-window, multi-burn-rate rules.** A paired fast and slow window at a graduated budget-consumption threshold, where **both must agree**, is the file's centerpiece — it buys precision and recall at the same time, which a single threshold cannot. The concrete table (1h/5m at 14.4, 6h/30m at 6, 3d/6h at 1) is there with its arithmetic worked out.

Then apply the paging bar — **actionable, urgent, real** — and the dedup rule that stops one root cause fanning out into five pages.

## 4. Write runbooks that are safe to execute unattended

Open **`references/runbooks.md`**. A runbook here is an **operational artifact that happens to be markdown, not documentation** — that one line is the whole boundary against `loop-docs`, which writes for a human reader seeking understanding, while these steps are *executed*, possibly with nobody watching, and must be deterministic, idempotent and testable.

- **Anatomy**: trigger condition → automated action → success check → escalation path. All four, or it is not a runbook.
- **The admission bar is reversibility.** If an action cannot be cleanly reverted, it is ineligible for automation at any rung.
- **The eligibility table is keyed to the rung.** Restart, scale, failover and cache-clear are candidates; schema changes, data mutations, secret rotation and infra-config edits **never** auto-run, at any rung, for the same reason `loop-autopilot`'s NEVER-list exists.
- **Concurrency is an open gap**, stated as one: two remediations targeting the same resource must be serialized, and there is no harness primitive for it — this is the infra analog of AP5 worktree isolation with no worktree to isolate against, so the lock has to come from your runbook executor.

## 5. Triage what fires, and hand off cleanly

Open **`references/on-call-triage.md`**. Severity comes from **SLO burn rate crossed with blast radius**, not from gut feel, and the decision tree routes each firing alert to exactly one of: auto-remediate, runbook-with-approval, or page-and-escalate.

When it escalates, the handoff to `loop-incident` is a **contract, not a summary** — current burn state, every runbook already attempted and its outcome, and the timeline so far — so incident response starts from where this skill stopped rather than from zero. If the runbook failed and the cause is a code defect rather than capacity or config, the chain is `loop-incident` → `loop-debug`; this skill does not root-cause and does not write the postmortem.

## 6. Set the autonomy dial and wire the rollback

Open **`references/autonomy-and-rollback.md`** — deliberately *not* named `deployment.md`, because two files already carry that name in this plugin and mean two different things (`../loop-design/references/deployment.md`, the design-time delivery-shape stub, and `../loop-autopilot/references/deployment.md`, the unattended-runner setup that also defines the ladder), while `loop-ship` owns the actual deployment mechanics under its own filenames. A third `deployment.md` would buy naming symmetry and cost every reader the ability to tell which one a link means. It covers the event-driven trigger gap restated in full, the rung mapping for operations (what OBSERVE, VERIFY, SUSTAIN and SCALE each mean when the object is a live service, citing the definitions in `../loop-autopilot/references/deployment.md` §"The autonomy ladder" rather than restating them), **SLO-gated automatic rollback** as the SCALE rung's instance of `loop-autopilot`'s canary-merge control flow, the preconditions checklist that gates it, and an honest-status section that repeats — rather than quietly drops — `loop-autopilot`'s own admission that choosing bake times and health thresholds without a ground-truth oracle is unsolved.

## 7. Standards

Cite from **`references/standards.md`**, never from memory. It pins the Google SRE Book and the SRE Workbook, Ewaschuk's alerting philosophy, RED and USE, OpenTelemetry Semantic Conventions, the Principles of Chaos Engineering, ISO/IEC 20000-1, Hidalgo's *Implementing Service Level Objectives*, and DORA's Four Keys — and it records for each whether it is an **authoritative specification** or **practitioner doctrine**, because the two are cited differently. It also carries an edition watch for *Site Reliability Engineering, 2nd Edition*: the book is announced but has not shipped, so do not cite it for a page or chapter number until it does.

## 8. Orchestration: size-gate first, then the workflow

**Take the escape hatch when it applies.** One alert, one service, one obvious runbook — execute it inline in this session and do not spin up a workflow. The barrier in the template below exists to decide "one incident or three" across concurrently firing signals; with one signal there is nothing to correlate and the fan-out is pure overhead.

When several SLOs or signals are firing at once, run **`templates/health-response.workflow.js`**:

1. **Correlate** — one check per currently-firing signal, fanned out in `parallel()`.
2. **Barrier (earned)** — merge signals that share a root cause into single incidents, and early-exit the whole run when nothing survives. Both of H2's grounds apply; the template's comment states them.
3. **Match** — per correlated incident, find the runbook whose trigger fits, **gated by the ladder rung** passed in `args`.
4. **Remediate** — execute dry or live, **serialized per target resource**.
5. **Verify** — recheck the SLI after a wait interval supplied in `args`; confirm the breach cleared, not merely that the alert went quiet.
6. **Escalate-or-close** — resolved goes to the pinned autonomy-state audit issue; unresolved or unmatched packages the §5 handoff payload for `loop-incident`.

This is the parallel fan-out → earned-barrier → pipeline pattern from the **`loop-engine`** skill (its `templates/parallel.workflow.js`, harness policy H1/H2/H5). Invoke `loop-engine` to author and execute the run, passing your argument string through so `--mode` reaches it.

## Reference files

- `references/slo-model.md` — choosing SLIs, setting SLO targets, error-budget arithmetic and burn rate, and the error-budget policy
- `references/alerting.md` — golden signals, RED vs USE, symptom-not-cause, the multi-window multi-burn-rate table, the paging bar and dedup
- `references/observability.md` — logs/metrics/traces, the cardinality trap, one correlation ID, OpenTelemetry, and what the rest of this skill requires telemetry to carry
- `references/runbooks.md` — runbook anatomy, the reversibility admission bar, the rung-gated eligibility table, the concurrency gap, and logging every attempted and skipped action
- `references/on-call-triage.md` — severity from burn rate × blast radius, the routing decision tree, and the handoff contract into `loop-incident`
- `references/autonomy-and-rollback.md` — the event-driven trigger gap, the rung mapping for ops, SLO-gated automatic rollback, the SCALE preconditions checklist, and the honest status
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, honestly graded, and mapped to its workflow
- `templates/health-response.workflow.js` — correlate → earned barrier → match → remediate → verify → escalate-or-close workflow script
