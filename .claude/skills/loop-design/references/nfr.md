# Non-Functional Requirements

The features say what the system does; the NFRs say whether anyone can rely on it. The engine here is a single discipline: **make the requirements state themselves as numbers before you draw a box, then walk the finished design back against each number and name where it breaks first.** "Fast," "reliable," and "scalable" are not requirements — they are wishes until someone writes down *p99 under 200ms*, *99.9% over 28 days*, *10k rps at launch*. A design you cannot validate against its NFRs is not done; it's a hope with a diagram.

Read this on **step 1** of the workflow (turn the brief into numbers) and again on **step 7** (validate the design against them), or when the user asks "what should my SLOs be?", "how many nines do I need?", "will this scale?", "should we build or buy this?", or "how much will it cost to run?". Three things have deeper homes: security threat-modeling in the **loop-review** skill; caching and resilience in `references/backend.md`, with `references/deployment.md` now a stub naming **loop-ship** for rollout and rollback machinery; and **anything whose answer requires reading a live metric** — measuring an SLI, burn-rate alerting, the error-budget policy, instrumentation — in the **loop-operate** skill. This file owns the *targets*.

## Requirements intake: the numbers that decide the architecture

Before any box is drawn, pin down the constraints that actually move the design. Each is a question with a *number* as its answer, and each number forecloses or forces a specific decision. **Do not proceed on assumptions — ask.** An unstated NFR is a decision someone else makes for you at 3am.

| Constraint | The number to pin down | What it decides |
|---|---|---|
| **Scale** | rps now and in 12 months, data volume, read:write ratio | Single node vs. horizontal fleet; whether one store suffices |
| **Growth** | the curve (linear? 10x/yr?) | "Design for 10x current, plan to rewrite before 100x" |
| **Latency** | p50 / p99 / p99.9 per critical path | Sync vs. async, caching tier, colocation, read replicas |
| **Availability** | uptime SLO as a nines target + window | Redundancy, multi-AZ/region, hard-dependency count |
| **Durability** | acceptable data loss (RPO) and recovery time (RTO) | Backup cadence, replication mode, DR strategy |
| **Consistency** | which ops must be strong vs. tolerate staleness | Per-domain consistency policy (see `references/backend.md`) |
| **Throughput bursts** | peak:average ratio, spike shape | Autoscaling headroom, queue buffering, rate limits |
| **Compliance** | PII/PCI/HIPAA/GDPR, data residency | Encryption, audit logging, regional pinning, retention |
| **Team & ops** | team size, on-call maturity, incumbent stack | How much operational surface you can afford to run |
| **Cost ceiling** | monthly budget and/or cost-per-unit target | Managed vs. self-run, instance sizing, architecture ceiling |

The intake output is a one-page brief of numbers. **Everything downstream cites it.** When you later write "we chose X," the sentence is only complete as "we chose X *because* the p99 target is 50ms and the default can't hit it."

## The six pillars: a lens, not a checklist to worship

The AWS Well-Architected Framework's six pillars are a good *review lens* — run the design past each and ask its question. Depth follows below for the ones with real mechanics; treat this as the index.

- **Operational Excellence** — *Can we run, observe, and change this safely?* Everything as code, small reversible changes, observability wired in from day one, post-incident learning without blame. Design time only *requires* instrumentation before launch; the instrumentation, its alerts and the runbooks that consume it belong to the **loop-operate** skill (`../../loop-operate/references/observability.md`), and release machinery to `../../loop-ship`.
- **Security** — *Who can do what, and how would an attacker get in?* Least privilege, defense in depth, encryption in transit and at rest, secrets out of code, an auditable trail. Threat-model it with the **loop-review** skill; do not hand-wave this pillar.
- **Reliability** — *Does it stay up and recover?* Redundancy, no single points of failure, graceful degradation, tested backups, and a rehearsed recovery path (RTO/RPO). See Availability math below.
- **Performance Efficiency** — *Are we using the right resource shapes, and do we know when to change?* Right primitives, measured against SLIs, re-evaluated as load shifts. See Scalability and SLOs below.
- **Cost Optimization** — *Are we paying only for value delivered?* Right-sizing, elasticity to demand, kill idle resources, attribute spend to owners. See Cost below.
- **Sustainability** — *What's the footprint per unit of work?* Maximize utilization, right-size, shape demand, choose efficient regions. Largely the same moves as cost — an efficient system is usually a cheaper *and* greener one; when they diverge, name the trade.

**Failure mode**: treating the pillars as a compliance ritual — a doc that says "yes we considered security" and changes nothing. The lens is only worth running if a pillar's question is allowed to *change the design*.

## Availability math: nines compose, and they multiply the wrong way

Availability is a probability, and probabilities in series multiply. That single fact drives most of the reliability decisions.

| SLO | Downtime / year | / month | / week |
|---|---|---|---|
| 99% (two nines) | 3.65 days | 7.2 h | 1.68 h |
| 99.9% (three nines) | 8.77 h | 43.8 min | 10.1 min |
| 99.95% | 4.38 h | 21.9 min | 5.04 min |
| 99.99% (four nines) | 52.6 min | 4.38 min | 1.01 min |
| 99.999% (five nines) | 5.26 min | 26.3 s | 6.05 s |

**Serial dependencies drag availability down.** A request that must touch five services, each independently 99.9% available, succeeds only when *all five* do: `0.999^5 ≈ 99.5%` — you fell from three nines to barely two by adding hops. Every hard synchronous dependency on a critical path is a subtraction. Fight it by **cutting the number of hard dependencies** (make a dependency non-critical so the request degrades instead of failing), not by demanding impossible nines from each.

**Redundancy multiplies nines back up.** Two independent replicas where either can serve the request fail only when *both* fail: `1 − (0.01 × 0.01) = 99.99%` from two 99% components. This is why redundancy, multi-AZ, and load-balanced fleets buy availability — provided the replicas are genuinely independent (shared dependency = shared failure, and the math evaporates).

**RTO and RPO are the recovery half of availability.** *RTO* (Recovery Time Objective) is how long you may be down after a disaster; *RPO* (Recovery Point Objective) is how much data you may lose. RPO of five minutes forces continuous or near-continuous replication; RPO of a day permits nightly backups. RTO of minutes forces warm standby; RTO of hours permits restore-from-backup. Untested backups have an *infinite* effective RTO: a restore path nobody has exercised is a hope, not a recovery time. What makes a restore "tested" is a recorded, dated drill — the checklist is `../../loop-ship/references/rollback-playbook.md` §2, and `../../loop-ship/references/release-gates.md` treats a current drill record as a release precondition.

**Smell test**: every nine past three roughly 10x's the cost (redundancy, ops maturity, faster detection). If you can't name the business reason a request needs four nines, you're gold-plating. Set the target from what users actually need, then stop.

## Scalability: scale out, and stay stateless so you can

**Vertical scaling** (a bigger machine) is the right *first* move — it's a config change, no distribution tax, and modern hardware is enormous. It has a hard ceiling and a single failure domain. **Horizontal scaling** (more machines) has effectively no ceiling and gives redundancy for free, but only works if the workload is shardable and the processes are stateless.

**Statelessness is the enabler, not a nicety.** A process that keeps request-affecting state in local memory or on local disk can't be load-balanced freely, killed and rescheduled, or cloned behind an autoscaler — any of those loses the state. Push state to a backing service (DB, cache, object store) and the platform can add, remove, and replace instances at will. This is factors 6/9 of the 12-factor app in `references/backend.md`, and it is the precondition for every horizontal-scaling and zero-downtime-deploy move you'll want later.

- **Default**: stateless services behind a load balancer, state in backing services, autoscale on a demand signal (rps, queue depth, CPU). Scale *up* first for simplicity; design *out* from the start so the option exists.
- **Escape hatch**: genuinely stateful workloads (stream processors, in-memory caches, leader-elected coordinators) exist — partition them by key, replicate deliberately, and accept they scale differently from your stateless tier.
- **Failure mode**: sticky sessions and local file writes that quietly make a "stateless" service stateful; the autoscaler adds an instance and users see logged-out sessions or missing files.

Name the scaling axis and the next bottleneck: *"stateless API scales horizontally to ~50 nodes; past that the shared Postgres write path is the ceiling — the trigger to add read replicas, then shard."*

## SLIs, SLOs, and error budgets — setting the target

Design time needs four definitions and one obligation. Everything else about them requires reading a live metric, and therefore belongs to `loop-operate`.

- **SLI** is a measured ratio of good events to valid events. **SLO** is a target for an SLI over a rolling window, set just above what users need and below 100% — 100% is unattainable, infinitely expensive, and leaves no room to ship. **SLA** is the contractual promise, and the internal SLO must be **stricter** than it so you burn your own budget before you breach a customer's. **Error budget** is `100% − SLO` — the failure you are permitted to spend on releases, risky migrations and experiments.
- **The design-time obligation is to choose the number and name the journey it belongs to.** Measuring the SLI, computing burn rate, designing multi-window multi-burn-rate alerts, the error-budget policy that says what happens at 0% budget, and every remediation that follows live in `../../loop-operate/references/slo-model.md` and `../../loop-operate/references/alerting.md`.

**Smell test**: if nobody can say what the SLO *is*, there is no shared definition of "broken," so every incident becomes a debate. Define one SLO per critical user journey before launch, not after the first outage.

## Observability

Observability is a **launch precondition, not a post-launch addition** — a service that ships un-instrumented gets instrumented during its first outage, at the worst possible cost.

Instrument per `../../loop-operate/references/observability.md`, which owns the three signal types, the cardinality trap, the single correlation ID, OpenTelemetry and its pinned Semantic Conventions, and the §5 checklist of what telemetry must carry before alerts can be designed against it.

## Build vs. buy: TCO, lock-in, and maintenance health

For every non-trivial capability — auth, payments, search, queues, feature flags, the observability backend itself — decide **build, buy (managed/SaaS), or adopt (OSS library).** The default is strong: **do not build undifferentiated heavy lifting.** Build only the capability that is your actual reason to exist; buy or adopt everything else. Engineering time spent rebuilding auth is time not spent on the thing customers pay you for.

Evaluate every candidate on three axes, not just the sticker price:

- **Total Cost of Ownership (TCO)** — the sticker price is the smallest term. Add integration, ongoing maintenance and upgrades, on-call and ops burden, scaling cost at your projected volume, and the **opportunity cost** of the engineers tied up. "Free" OSS has a real TCO: you operate it, patch its CVEs, and carry its pager. Buying trades money for engineering time — usually a good trade for anything off your critical path.
- **Lock-in** — the cost to *leave*. Proprietary APIs, data gravity, and proprietary formats all raise it. Mitigate with a **thin adapter at the seam** and open standards (SQL, OTel, S3-compatible APIs) — but don't build a full portability layer for a switch you'll never make; that's its own premature complexity. Accept lock-in *deliberately* when the managed service's leverage clearly outweighs the exit cost, and write down that you accepted it.
- **Community & maintenance health** (for an OSS dependency) — you are betting someone else keeps maintaining it. Check release cadence, security response time, maintainer count (**bus factor**), open:closed issue ratio, last commit, breaking-change history, and the **license** (permissive vs. copyleft vs. source-available with rug-pull risk). Every dependency is also attack surface and a standing upgrade tax — supply-chain risk lives in the **loop-review** skill.

**Smell test**: *"Would I rather my best engineer spend the next quarter building this, or building our product?"* If the honest answer is "build this" only because it's interesting, buy it. Build it because it is the differentiator, or because nothing on the market fits a requirement you can name.

## Cost as a first-class NFR

Cost is an NFR with a number, not an afterthought. Set a **budget and a per-unit target** (cost per request, per tenant, per MAU) so spend scales with value instead of surprising you.

- **Right-size, then autoscale** — most cloud spend is idle over-provisioned capacity. Match instances to real utilization, then let elasticity track demand instead of provisioning for peak 24/7.
- **Pick the pricing model to the workload** — on-demand for spiky/unknown, reserved/committed for steady baseline, spot for interruptible batch. Serverless bills to zero at idle (great for spiky/low-volume) but gets expensive at sustained high volume — know where your crossover is.
- **Watch the silent line items** — cross-AZ and egress data transfer, per-request charges, and storage that only grows because nothing has a retention/tiering policy. Tier cold data to cheaper storage; expire what no one reads.
- **Attribute spend** — tag resources by owner/service so cost has an accountable owner. Unattributed spend never gets optimized.

Cost and Sustainability mostly move together: higher utilization and right-sizing cut both the bill and the footprint. When a reliability or performance target genuinely costs more, that's fine — but *name* the trade so it's a decision, not a drift.

## Pre-sign-off validation checklist

Walk the finished design against this before you call it done. Each unchecked box is a question you're choosing to answer in production.

- [ ] **Every NFR is a number.** Latency, availability, durability, throughput, and cost each have a target from intake — no "fast/reliable/cheap."
- [ ] **Each target maps to a mechanism.** For every number, the design names *how* it's met (this cache, this replica set, this autoscaler) — and **where it breaks first** (the next bottleneck and the scale that triggers it).
- [ ] **Availability math checks out.** Serial critical-path dependencies were counted and multiplied; the composed number meets the SLO, and single points of failure are either removed or consciously accepted.
- [ ] **RTO/RPO have a tested recovery path.** Backups are restored on a schedule, not assumed; failover has been rehearsed against `../../loop-ship/references/rollback-playbook.md` §2's drill checklist, with a dated record.
- [ ] **SLOs and error budgets are defined** per critical journey, stricter than any external SLA. Setting the target is this step's obligation; the burn-rate alerting against it is `../../loop-operate/references/alerting.md`'s and is a launch task, not a design deliverable.
- [ ] **Observability is wired in, not bolted on** — instrumented before launch per `../../loop-operate/references/observability.md`, whose §5 checklist is the acceptance test.
- [ ] **It scales on a named axis.** Stateless where it needs to scale out; the scaling dimension and its ceiling are stated.
- [ ] **Security pillar was actually threat-modeled** (via **loop-review**), not just asserted: authn/z, least privilege, encryption in transit and at rest, secrets externalized, audit trail.
- [ ] **Cost has a budget and a per-unit target**, with spend attributable to an owner.
- [ ] **Build-vs-buy was decided deliberately** for each major capability, with accepted lock-in written down.
- [ ] **The irreversible decisions are captured as ADRs** (`templates/adr-template.md`) — each naming the alternative rejected and why.

If any box can't be checked, the design isn't rejected — it's **unfinished**, and the missing box is the next thing to work on.
