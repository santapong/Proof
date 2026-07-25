# Reproduction and Timeline — the two artifacts handed to `loop-debug`

This file produces the deliverables that make this skill worth invoking. **Its two outputs ARE `loop-debug`'s §1 and §2 inputs**: the reproduction is what `loop-debug` §1 (Reproduce reliably first) demands before it will touch code, and the merged timeline is `loop-debug` §2 (Read the evidence), pre-assembled.

That framing is the whole point. `loop-debug` is a strong skill with a weak precondition — it needs a failure it can make happen on demand and evidence it can read literally. An incident is the one situation where that evidence is abundant, fragmented across six systems, and **evaporating**: logs roll over, traces sample out, dashboards re-window, and the on-call channel scrolls. Capturing it while it exists is this skill's contribution, and nothing here analyzes it.

Start capturing **during** the incident, not after. Mitigation (`mitigation-playbook.md`) changes the system's state; anything not captured before mitigation may no longer be observable after it.

## 1. Sourcing a reproduction FROM production

**Replay the real failing input. Do not guess one.**

A synthesized reproduction that resembles the failure is worth very little: if it fails, you do not know it fails for the same reason; if it passes, you have learned nothing. The failing request already happened and production recorded it. Go get it.

Pull, in this order of preference:

1. **The failing trace** — an OpenTelemetry span or APM transaction for a request that actually failed, carrying its `trace_id`, the full attribute set, and the span that errored. This is the highest-fidelity source and it usually contains the input shape directly.
2. **The structured log line** for a failing request, with its correlation id, and the surrounding lines for the same id.
3. **The error-tracker event** — exception, stack trace, and captured request context.
4. **The raw request** from an access log or gateway record, where request bodies are retained.

Take **several** failing instances, not one. Their intersection is the signal (what all failures share) and their differences bound the trigger (what varies without preventing the failure). A single instance cannot distinguish an essential attribute from an incidental one.

Take **near-miss successes** too: requests that look similar and succeeded. The difference between a failing and a succeeding instance is the sharpest localization signal available, and it is the head start on `loop-debug` §3 that the handoff package promises.

**Redact before the artifact leaves the incident channel.** Real production inputs carry real user data. Replace values that do not affect the failure; keep the shape, length, encoding, and type — those frequently *are* the trigger. When you cannot tell whether a value matters, keep it and restrict who can read the artifact rather than guessing.

## 2. What "faithful" requires

A reproduction is faithful when it fails **for the same reason**, not merely when it fails. Four dimensions, and every one of them has been the actual cause of a reproduction that lied:

- **Version.** The exact deployed artifact — commit or build id — of the failing service *and* of every dependency it called. "Latest main" is not the version that broke.
- **Configuration.** Environment variables, feature-flag state at the moment of failure, resource limits, timeouts, connection-pool sizes, and the deployed topology. **Flag state is the single most commonly missed item**, because it is invisible in the code and changes without a deploy.
- **Data shape.** Not just the fields, but sizes, encodings, null-versus-absent, unicode, timezone, precision, and cardinality. A record with 40 000 children reproduces failures that the same record with 3 children never will.
- **Load and concurrency.** If the failure is a race, a deadlock, a pool exhaustion, or a timeout, a single-request replay will never show it. Reproduce under concurrency, and record the pattern (burst, sustained, fan-in) as part of the artifact.

**State honestly which dimensions you matched and which you approximated.** A reproduction annotated *"same version and config; data shape approximated; load not reproduced"* is genuinely useful to `loop-debug`. One presented as faithful when load was not reproduced sends `loop-debug` §4 hunting hypotheses that the reproduction structurally cannot test.

**Record the failure rate.** "Fails 3 times in 10" is not a defective reproduction — intermittency is itself evidence about the fault class, and `loop-debug` §1 explicitly wants it noted.

**If you cannot reproduce it, say so plainly.** An honest "not reproduced; here is what we tried and what we ruled out" is a legitimate deliverable. A reproduction that fails for a *different* reason than the incident is worse than none: it will be diagnosed, fixed, and the incident will recur.

## 3. Timeline sources to pull

Six sources. Each sees the incident differently, and the ones teams skip are usually the ones that contain the answer.

| Source | What to pull | Why it earns its place |
|---|---|---|
| **Application logs** | Error and warning lines across every involved service, plus the last known-good lines before the first error | The narrative, if they are structured and correlated. Volume is the problem — filter by correlation id, not by keyword. |
| **Traces / APM** | Failing traces, latency distributions per span, and error rates per service dependency | The only source showing **cross-service causality** directly. Where the timeline becomes a graph rather than a list. |
| **Metrics / dashboards** | The affected SLI, saturation (CPU, memory, connections, queue depth), and the same metrics on neighbors | Establishes **when** the deviation actually began — usually earlier than the first alert. |
| **Deploy history** | Every deploy, config push, and infrastructure change across all services in the window, not just the obviously implicated one | The highest base-rate correlation in production incidents. Widen the window: the deploy that broke it may be hours old and only now reaching the triggering traffic. |
| **Feature-flag / config changes** | Every flag toggle, percentage-rollout change, and dynamic-config edit, with actor and time | The **most frequently missed source**. Flags change behavior with no deploy, no commit, and often no audit entry anyone thinks to check. |
| **Alerts and on-call chat** | Every alert fired (and resolved), plus the human record from `mitigation-playbook.md` §4 | The only source recording **what humans did and expected**. Also the only record of actions taken, which is why they must be timestamped as they happen. |

**Set the window generously and then justify narrowing it.** Start well before the first alert — the deviation almost always predates detection — and extend past mitigation, because mitigation effects are themselves timeline events. Anything cut from the window gets cut **explicitly and logged**, never silently.

**Upstream and downstream count.** A dependency's status page, a cloud provider's health dashboard, and a third-party incident are legitimate timeline entries. So is the failure your outage caused in a *consuming* system.

## 4. Correlating, de-skewing, and de-duplicating

Six sources produce six partial orderings that do not agree. Reconciling them is mechanical work, and it is deliberately done in plain script logic rather than by an agent (see `templates/incident-reconstruction.workflow.js`).

**Correlate by identifier, not by proximity in time.** `trace_id`, `span_id`, `request_id`, `session_id`, and the deploy or release id are the joins. OpenTelemetry's Semantic Conventions (pinned in `standards.md`) give these stable attribute names precisely so this join works across services. Two events that merely happened at the same moment are **not** related, and treating temporal adjacency as causality is the most common error in a reconstructed timeline.

**Correct clock skew explicitly.** Hosts disagree, and sub-second ordering across sources is untrustworthy without correction.

- Normalize **everything to UTC** at ingest. A timeline mixing local timezones is not a timeline.
- Anchor on an event that **multiple sources recorded independently** — a deploy that appears in both deploy history and application logs — and derive each source's offset from it.
- Where no anchor exists, **state the uncertainty rather than inventing an offset**: mark the source's events as ordered *within* the source but only approximately ordered against others.
- Where skew exceeds the interval you are trying to reason about, **say the ordering is unresolved**. An asserted ordering that is wrong sends `loop-debug` after a causal chain that runs backwards.

**De-duplicate on identity, not on text.** The same event is routinely recorded by two systems — an error in the application log and the same error in the tracer, an alert in the monitoring system and its notification in chat. Collapse them on `(correlation id, event identity)` and **keep every source attribution on the surviving entry**. Two sources agreeing is corroboration and it must remain visible after the merge; silently discarding the second copy throws that away.

**Log every drop.** Nothing is deduplicated, trimmed, or capped without a record of what went and why. An event removed silently is indistinguishable, later, from an event that never happened.

## 5. The artifact

**One** time-ordered sequence. Not six per-source lists, not a summary — a single merged sequence, because a reader reconstructing causality across systems cannot do it from parallel lists.

Every entry carries:

- **Timestamp**, UTC, with the skew correction applied and noted.
- **Source**, named — which of the six, and which system within it.
- **Event**, stated factually. What happened, not what it means.
- **Correlation ids** present on the event.
- **Confidence in placement** where the ordering is uncertain.

Mark the structural moments the postmortem will need: **first deviation** (earliest evidence, usually before the alert), **detection** (first alert or report), **declaration**, **each mitigation attempt with its outcome**, **recovery**, and **de-escalation**. The gaps between them — detect time, respond time, mitigate time — are the metrics the postmortem reports.

**Keep interpretation out of it.** "Connection pool exhausted at 14:02:11" is an entry. "Connection pool exhausted because the retry storm from the gateway saturated it" is a hypothesis, and hypotheses are `loop-debug` §4's, not this file's. An interpreted timeline is a timeline that has quietly pre-committed to one causal story, and it will be read as evidence for that story by everyone downstream.

## 6. Handoff framing

**The timeline is not analyzed here. It is handed over whole.**

This file's outputs go into the `SKILL.md` §4 package alongside the severity classification and the mitigation record. What this skill is permitted to add is a **suspected fault region and blast radius** derived from correlation — "errors begin 90 seconds after the 14:01 deploy of service X, confined to tenants on the new schema." That is a head start on `loop-debug` §3 Localize.

It is **not** a root cause, and it must not be written as one. Naming the causal chain is `loop-debug` §5. The discipline is the same one `postmortem.md` applies to its root-cause section: state what the evidence *shows*, point at the skill that will determine what it *means*, and stop.

## 7. Honest precondition — this is a scaffold, not a guaranteed recipe

**Everything above assumes instrumentation that already exists.** Faithful reproduction from production telemetry presupposes OpenTelemetry or an APM in place, structured logs carrying correlation ids, retained deploy and flag-change history, and metrics at a resolution finer than the incident. Where that holds, this procedure works well and the merge barrier in the workflow template has genuine cross-source work to do.

**Where it does not hold, this degrades, and pretending otherwise is worse than the degradation.** On an un-instrumented or partly instrumented service:

- There is no `trace_id`, so cross-service correlation falls back to timestamp proximity — which §4 just told you is unreliable. **Say the ordering is inferred**, and mark it.
- Unstructured logs mean the timeline is assembled by grep and human reading. That is slow, incomplete, and biased toward whatever was searched for.
- Without retained flag and config history, the most commonly implicated source **simply is not available**. Record it as a gap in the timeline, not as an absence of change.
- Reproduction degrades to inferring the input from an error message. State that the reproduction is **inferred rather than replayed**.
- The workflow's merge barrier has few or low-quality sources to reconcile. When that is the case, **take the `SKILL.md` §7 escape hatch and reconstruct inline** — fanning agents at three grep results is overhead, not parallelism.

**Write the gaps into the artifact.** A timeline with an explicit "no flag-change history retained; 13:40–14:10 unobserved" is honest and actionable; the same timeline with the gap left silent reads as a period in which nothing happened, and the postmortem will conclude exactly that. Every gap named here is also a ready-made action item for `loop-operate` — see `postmortem.md`.
