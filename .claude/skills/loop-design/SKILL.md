---
name: loop-design
description: "Design software systems and architecture: architecture-style selection, API design, backend and data modeling, frontend performance, and turning non-functional requirements into numbers and SLO targets. Use when the user asks to design a system or architecture, choose an architecture pattern, design an API this system exposes, model backend data, pick a consistency policy, optimize frontend performance, set NFR or capacity targets, or record architecture decisions as ADRs and C4 diagrams. Works at component granularity on a system not yet built. For executing a release or choosing a rollout strategy for a system already running, use loop-ship. For measuring and alerting on the SLOs of a live service, use loop-operate. For the algorithm inside one component, use loop-algo."
argument-hint: <system>
---

# Designing Systems

You are about to design a system, or one slice of one. The engine is you reasoning from requirements to a defensible architecture — not a template you fill in. Your job is to make the fewest, most reversible decisions that satisfy the requirements, justify each against a named alternative, and record what you chose and why so the next person can undo it.

**The failure mode this skill exists to prevent is premature complexity**: microservices for a three-person team, Kafka for 100 events a day, eventual consistency for a bank balance. Default to the simplest thing that meets the stated non-functional requirements, and make the requirements state themselves before you draw a box.

**Granularity boundary against `loop-algo`.** This skill's deliverable is a box-and-arrow diagram, a contract, or a deployable topology; `loop-algo`'s is a Big-O, a stated invariant, a memory-ordering argument, or a benchmark table. The worked case both skills carry, because it is the one that splits every time: **"shard the queue across N nodes" is `loop-design` — that is topology. "Which lock-free queue structure, and what are its progress guarantees" is `loop-algo` — that is mechanism.** The same feature request produces both, in that order: this skill decides that a queue exists and what crosses its boundary, `loop-algo` decides what runs inside it and proves what it costs.

## Stance on tech stack: principles, not mandates

This skill names concrete tools — Next.js, Postgres, Redis, Kafka, Terraform, GitHub Actions — as **illustrations of a principle**, never as requirements. When you see "cache-aside with Redis," read "cache-aside with whatever KV store the team already runs." Match the user's existing stack and team skills first; reach for a named exemplar only when there is no incumbent and you need a sane default. State the principle, then the exemplar, then the escape hatch.

## The workflow: intake → style → data → API → frontend → delivery → validate → record

Run these steps in order. Skip a step only when the task is scoped to a single slice (e.g. "just design the API") — but even then, read the intake step first, because an API designed without its consistency and NFR context is a guess. Each step names the reference file to open before doing non-trivial work in it.

### 1. Requirements intake

Before drawing anything, extract the constraints that actually decide the architecture. Do not proceed on assumptions — ask when these are unstated:

- **Scale**: requests/sec, data volume, read:write ratio, growth curve. "Design for 10x current, rewrite before 100x."
- **Consistency needs**: which operations must be strongly consistent (money, inventory, auth) vs. which tolerate staleness (feeds, counts, search).
- **Latency & availability targets**: p99 latency, uptime SLO, RTO/RPO. These are the numbers every later decision is validated against.
- **Team & operational reality**: team size, on-call maturity, existing stack, cloud/on-prem, budget.
- **Compliance & data residency**: PII, PCI, HIPAA, GDPR, regional pinning.

Write these down as the brief. Everything downstream cites them. Full intake checklist and how each constraint maps to a decision: **`references/nfr.md`**.

### 2. Architecture style

Choose the coarse shape. **Default: a modular monolith** — one deployable, hard module boundaries inside. It is the highest-leverage default because it preserves the option to extract services later without paying distributed-systems tax now.

Escalate off the default only for a *named, requirements-backed reason*: independent scaling of a hot path, independent deploy cadence for autonomous teams, hard fault isolation, or polyglot needs. When you do split, split along the module seams the monolith already revealed. Decision criteria, the monolith→services extraction path, event-driven vs. request-response, and when serverless earns its keep: **`references/architecture-patterns.md`**.

### 3. Data & consistency

Model the data and pick a consistency policy **per domain**, not globally. The billing domain can be strongly consistent in Postgres while the activity feed is eventually consistent — one system, two policies. Default to a single relational store (Postgres) until a specific access pattern proves it wrong; add a specialized store (search, cache, blob, time-series) only for the pattern that needs it, and own the dual-write consistency problem you just created.

Cover: the domain model, transaction boundaries, per-domain strong vs. eventual consistency, indexing and access patterns, and the outbox pattern for reliable events. Data modeling, sharding, and consistency mechanics: **`references/backend.md`**.

### 4. API design

Design the contract before the implementation. Defaults, each with an escape hatch:

- **Path versioning** (`/v1/...`) — visible, cache-friendly, trivially routable. Escape to header/media-type versioning only when you must version resources independently.
- **Cursor pagination** — stable under concurrent writes; offset pagination silently skips or repeats rows. Escape to offset only for small, static, human-paged datasets.
- **Idempotency on POST** — require an idempotency key on every non-idempotent mutation so retries are safe. Non-negotiable for payments and any at-least-once caller.
- Consistent error envelope, explicit pagination/filtering contract, and auth at the edge.

REST is the default; reach for GraphQL when clients need to shape wildly varying reads, gRPC for internal high-throughput service-to-service. Contract-first workflow, versioning, pagination, idempotency, and error design: **`references/api-design.md`**.

### 5. Frontend & performance

If the system has a UI, decide the rendering strategy against the content, not the trend. Default to server-rendering for content and first-paint-critical pages (Next.js or equivalent), client-side for app-shell interactivity; measure against Core Web Vitals (LCP, INP, CLS), not vibes. Cover: rendering strategy (SSR/SSG/ISR/CSR), the caching hierarchy, bundle budgets, and the data-fetching contract with the API from step 4. Rendering-strategy decision table and performance budgets: **`references/frontend.md`**.

### 6. Delivery shape (a design-time decision, recorded as an ADR)

Decide exactly one thing here: the **coarse delivery shape the architecture must support** — one deployable or many, whether releasing dark has to be possible at all, and the environment topology that implies. That is an architectural constraint on a system not yet built, so **record it as an ADR** (step 8) and stop.

**Every execution question belongs to `loop-ship`** — which rollout strategy to run (rolling, blue-green, canary), the feature-flag plan, expand-contract migration steps, the release checklist and go/no-go, and the tested rollback path. Do not choose a rollout strategy here for a system that already runs; that is `loop-ship`'s call on `loop-ship`'s evidence.

Design-time delivery-shape stub: **`references/deployment.md`**. The mechanics of getting a change to production: **`../loop-ship/`**.

### 7. NFR validation & SLOs

Close the loop: walk back through the design and check it against the numbers from step 1. For each NFR — latency, availability, durability, security, cost — state how the design meets it and where it breaks first (the next bottleneck). Turn the targets into **SLOs with error budgets** and hand measurement, burn-rate alerting and remediation to **`loop-operate`**, name the caching strategy (default **cache-aside**; escape to write-through/read-through only when the access pattern demands it), and identify the failure modes and their mitigations. A design that can't be validated against its NFRs isn't done. Validation checklist, SLO and error-budget **targets**, capacity and cost: **`references/nfr.md`** (caching and resilience patterns live in **`references/backend.md`**, which `nfr.md` delegates to). The measurement, burn-rate alerting and remediation **mechanics**: **`../loop-operate/`**.

### 8. Record the decisions (ADRs + C4)

Emit durable artifacts, not just a chat answer. This is what makes the design reviewable and reversible:

- **One ADR per significant, hard-to-reverse decision** — style, primary datastore, consistency policy, sync-vs-async. Use **`templates/adr-template.md`**: context → decision → alternatives considered → consequences. An ADR names the alternative you rejected and why; that rejection is the most valuable part.
- **C4 diagrams** at two levels: a System Context diagram (**`templates/c4-context.md`**) showing the system, its users, and external systems; and a Container diagram (**`templates/c4-container.md`**) showing the deployable units and their relationships. Stop at container level unless a component is genuinely subtle — over-diagramming rots.

You can render both C4 templates as **Mermaid** diagrams (`C4Context` / `C4Container` diagram types) so they live in the repo as text and version alongside the code.

## Decision router

Jump straight to the slice the user asked for; each row lists the reference and any templates it produces.

| The user wants to… | Start at step | Reference | Emits |
|---|---|---|---|
| Design a whole system / "architect this" | 1 (run all) | all six | ADR + C4 context + C4 container |
| Choose an architecture pattern / style | 2 | `references/architecture-patterns.md` | ADR |
| Design or version an API | 4 | `references/api-design.md` | ADR (if versioning/contract is load-bearing) |
| Model backend data / pick consistency | 3 | `references/backend.md` | ADR |
| Optimize frontend performance | 5 | `references/frontend.md` | — |
| Fix the delivery shape a design must support | 6 | `references/deployment.md`; for executing the release or picking a rollout strategy, `loop-ship` | ADR (design-time shape only) |
| Define NFRs / SLOs / capacity | 1 then 7 | `references/nfr.md`; for measuring and alerting on them, `loop-operate` | — |
| Record a decision or draw C4 | 8 | — | ADR + C4 context/container |

## Execution flags

`--mode <lite|balanced|all-out>` is advertised in this skill's `argument-hint` but **parsed by `loop-engine`, never here**. This skill ships no workflow template — design work runs inline in this session — so there is no mode logic to carry. When the work hands off to a sibling that does run a workflow (`loop-ship` for the release, `loop-operate` for the live service, `loop-algo` for the mechanism inside a component), pass the raw argument string straight through unchanged so the flag reaches the one parser that honours it. See `../loop-engine/references/execution-modes.md`.

## Files in this skill

**References** (open the one for the step you're on; don't work from memory on non-trivial decisions):

- `references/architecture-patterns.md` — style selection, monolith-first, extraction path, event-driven vs. request-response, serverless.
- `references/api-design.md` — contract-first, versioning, pagination, idempotency, error envelopes, REST/GraphQL/gRPC.
- `references/backend.md` — data modeling, transaction boundaries, per-domain consistency, sharding, outbox.
- `references/frontend.md` — rendering strategies, Core Web Vitals budgets, caching hierarchy, data-fetching contract.
- `references/deployment.md` — design-time delivery-shape stub; mechanics live in `loop-ship`.
- `references/nfr.md` — requirements intake, NFR targets, caching, capacity, resilience, cost.
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow

**Templates** (produce concrete artifacts, don't paraphrase them):

- `templates/adr-template.md` — one architecture decision record.
- `templates/c4-context.md` — C4 System Context diagram (Mermaid-renderable).
- `templates/c4-container.md` — C4 Container diagram (Mermaid-renderable).

## Working principles

- **Reversibility is the tiebreaker.** When two options are close, pick the one that's cheaper to undo. Save the irreversible bet for when the requirements force it.
- **Every non-default decision cites a requirement.** "We chose X" is incomplete; "we chose X because the p99 target is 50ms and the default can't hit it" is a decision.
- **Name the next bottleneck.** A good design says where it breaks first and at what scale — that's the trigger for the next iteration, not a flaw.
- **Match the incumbent stack.** The best datastore is usually the one the team already operates well. Novelty is a cost you pay only when the requirements demand it.
