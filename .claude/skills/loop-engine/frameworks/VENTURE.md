---
name: VENTURE
summary: Full product-lifecycle framework — six gated phases (Discovery → Vision & Roadmap → a GTM/Build/Deploy parallel band → Operate & Improve) producing verified decision documents, not code.
when-to-use: Venture-scale asks that start before engineering — validating a pain, deciding what to build and how to monetize it — conducted by loop-venture. Prefer AIDLC when the ask arrives as a software task with the product decisions already made.
---

# VENTURE — Venture Lifecycle

Six phases, every one ending at a **human gate** over a decision document. Phases 3–5 run
as a parallel band synchronized only through checkpoint folds (the typed-state law of
`loop-context`); the method depth lives in `loop-venture`'s references — this file is the
phase skeleton the engine maps onto. The deliverable of every phase is a document plus a
typed state slice; no phase writes product code.

## Phase: Discovery

- **Purpose**: Evidenced personas and a ranked pain list — proof somebody hurts, per `loop-venture/references/discovery.md`.
- **Entry criteria**: A venture idea or brief from the user.
- **Agent activities**: One planner; researchers with disjoint source mandates (complaint mining, workaround pricing, adjacent-tool autopsy, demand signals, a disconfirming sweep) returning cited, schema-shaped evidence; a three-persona discuss panel; one synthesizer; an adversarial refute panel.
- **Orchestration hint**: `parallel()` for the research fan-out and the panel — both barriers earned (H2): synthesis genuinely needs all mandates and all perspectives at once. Verify is a guarded loop, ≤2 rounds (L1).
- **Exit gate (human)**: GATE-1 — are these the right personas and pains? Deliverable: the discovery document with its assumption ledger.

## Phase: Vision & Roadmap

- **Purpose**: A falsifiable vision, objective tree, now/next/later roadmap, riskiest assumption, and written kill/pivot criteria, per `loop-venture/references/vision-roadmap.md`.
- **Entry criteria**: GATE-1's approved checkpoint.
- **Agent activities**: The same five-step node loop; the discuss cast is founder / skeptical-investor / veteran-operator.
- **Orchestration hint**: Same shape as Discovery; research is lighter (it re-reads P1's evidence before fetching more), so a smaller fan-out is honest, not a silent cap — `log()` the width either way (H6).
- **Exit gate (human)**: GATE-2 — **kill / pivot / proceed**, priced side by side, plus the roadmap horizon. The one gate designed to end the conduct.

## Phase: Go-to-Market

- **Purpose**: Positioning, pricing model with owned assumptions, channels, support plan, per `loop-venture/references/go-to-market.md`.
- **Entry criteria**: GATE-2 = proceed; runs in the band with Build Plan and Deploy Plan.
- **Agent activities**: Five-step node loop; discuss cast growth-marketer / CFO-skeptic / support-lead; `loop-scout` verdicts on GTM tooling arrive as inputs.
- **Orchestration hint**: Band nodes are a genuine `parallel()` — read-heavy, sharing nothing but GATE-2's checkpoint. Round 1 ends at a fold + consistency sweep (CHECKPOINT-A); Round 2 (synthesize + verify) consumes the folded state. No mid-band peeking — the fold is the only channel (`loop-venture/references/state-contract.md`).
- **Exit gate**: Automatic into the CHECKPOINT-B fold; the human gate is the band's shared GATE-3.

## Phase: Build Plan

- **Purpose**: A loop-build-ready brief — the ≤10-bullet v1 line with deferrals, NFR targets as numbers, architecture sketch — under `loop-design`'s and `loop-build` §1's law.
- **Entry criteria**: GATE-2 = proceed; band member.
- **Agent activities**: Five-step node loop; research includes prior-art scouting; synthesis emits `v1Scope` and `nfrs[]`.
- **Orchestration hint**: As Go-to-Market — band member under the same two-round fold discipline.
- **Exit gate**: Automatic into CHECKPOINT-B → GATE-3.

## Phase: Deploy Plan

- **Purpose**: Deployment target, cost model, rollout posture — `loop-ship`'s method applied at plan time; SaaS candidates via `loop-integrate`'s lens.
- **Entry criteria**: GATE-2 = proceed; band member. Weak dependency on Build Plan is carried as declared `assumptions[]`, reconciled at the folds — never by sequencing the band.
- **Agent activities**: Five-step node loop; synthesis emits `deployTarget` and appends `constraints.legal[]` (data residency).
- **Orchestration hint**: As Go-to-Market. GATE-3 (human) closes the band: pricing, v1 scope, and deploy target must be mutually consistent, with surviving `conflicts[]` decided by the human.
- **Exit gate (human)**: GATE-3 over the reconciled trio.

## Phase: Operate & Improve

- **Purpose**: SLO sketch, support/feedback loop, standing-improvement design, and roadmap deltas that seed the next horizon — `loop-operate`'s and `loop-autopilot`'s method at plan time.
- **Entry criteria**: GATE-3 approved.
- **Agent activities**: Five-step node loop; synthesis keyed-merges deltas into `roadmap[]` — deltas are ratified at the gate, they never re-run Vision inside this conduct.
- **Orchestration hint**: Single node, `pipeline()` through its five steps; no band, no barrier to earn.
- **Exit gate (human)**: GATE-4 — accept the operating plan and ratify the seeded roadmap deltas.
