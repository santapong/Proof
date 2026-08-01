# The typed-state contract

State that crosses an agent or phase boundary is a **contract**, not a message. This file
gives the contract's four clauses, the handoff discipline, and the rule for when not to
fan out at all. The engineering source is LangGraph's state model (typed state, per-field
reducers, checkpointing); the clauses below are that design restated for this plugin's
`Workflow` primitives, where state lives in script variables between `agent()` calls.

## Clause 1 — typed, schema'd, named

Anything a downstream agent consumes is a named object with declared fields — never prose
to re-parse. This is harness policy **H3** at the multi-step scale: `agent()` already
forces structured returns via `schema`; the state object is where those returns
accumulate, and it deserves the same discipline. Declare its shape once, at the top of
the script, as a comment block naming every field, its type, and its merge rule.

## Clause 2 — every field declares its merge rule

The moment two writers can touch a field in the same round (a `parallel()` fan-out, a
pipeline with concurrent items), the field needs a declared merge:

| Merge rule | Semantics | When |
|---|---|---|
| **last-write-wins** | New value replaces old | Single logical writer; status fields. Must be *chosen*, not defaulted into. |
| **append** | Values accumulate into a list | Findings, proposals, evidence — anything where losing an element is a defect. |
| **keyed-merge** | Upsert by a declared key | Per-item records (the AP7 coverage map is one: keyed by area, merge = increment). |
| **reduce** `(a, b) -> c` | Custom fold | Counters, maxima ("risk is the WORST rating any lens gave, never the average"). |

A field with concurrent writers and no declared rule is a latent race that will present
as a heisenbug in a long run. In script terms: never `state.x = v` from inside mapped
thunks; collect returns from `parallel()`/`pipeline()` and fold them at the join, where
the merge rule is visible in one place.

## Clause 3 — checkpoint at phase boundaries

Persist the state object at every `phase()` boundary — in-script, this means the phase's
fold produces one serializable object before the next phase reads it; in a resumed run,
`resumeFromRunId` replays cached agent results, and a clean per-phase state object is
what makes the *meaning* of those results replayable rather than re-derived. Two rules:

- The checkpoint is the **only** thing the next phase reads. If phase N+1 needs something
  phase N knew but didn't checkpoint, that is a contract defect in phase N, not a reason
  for N+1 to go re-read raw material.
- Checkpoints are **append-only across phases** (phase 2's object extends phase 1's, it
  does not rewrite it) — the delta discipline of `supersession.md`, applied to state.

## Clause 4 — the handoff carries decisions, not just tasks

Parallel workers are context-fragmented by construction: each sees its task line, none
sees the others' reasoning. The documented failure (Cognition) is two workers making
*individually reasonable, mutually incompatible* implicit decisions. The mitigation is in
the handoff: pass down the **decision record** — constraints already chosen, conventions
already fixed, interfaces already agreed — not the task sentence alone. Where the work
product must cohere stylistically or architecturally, add a reconcile step at the join
rather than hoping the workers guessed alike.

## When not to fan out

Fan out on **read-heavy, breadth-first** work — search, review lenses, independent
audits — where workers share nothing but the question. Keep **write-heavy,
tightly-coupled** work in one context: read actions parallelize inherently; write actions
carry implicit decisions, and conflicting implicit decisions are the failure mode. Mixed
tasks split into a parallel read phase and a sequential write phase. (This is the state-
level restatement of harness policy H2's earned barrier: the question is not "can these
run at once" but "do they share decisions".)

## Anti-patterns

- **Prose relay** — agent A returns paragraphs, agent B is prompted with them, meaning
  drifts at each hop. Fix: schema on every consumed result (H3), typed state between.
- **The implicit blackboard** — many closures mutating one object mid-fan-out. Fix:
  fold at the join (Clause 2).
- **Checkpoint-by-transcript** — treating the run's log as the state ("it's all in the
  transcript"). The transcript is evidence for §6's invariants, not a contract: nothing
  downstream can consume it reliably.
- **Re-derivation** — phase N+1 re-reads raw inputs because the handoff was thin. Cost
  is not just tokens: two phases can now disagree about ground truth (Clause 3).
