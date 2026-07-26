# Observability — three signals, one correlation ID, and OpenTelemetry to carry them

This file is a **precondition, not an essay.** `alerting.md` cannot compute a burn rate that nothing emits, and `runbooks.md` cannot write a success check against a signal that does not exist. Read it as the list of things that must be true before the rest of this skill is executable, and read §5 as the acceptance test.

This content moved here from `../../loop-design/references/nfr.md` in v1.0.0 and is re-pointed at operation. Design-time, the only thing worth saying is that observability is a **launch precondition, not a post-launch addition** — a service that ships un-instrumented gets instrumented during its first outage, at the worst possible cost. That sentence stays in `nfr.md`; the mechanics are here, because every one of them is a question about a live metric.

## 1. Monitoring versus observability

**Monitoring** answers *"is it broken?"* against questions you knew to ask in advance: dashboards, threshold alerts, the golden signals. It is bounded by your foresight.

**Observability** answers *"why is it broken?"* — the ability to interrogate your telemetry about failure modes you never anticipated, **without shipping new code to ask the question.** Distributed systems fail in unforeseen combinations; the useful test of an observability setup is whether a genuinely novel question can be answered from data already being collected, at 3am, by someone who did not write the service.

Both matter and they are not substitutes. `alerting.md` is monitoring: a small, curated set of pages against known SLOs. This file is what makes the *next* step — figuring out what to do about the page — possible at all. A service with excellent alerting and no observability pages you promptly and then leaves you with nothing.

## 2. The three signal types, and the job each does that the others cannot

**Logs** — discrete timestamped events; the *what happened, in detail*.

- **Structured, always** (JSON or key-value), never free-text prose. Unstructured logs are not queryable at 3am, and 3am is the only time they matter.
- **Correlation ID on every line.** A log line with no trace or request ID cannot be joined to anything and is effectively an anecdote.
- Highest-volume and highest-cost signal. **Sample or aggregate the chatty ones** — you cannot afford to retain every debug line at scale, and pretending otherwise means the retention window silently shortens until the logs you need have already aged out.

**Metrics** — aggregated numbers over time; cheap to store, ideal for dashboards and alert evaluation. This is where the SLI and burn rate in `slo-model.md` are computed.

- **The cardinality trap is the failure mode that actually happens.** Every unique combination of label values is a distinct time series. Putting a user ID, a request ID, a full URL path with IDs in it, or an unbounded customer identifier into a metric label multiplies your series count without limit and detonates both cost and query latency — frequently taking the monitoring system down during the incident it was supposed to help with.
- **Keep labels low-cardinality and bounded**: service, route *template* (`/users/{id}`, never `/users/8134`), status class, region, deploy id if your deploys are countable. High-cardinality identity belongs in **logs and traces**, which are built for it.
- Metric labels are a schema. Adding one is a schema change with a cost; treat it that way.

**Traces** — the path of one request across every service it touched, as a tree of timed spans.

- This is the only signal that shows *where* in a call graph the latency or the error originated, because logs and metrics are per-service by construction.
- **Sample deliberately.** Head-based sampling (decide at the entry point) is cheap and keeps a blind percentage. **Tail-based sampling** (decide after the trace completes) costs more and keeps the traces you actually want — the slow ones and the failed ones. For an operations use case, tail-based is worth the cost, because a uniformly-sampled 1% will almost never contain the failure you are looking at.

## 3. Correlation is what makes them a system

**The three signals are only powerful when correlated.** Thread one **request/trace ID** through log lines, trace spans, and metric exemplars so the pivot works in both directions: a metric spikes → jump to an exemplar trace → jump to that exact request's logs → see the payload shape that caused it. Without the shared ID you do not have three signals, you have three disconnected haystacks and a manual timestamp-matching exercise.

The correlation ID must be **propagated across service boundaries**, including through queues, async workers, and scheduled jobs — the places it is most often dropped, and the places where losing it hurts most, because that is exactly where a request stops being traceable by intuition.

## 4. OpenTelemetry as the default instrumentation choice

**OpenTelemetry (OTel) is the default.** It is the vendor-neutral CNCF standard — one set of APIs, SDKs, and the Collector — for generating and exporting all three signals. Instrument once against OTel and export to *any* backend, swapping vendors by reconfiguring the Collector rather than re-instrumenting the codebase. That is also the **lock-in hedge** on the observability vendor, which for most organizations is a larger recurring cost than the compute the service runs on.

It propagates trace context across service boundaries via **W3C Trace Context**, which is what makes §3's cross-service correlation work at all rather than being a convention each team implements slightly differently.

Reach for a proprietary agent only when it buys something OTel genuinely cannot, and know you are buying lock-in when you do.

**The pin, and its caveat.** Emit attributes and metric names under the **OpenTelemetry Semantic Conventions, v1.43.0 (3 July 2026)** for the stable main specification, so the telemetry this skill's runbooks and rollback templates produce composes with whatever OTel-native backend you run instead of inventing a private naming scheme. Two things about that pin are load-bearing:

- **Re-confirm the exact minor before citing it.** Semantic Conventions releases land at a near-monthly cadence; the version above will not stay current for long. `standards.md` carries the propagation obligation — three skills pin this spec, and whoever advances one advances the others in the same commit. Check what they record rather than trusting a claim here about what they say.
- **The GenAI semantic conventions split into their own repository** in this release. If you are instrumenting an LLM-backed service, the attributes you need are no longer in the main convention set; follow the split rather than pinning a stale main-spec version that still appears to contain them.

**A pinned convention is not a claim that the attributes exist in your system.** It says what to emit, not what is already there. §5 is how you find out which.

## 5. What the rest of this skill requires this telemetry to carry

This is the acceptance test. Run it before designing alerts; anything unchecked is instrumentation work that must happen first, and it is more urgent than the alert it is blocking.

**Required by `slo-model.md` and `alerting.md`:**

- [ ] The SLI's **good-event and valid-event counts are separately emitted as metrics**, at the measurement point the SLO names (edge or client, not deep in the stack). A ratio you can only compute by dividing two dashboards is not an SLI.
- [ ] Those counts carry **low-cardinality labels sufficient to slice by the dimensions you might page on** — service, route template, status class, region — and no more.
- [ ] Latency is a **histogram, not an average**, with buckets straddling the SLO threshold. A histogram with no bucket boundary near your threshold cannot compute your latency SLI at any accuracy.
- [ ] **Successful and failed requests are distinguishable in the latency signal**, so a fast failure cannot flatter the graph (`alerting.md` §1).
- [ ] Metrics are retained **at least as long as the longest alerting window** — the 3-day/6-hour ticket row of the burn-rate table needs 3 days of queryable history at full resolution, not downsampled.

**Required by `runbooks.md`:**

- [ ] Every runbook's **success check is a query against a signal that is already emitted**. A success check that requires new instrumentation is a runbook that cannot be verified, and per `runbooks.md` it is not eligible to run unattended.
- [ ] **Deploy, config, and feature-flag changes are emitted as timestamped events** into the same telemetry system. Without them, a correlation between "the burn started" and "something changed" is a human doing archaeology.
- [ ] Every automated action **emits its own event** — attempted, skipped, succeeded, failed — under a stable attribute set, so the audit trail in `autonomy-and-rollback.md` §4 can be reconstructed from telemetry and not only from the workflow's own log.

**Required by `on-call-triage.md` and `autonomy-and-rollback.md`:**

- [ ] **Burn rate is queryable as a value**, not merely computable by hand from raw counters. Triage severity, the rollback gate, and the workflow's Verify stage all read it programmatically.
- [ ] **Blast radius is derivable** — the affected slice (tenants, regions, client versions, percentage of traffic) can be read from labels or traces rather than estimated in the channel.
- [ ] **Traces are retained for failed and slow requests specifically** (tail-based sampling), because the handoff package into `loop-incident` is worth far less if the failing request was sampled away.

**If the checklist mostly fails, say so plainly** and treat instrumentation as the current work. `../../loop-incident/references/reproduction-timeline.md` documents the degraded path for an un-instrumented service — manual log scraping — and it is a real path, but it is not a path that supports automated remediation. **Unattended action on an un-instrumented service is not autonomy, it is an unobserved actuator**, and `autonomy-and-rollback.md` refuses it at every rung above OBSERVE.
