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

## 6. The misuse catalogue — six failures that look like working alerting

Every row below passes a casual review, because each one resembles the finished work: there *are* alerts, there *are* runbooks, there *are* dashboards. The mechanism that prevents each already exists in §2–§5 or a sibling file and is pointed at, not restated — what this section adds is the failure as the on-call experiences it, and a **detection signal evaluable from records this skill already mandates**, so establishing whether you have the problem is a query, not a project.

| Misuse | How it fails on-call | Detection signal | Fix |
|---|---|---|---|
| **Cause-based paging** — CPU, disk, pod restarts | The pager tracks the architecture instead of the users: **cause alerts multiply per component; symptom alerts stay countable** — one small set per user journey. Every refactor adds pages and silently stales others | Alert count grows when services are added but journeys are not. A page on a USE metric (§2), or whose expression contains no SLI or burn-rate term — outside §3's two sanctioned predictive exceptions and an explicitly-labelled §4 slice page | Demote per §3's corollary. The monitoring survives; only its right to interrupt is revoked |
| **Ack-and-ignore pages** — alert fatigue, the killer | Each acknowledge-and-close teaches the responder that pages can be ignored — and the real page arrives looking identical to the noise it is buried in. This is the row the other five converge on: each mints pages that fail the §5 bar, and this is where they cash out | Already in the §5 review record: any alert whose responses over the period were only "acknowledge and close." The same fraction, trending, is the SUSTAIN alert-quality drift signal (`autonomy-and-rollback.md` §2) | Demote at the review that caught it, not after another cycle of tuning — §5's bar is an admission test, and an alert that failed it once has already collected its cost |
| **Single burn-rate window** | Tight and short, every transient blip pages; loose and long, a total outage pages hours late and keeps firing after the graphs recover. §4's two named failure modes, shipped to production instead of designed out | Any burn-rate rule with one window term instead of two. Pages that resolve long after the incident cleared — the missing short-window reset | Adopt a §4 row unmodified: both windows, the stated burn rate, and the severity it maps to |
| **Descriptive runbooks** | The page links to "investigate the service," which is a wish, not an action. The responder improvises at 3am against a document proving only that someone once thought about the problem — the cost of writing it was paid, the value never collected | A linked runbook missing any of the four required parts in `runbooks.md` §1 — most tellingly a success check that is not a query. The Match stage of `../templates/health-response.workflow.js` finding nothing executable | **Runnable or it rots**: rewrite to the `runbooks.md` §1 anatomy, or move the prose where that file's own boundary sends it. What cannot be executed cannot be drilled, and undrilled is unverified |
| **Self-healing that masks decline** | The auto-restart turns a memory leak into an invisible sawtooth: the symptom clears every time, no page fires, and the decline compounds quietly until the restart stops being enough — surfacing as a full outage instead of the ticket it should have been weeks earlier | Remediation frequency per runbook **per target**, trending up while the alert stays quiet. Requires `runbooks.md` §5's execution records; a remediation that emits no event is invisible by construction (`observability.md` §5) | **Every automated remediation emits a counter, and someone reviews the trend on a cadence.** A rising fix-rate on a quiet alert is a defect report — route it to `loop-debug`, naming the runbook and target |
| **Dashboard sprawl** | Nobody opens the dashboard until the incident — and then it answers the last incident's question, because the last incident is who built it. The responder tabs through a museum while the SLI burns | Dashboards with no views outside incident windows. More dashboards than journeys. Panels whose queries error because a metric was renamed and nobody noticed — proof nobody is watching | One dashboard per critical user journey — SLI and burn rate on top, USE panels beneath as diagnosis (§2). Archive the rest: an unread dashboard is retention cost plus false confidence, and neither is free |

Three rows compress an argument the fix column cannot carry alone.

**Fatigue is the multiplier, not one bad alert.** The other five misuses each cost something on their own; routed through an on-call, they also all mint pages that fail the §5 bar, and every such page spends the credibility the one real page depends on. That is why §5 treats its review cadence as first-class work rather than hygiene: it is the only mechanism that pays the debt down before the page that mattered gets closed unread.

**The sawtooth rule generalizes past restarts.** Any remediation that succeeds hides the condition it fixed — that is what success means — so an automated fix without a reviewed counter converts a visible symptom into an invisible trend. The review is deliberately human and deliberately slow: a legitimate scheduled pass (`autonomy-and-rollback.md` §1), because an hour of latency is irrelevant to a trend measured in weeks.

**Dashboard sprawl is §5's demotion rule applied to panels — with a floor.** Demote-don't-delete has a limit: a panel from an archived dashboard belongs in a runbook success check or nowhere. The test for keeping one is the same as for a page — a named question it answers and a named reader who asks it.
