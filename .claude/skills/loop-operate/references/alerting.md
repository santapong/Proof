# Alerting — what to measure, what to page on, and the burn-rate table

Open this after `slo-model.md` has produced an SLO and a burn rate, and after `observability.md` has confirmed the telemetry exists to compute them. This file answers three questions in order: **which signals to collect**, **which of them are allowed to wake someone up**, and **at what threshold**. The third question is the one most alerting is worst at, and §4 is this file's centerpiece because it is the concrete implementation that a one-line mention of "multi-window, multi-burn-rate" never gives you.

Sources are pinned in `standards.md`; read the authority grade there before citing any of them. Nothing on this shelf is an ISO specification — the golden signals, RED, USE, and the burn-rate table are all practitioner doctrine, extremely well-adopted, and cited as such.

## 1. The four golden signals — the umbrella taxonomy

Google's SRE Book (ch. 6, 2016) names four signals as the minimum any user-facing service should expose. Treat them as the *checklist you sweep*, not the alert set you ship:

| Signal | What it measures | Typical instrument |
|---|---|---|
| **Latency** | How long a request takes — **split successful from failed**, because a fast 500 will otherwise flatter your latency graph into uselessness | Histogram of request duration, by route and status class |
| **Traffic** | Demand on the system in whatever unit is native — rps, sessions, messages consumed | Counter, rate-aggregated |
| **Errors** | Rate of requests that failed — explicitly (5xx), implicitly (200 with the wrong body), or by policy (served, but over the latency SLO) | Counter, split by failure kind |
| **Saturation** | How full the constrained resource is, and how close to the point where latency goes non-linear | Utilization gauge plus a queue-depth or headroom measure |

The split of latency by success, and the "implicit and by-policy" breadth of errors, are where most implementations quietly cheat. A service that counts only 5xx as errors will report perfect health while returning empty result sets.

## 2. RED versus USE — pick by the layer you are looking at

The golden signals are the umbrella; RED and USE are the two working methods underneath it, and they are not interchangeable. Reaching for the wrong one produces a dashboard that is technically full of data and cannot answer the question you have.

| | **RED** (Tom Wilkie, 2015) | **USE** (Brendan Gregg, 2012) |
|---|---|---|
| **Measures** | **R**ate, **E**rrors, **D**uration | **U**tilization, **S**aturation, **E**rrors |
| **Unit of analysis** | The **request** | The **resource** |
| **Apply to** | Request-driven services: HTTP/gRPC APIs, web front ends, anything with a caller waiting | Resource and hardware layers: CPU, memory, disk I/O, network interfaces, connection pools, thread pools, queues |
| **Answers** | "Are users being served correctly and quickly?" | "Which resource is the bottleneck right now?" |
| **Blind to** | Which underlying resource is the constraint | Whether any user is actually affected |

**The rule for which to reach for: RED for the SLO, USE for the diagnosis.** Your SLIs and therefore your pages come from RED, because RED measures what a user experiences. USE metrics belong on dashboards and in runbook success-checks, where they tell an operator *which resource to act on* once a RED-based page has already established that something is wrong. A USE metric that pages is almost always a §3 violation.

**Neither covers everything.** Pipelines and event consumers have no request and no interesting host resource — their SLI is freshness or lag (`slo-model.md` §1), and the analogous "RED" is *records in, records failed, age of the oldest unprocessed record*. Say which method you adapted rather than pretending a pipeline is an HTTP service.

## 3. Symptom, not cause — the Ewaschuk rule

Rob Ewaschuk's *My Philosophy on Alerting* states the rule this file is built on: **page on what users feel, not on causes.** Cause-based alerts multiply with your architecture, fire during conditions nobody notices, and go stale silently the moment the architecture changes underneath them. Symptom-based alerts stay valid across refactors because users' experience of "broken" does not change when you swap a database.

The corollary that makes it practical: **causes belong in the runbook, not in the alert.** The page says the checkout SLO is burning; the runbook says to check the connection pool, the upstream dependency, and the deploy history in that order. Deleting a cause-based page does not delete the monitoring — it demotes it from a page to a dashboard panel and a runbook step.

**RED — cause-based pages that should not exist as pages:**

```
ALERT HighCPU          IF avg(cpu_utilization) > 85% FOR 5m
ALERT DiskFilling      IF disk_used_percent > 80%
ALERT PodRestarted     IF kube_pod_container_status_restarts_total > 0
ALERT ReplicaLag       IF pg_replication_lag_seconds > 30
ALERT MemoryHigh       IF container_memory_working_set / limit > 0.9
```

Every one of these can be true while every user is served perfectly, and false while checkout is completely broken. A pod that restarts and is replaced in four seconds behind a load balancer produced *no* user-visible event; paging on it trains the on-call to close pages without reading them, which is the actual failure this rule prevents.

**GREEN — symptom-based pages, expressed against the SLI:**

```
ALERT CheckoutAvailabilityBurn
  IF  burn_rate(slo="checkout-availability", window=1h)  > 14.4
  AND burn_rate(slo="checkout-availability", window=5m)  > 14.4
  FOR 2m
  ANNOTATION runbook = "runbooks/checkout-availability.md"

ALERT SearchLatencyBurn
  IF  burn_rate(slo="search-latency-300ms", window=6h)   > 6
  AND burn_rate(slo="search-latency-300ms", window=30m)  > 6
  ANNOTATION runbook = "runbooks/search-latency.md"

ALERT IngestFreshnessBurn                  # pipeline: freshness SLI, same shape
  IF  burn_rate(slo="ingest-freshness-15m", window=6h)   > 6
  AND burn_rate(slo="ingest-freshness-15m", window=30m)  > 6
  ANNOTATION runbook = "runbooks/ingest-lag.md"
```

The `ANNOTATION runbook` line is not decoration. An alert with no runbook link fails the §5 actionability bar and — per `runbooks.md` — has nothing for the Match stage of `../templates/health-response.workflow.js` to find.

**The two sanctioned exceptions to symptom-only paging**, both of which are still *predictive symptoms* rather than causes:

1. **Imminent, non-recoverable exhaustion with a long lead time.** "Disk will be full in 4 hours at the current fill rate" is worth a ticket (rarely a page) because the symptom, once it arrives, is unrecoverable within the response window. Alert on the *projection*, not the current level — 80% full is not information; 80% full and rising 5%/hour is.
2. **Certificate and credential expiry.** No SLI degrades until the instant everything fails at once. This is a scheduled ticket, not a page, and its real fix is automated rotation.

## 4. The multi-window, multi-burn-rate table

This is the concrete implementation. It comes from the *Site Reliability Workbook* (1st ed., 2018), chapter "Alerting on SLOs," which walks six successive alert designs and lands here; the ones before it fail in ways worth knowing so you do not re-invent them.

**The problem it solves.** A single threshold forces a choice between two failure modes. Set it tight and short (>0.1% errors over 5 minutes) and you get **precision** failures: every transient blip pages, the on-call stops reading pages, and the one real page is missed. Set it loose and long (>0.1% over 24 hours) and you get **recall** and **reset-time** failures: a total outage takes hours to page, and once it fires it keeps firing long after the incident cleared, because the long window still contains the bad data.

**The mechanism.** Alert on **burn rate** rather than on raw error rate — it is already normalized to your SLO (`slo-model.md` §3) — and require **two windows to agree**: a long window that establishes the condition is *significant* (enough budget genuinely consumed to be worth waking someone), and a short window, conventionally **1/12 of the long one**, that establishes the condition is *still happening right now*. The long window supplies precision. The short window supplies fast reset: when the burn stops, the short window clears within minutes and the alert resolves, even though the long window is still contaminated.

| Severity | Long window | Short window | Burn rate | Budget consumed when it fires | Time to detect a *total* outage |
|---|---|---|---|---|---|
| **Page** | 1 h | 5 min | **14.4** | 2% of a 30-day budget | ~2 min |
| **Page** | 6 h | 30 min | **6** | 5% | ~15 min |
| **Ticket** | 3 days | 6 h | **1** | 10% | ~6 h |

Read a row as: *"page when both the 1-hour and the 5-minute burn rate exceed 14.4"* — which is exactly the statement *"2% of this month's error budget is gone and it is still going."* That is the property worth having: every page corresponds to a stated, defensible fraction of the budget, so "was this page worth it?" has an arithmetic answer instead of an argument.

**How to use the three rows together.** Evaluate all of them concurrently; they are not a fallback chain. The 14.4 row catches fast catastrophic burns in minutes. The 6 row catches slower degradations that the 14.4 row would never see. The 1 row catches the chronic, weeks-long drizzle that will exhaust the budget at month-end without ever looking like an incident — and it should open a **ticket, never a page**, because there is nothing urgent to do at 3am about a burn rate of 1.

**Tuning it, honestly.** These numbers assume a 30-day window and enough traffic for the short window to be statistically meaningful. Two adjustments are common and both are legitimate:

- **Low-traffic services**: at 5 rps, a 5-minute window holds 1,500 requests and a burn rate of 14.4 needs ~21 errors — workable. At 0.5 rps it holds 150 and two errors cross the threshold, which is noise. Lengthen the short window, or aggregate several low-traffic journeys into one SLO, or accept that this service gets ticket-grade alerting only. **Do not** lower the burn rate to compensate; that makes it worse.
- **Different compliance windows**: at a 7-day window, the same "2% of budget" page corresponds to a different burn rate. Recompute rather than copying the constant — the constants are `budget_fraction × window_hours / alert_window_hours`.

**The trap this table does not solve.** It measures aggregate burn. A failure isolated to one tenant, one region, or one client version can be catastrophic for those users and invisible in the aggregate. Either define the SLI per meaningful slice (and accept more SLOs), or add an explicitly-labelled cause-based page for the slice you know matters — and know that you have taken a §3 exception.

## 5. The paging bar, and dedup

**A page must clear all three bars. If it misses any one, it is not a page.**

- **Actionable** — a documented action exists that a human (or a runbook) can take *now* to improve the situation. "Be aware that latency is elevated" is not actionable. If the only response is to watch it, it is a dashboard.
- **Urgent** — it must be handled before business hours. If it can wait until 9am, it is a ticket. This bar is where most alert fatigue is created: alerts get promoted to pages because someone feared they would be ignored otherwise, which is a triage-process problem being solved with an interruption.
- **Real** — it reflects genuine, present user-visible impact, not a proxy for it. This is §3 restated as an admission test.

**Everything that fails the bar still gets monitored.** Demote, do not delete: a failed-urgency alert becomes a ticket, a failed-actionability alert becomes a dashboard panel plus a runbook step. Deleting the signal is how you lose the diagnostic that the next real page will need.

**Dedup, so one root cause does not fan out into five pages.** A single database failure will independently trip the checkout availability SLO, the search latency SLO, the API error-rate SLO, and two saturation alerts. Five pages for one cause is worse than one page, because now the responder is triaging their own alerting system during an incident.

Four mechanisms, in the order to apply them:

1. **Inhibition** — a firing higher-level alert suppresses the lower-level alerts it explains. If the checkout-availability page is firing, the connection-pool-saturation ticket underneath it is suppressed. Requires you to declare the dependency explicitly; it does not infer.
2. **Grouping** — alerts sharing a label set (service, cluster, region, deploy id) are delivered as one notification with N constituents, not N notifications.
3. **Correlation by root cause** — the deliberate merge this skill's workflow performs at the Correlate barrier: several concurrently-firing signals attributable to one underlying condition become **one incident** with several symptoms. This is the barrier in `../templates/health-response.workflow.js`, and it is why that barrier is earned rather than convenient.
4. **Dependency-aware routing** — an alert on a service whose *upstream dependency* is already alerting routes to the upstream owner, not to both. Without this, a platform outage pages every team simultaneously and each independently discovers the same thing.

**Review pages on a cadence, and treat the review as first-class work.** For every page fired in the period, record: did it fire on a symptom or a cause; did a runbook exist; did the runbook clear it; was the response anything other than "acknowledge and close." Alerts whose only response is acknowledgement are alerts to delete or demote, and this record is the exact input the SUSTAIN rung consumes as alert-quality drift (`autonomy-and-rollback.md` §2). **Pages that nobody acted on are a measurement of your alerting, not of your service.**
