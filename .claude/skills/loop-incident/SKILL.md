---
name: loop-incident
description: "Run the response to a live, user-impacting production failure: severity triage, comms and roles, mitigate before diagnosing, build a reproduction harness, keep the timeline, and write the blameless postmortem or correction-of-error. Use when the user says production is down or degraded, an outage or sev is declared, customers are affected, an alert has escalated past its runbook, or asks for a postmortem, incident timeline, or CoE. Restores service first and hands root-cause analysis to loop-debug. For steady-state SLOs, alert design, and runbooks that resolve a condition without declaring an incident, use loop-operate. For redeploying or rolling back the fix once it exists, use loop-ship."
argument-hint: <incident> [--mode <lite|balanced|all-out>]
---

# Running an Incident

Does a runbook exist for this condition AND does executing it restore the SLI? Yes → `loop-operate`, steady state, no declaration. No, or impact exceeds the runbook's scope, or a human must be paged and coordinated → this skill.

That predicate is the entire boundary, it is decidable in one question at the moment the page fires, and it is worded identically in `loop-operate/SKILL.md` so both skills answer it the same way. Its corollary is what each skill actually owns: **`loop-operate` owns AUTOMATED mitigation of KNOWN conditions; this skill owns HUMAN-COORDINATED mitigation of NOVEL ones — and only this skill writes postmortems.** A condition with a runbook that works is not an incident, it is operations doing its job. A condition without one, or one whose blast radius has outgrown the runbook that was written for it, needs a human in a named role making a call under uncertainty. That is what is being run here.

Two more pointers, both decidable the same way:

- **Against `loop-debug`** — this skill **restores service first**. If the system is already stable and the remaining question is *why did this happen*, that is `loop-debug`, and it is where this skill's own work terminates (§4). Root-cause analysis is delegated whole, never performed here.
- **Against `loop-ship`** — this skill flips levers that already exist. If the question is *how do we safely redeploy or roll back the fix once it exists*, or *what release process would have caught this*, that is `loop-ship`, and it is reached as a postmortem action item, not mid-incident.

This skill does not restate `loop-operate`'s material. Detection, SLI/SLO and error-budget arithmetic, burn-rate alert design, and runbook authoring stay entirely there; they are cross-referenced from here and never duplicated. When a postmortem action item asks for a new alert or a new runbook, that work is handed to `loop-operate` (§5).

The engine is: **declare → mitigate → reproduce and reconstruct → recover and hand off → learn**, which is `NIST SP 800-61 Rev. 3`'s lifecycle applied to a software service. Each step below points at the reference that owns it; read the reference before running the step.

## 1. Declare, and stand up command

Declare early. The cost of declaring an incident that turns out to be minor is one channel and thirty minutes; the cost of not declaring one that turns out to be major is measured in the interval nobody was coordinating. Open **`references/incident-command.md`** and run it in order:

1. Apply the **declaring criteria** and say the words — an incident is declared, not discovered.
2. Assign the **Incident Commander** first. The IC owns every undelegated role by default; **Operations Lead** and **Communications Lead** are the two roles delegated first, in that order.
3. Score **severity/priority** on the two-axis matrix — the CVSS technical-impact band (reused from `loop-review`, never re-derived here) crossed with an operational blast-radius axis. Severity gates staffing, not the other way around.
4. Name the **single source-of-truth channel** and its update cadence before anything else is investigated.

Severity is provisional and gets **re-escalated mid-incident** as evidence arrives. A severity that never moves in a long incident usually means nobody re-scored it.

## 2. Mitigate before diagnosing

Stop the bleeding before you understand it. Understanding is §4's job and it is somebody else's skill. Open **`references/mitigation-playbook.md`** for the pattern catalog — rollback/revert, feature-flag kill switch, traffic failover, load shedding, circuit breaker, scale-out, restart, rate limit, DB failover — each with its when-safe and when-not conditions.

Three constraints govern every choice there, and they are stated here because they are the ones most often traded away under pressure:

- **Only levers already in place.** Revert to last-known-good, flip an existing flag, fail over to an existing standby. Designing a new deployment or rollback strategy is `loop-ship`'s work and is never performed mid-incident.
- **The one exception to mitigate-first** is when mitigating first is itself unsafe — active data corruption, where stopping the bleeding could destroy the evidence or widen the loss. The playbook states the test for that case; it is the only sanctioned reason to diagnose before acting.
- **Verify the mitigation stopped USER-VISIBLE impact**, not that something changed. A green dashboard on a metric nobody experiences is not recovery.

Record every action with a timestamp as you take it. Those records are not paperwork — they are §3's timeline, and reconstructing them afterwards from memory is where incident records go wrong.

## 3. Reproduce and reconstruct

These two artifacts are the deliverable this skill exists to produce. Open **`references/reproduction-timeline.md`**.

- **The reproduction harness** is built *from production* — replay the exact failing request, input, or trace pulled from telemetry, do not synthesize a guess. "Faithful" means matching version, config, data shape, and load pattern to the failure.
- **The timeline** merges every telemetry source — logs, traces/APM, metrics and dashboards, deploy history, feature-flag and config changes, alerts and on-call chat — into **one** time-ordered, source-attributed, clock-skew-corrected, deduplicated sequence, correlated by trace or request id.

Neither artifact is analyzed further here. The reference states the honest precondition: this step assumes instrumentation and structured logs already exist, and degrades to manual log-scraping on an un-instrumented service. Say so when it applies rather than implying a fidelity you did not have.

## 4. Recover, and hand off to `loop-debug`

Recovery is the point at which the SLI is back inside its objective and the incident can be de-escalated. It is also the handoff. Package the work and stop.

**The handoff package to `loop-debug` — a contract, not a summary:**

- **Severity/priority classification** as finally scored, including any mid-incident re-escalation.
- **The mitigation already applied, with its timestamp** — and an explicit note that it is a workaround, so `loop-debug` does not mistake it for a fix.
- **A faithful reproduction that fails on demand**, carrying the exact trigger, inputs, environment, and expected-vs-actual. This is written to satisfy `loop-debug` §1's own bar, not a looser one.
- **The reconstructed multi-source timeline** — this *is* `loop-debug` §2's evidence input, pre-assembled rather than gathered again.
- **A suspected fault region and blast radius** derived from timeline correlation — a head start on `loop-debug` §3 Localize, explicitly *not* a substitute for it.

**The non-goals, stated as explicitly as the package:**

- This skill never performs `loop-debug` **§4** (generating and eliminating falsifiable hypotheses), **§5** (stating the causal chain, naming the root cause), or **§6** (the minimal fix and its regression test). A suspected fault region is a pointer; a named root cause is a verdict, and verdicts belong there.
- This skill never authors a **test**. The repro harness is a way to make the failure happen on demand; turning it into a suite entry is `loop-test`'s work, reached through `loop-debug` §6 exactly as `loop-debug` reaches it.
- This skill never writes an **alert rule** and never touches **SLO or error-budget arithmetic**. That is `loop-operate`'s, and asking for it here is the merge failure the two skills are separated to avoid.
- This skill never designs a **deployment or rollback strategy**. That is `loop-ship`'s, triggered as a postmortem action item.

The formal authority for drawing the line exactly here is ITIL's incident-versus-problem management split — restore service now, eliminate the underlying error later — pinned with its caveats in **`references/standards.md`**.

## 5. Learn: the blameless postmortem

Open **`references/postmortem.md`** and write it. The rules that make it worth writing:

- **Blameless language** is a mechanism, not a courtesy — a postmortem that assigns fault gets you a sanitized timeline next time.
- **Contributing factors get category breadth** (fishbone-style spines) rather than a single 5-whys chain, and any 5-whys that is run **must terminate at a systemic or infrastructure cause** — never at "someone made a mistake."
- **The root-cause section is a POINTER** — "see `loop-debug` diagnosis, attached once complete." It is deliberately left unfilled so the postmortem drafts and gets reviewed without blocking on the debug session finishing.
- **Action items** carry an owner, a due date, and a verifiable completion criterion, and are tracked to closure. Most of them hand work *out*: new alert rules and runbooks to `loop-operate`, a canary stage to `loop-ship`, a code-level security audit to `loop-review`. None of that is performed here.
- **The recurrence check** is the highest-yield section: has this failure mode happened before, and why did the prior action item not prevent it?
- A **human reviews and approves** before the postmortem is final. This is a gate, not a formality.

## 6. Standards

Cite from **`references/standards.md`**, never from memory. It pins NIST SP 800-61 Rev. 3, ICS/NIMS, the Google SRE Book chapters, PagerDuty's incident-response docs, Amazon's Correction of Error, ITIL's incident/problem split, the OpenTelemetry pin shared with `loop-debug`, and the CVSS v4.0 band table this skill *reuses* from `loop-review` rather than reforking. It also records which of those are authoritative specifications and which are practitioner doctrine — the distinction changes how you cite them.

## 7. Orchestration: fan out only when the timeline is genuinely fragmented

**Size-gated escape hatch first, because this is the failure mode of this particular template.** A single-service incident with one log stream has nothing to reconcile: reconstruct the timeline inline in this session and skip the workflow entirely. Fanning five agents at a timeline that was never fragmented is pure overhead, and the merge barrier they exist to feed reduces to a sort.

For an incident that genuinely spans **multiple independent telemetry sources** — several services, or logs plus traces plus deploy history plus flag changes — run **`templates/incident-reconstruction.workflow.js`**:

1. **Triage** — one agent classifies severity/priority from the reported symptoms and flags candidate mitigations from the §2 catalog.
2. **Timeline fan-out** — one investigator per telemetry source, each returning its slice as structured, source-attributed events.
3. **Merge (barrier)** — reconcile every fragment into one deduplicated, skew-corrected, ordered sequence, in plain script logic. This is the one earned barrier: an event from the trace source only sorts correctly once *every* source has reported, and near-duplicates can only be collapsed with the full set in hand.
4. **Reproduce** — one agent builds the harness from the merged timeline's identified failing request.
5. **Postmortem draft** — one agent writes the blameless shell with the root-cause section left as a pointer to `loop-debug`.

This is the parallel fan-out → merge pattern from the **`loop-engine`** skill (its `templates/parallel.workflow.js`, harness policy H2's earned barrier, H5's null handling). Invoke `loop-engine` to author and execute the run, passing your argument string through so `--mode` reaches it.

## Reference files

- `references/incident-command.md` — declaring criteria, the IC / Ops Lead / Comms Lead split, the severity × blast-radius matrix, staffing thresholds, channel and cadence, re-escalation
- `references/mitigation-playbook.md` — mitigate-first and its one exception, the pattern catalog with when-safe/when-not, verifying user-visible recovery, timestamped action records
- `references/reproduction-timeline.md` — building a faithful reproduction from production telemetry and reconstructing the multi-source timeline; the two artifacts handed to `loop-debug`
- `references/postmortem.md` — blameless language, CoE structure, contributing-factor breadth, action items, the review gate, the recurrence check
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, honestly graded, and mapped to its workflow
- `templates/incident-reconstruction.workflow.js` — triage → per-source timeline fan-out → merge barrier → reproduce → postmortem-draft workflow script
