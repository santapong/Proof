# Conducting a venture

The conductor's job is to keep three disciplines running at once: every phase ends in a
**decision document** a human gates (never code), state crosses nodes only through the
`state-contract.md` fold, and every claim in every document is either cited or recorded
as an owned assumption. Lose any one and the conduct drifts into "a big research report"
— which `loop-research` already produces without this skill.

## 1. The phase graph

```
P1 Discovery ──► GATE-1 ──► P2 Vision & Roadmap ──► GATE-2 (kill / pivot / proceed)
                                    │
                     ┌──────────────┼───────────────┐        the parallel band
                     ▼              ▼               ▼
              P3 GTM/Monetize   P4 Build Plan   P5 Deploy Plan
                     │              │               │
                     └───── CHECKPOINT-A fold ──────┘   consistency sweep → Round 2
                     └───── CHECKPOINT-B fold ──────┘   → GATE-3
                                    │
                                    ▼
                     P6 Operate & Improve Plan ──► GATE-4
                          └── roadmap deltas keyed-merged into P2's roadmap[]
```

- **P1 → P2 is sequential**: a vision written before the pains are evidenced is a
  solution in search of a problem (see `discovery.md`'s catalogue).
- **P3 ∥ P4 ∥ P5 is a genuine parallel**: read-heavy, breadth-first work sharing nothing
  but GATE-2's checkpoint — exactly what the shared-state law says to fan out on. Their
  coupling is real but *foldable*: it lives in named fields (`pricing` × `v1Scope` ×
  `deployTarget`), so the two-round checkpoint structure of `state-contract.md` Rule 1
  carries it. P5's weak dependency on P4 is handled by declared `assumptions[]`, not by
  sequencing.
- **P6 is downstream of GATE-3** and closes the loop: its deltas seed the next horizon,
  they do not re-open this one (Rule 2).
- Each phase runs as **one workflow per gate** (H11) so the orchestrating session holds
  every gate. Under `--mode all-out` the §M6 pre-flight prices each phase before
  anything spawns.

## 2. The gates — what the human actually decides

A gate presents the phase's document plus the decision only the human can make. Every
gate decision lands in `decisions[]` (append-only) and in `venture/DECISIONS.md`.

| Gate | After | The decision on the table |
|---|---|---|
| GATE-1 | P1 | Are these the right personas and pains? Redirect research or approve the ranking. |
| GATE-2 | P2 | **Kill / pivot / proceed** — the riskiest-assumption verdict, plus the roadmap horizon. The one gate designed to end the conduct; a venture conduct that cannot be killed here is gate theater. |
| GATE-3 | CHECKPOINT-B | Approve the reconciled trio: `pricing`, `v1Scope`, `deployTarget` must be mutually consistent; the human resolves any conflict the sweep left standing. |
| GATE-4 | P6 | Accept the operating plan and ratify the roadmap deltas as the seeded next horizon. |

## 3. The node loop — every phase runs the same five steps

Authored once in `../templates/venture-node.workflow.js`; the phase playbook supplies the
personas, lenses, and document skeleton.

1. **plan** — one planner scopes the node's questions (planner route: pinned, gates the node).
2. **research** — a `parallel()` fan-out of researchers with **distinct source mandates**
   (all-out: 5; balanced: 3; lite: 1), each under `loop-research`'s law: cited claims,
   graded sources, no synthesis. Blind to each other — a genuine parallel.
3. **discuss** — a `parallel()` panel of 3 perspective agents from the playbook's cast
   (e.g. P3: growth-marketer / CFO-skeptic / support-lead), each arguing its lens over
   the *same* research corpus. Barrier earned (H2): synthesis genuinely needs all three.
4. **synthesize** — one synthesizer folds research + panel into the node's typed state
   slice (H3 schema) and drafts the phase document. Every claim carries a citation or an
   `assumptions[]` entry with an owner — no third state.
5. **verify** — adversarial refute panel: 2 refuters try to demonstrate a specific claim,
   number, or inference is wrong; 1 gating judge (gating route: pinned) rules on the
   surviving disputes. Loop until a clean round, bounded at 2 rounds; re-verify prompts
   carry a round marker (cached prompts replay stale verdicts). REFUTED items are fixed
   or downgraded to owned assumptions; UNVERIFIED is reported, never passed.

## 4. Delegation — each node under its owning law

The node's prompts are authored **against the owning skill's references** (loop-build's
delegated-law move). What has no owner in the fleet gets its law from this skill's own
playbooks — that is why they exist.

| Node | Owning law | New law in this skill |
|---|---|---|
| P1 Discovery | `loop-research` (evidence discipline) | `discovery.md` — elicitation, persona/pain schema |
| P2 Vision & Roadmap | — | `vision-roadmap.md` — objective trees, horizons, kill/pivot criteria |
| P3 GTM / Monetization / Support | `loop-research` (market scans), `loop-scout` (build-vs-buy on GTM tooling) | `go-to-market.md` — positioning, pricing, channels, support |
| P4 Build Plan | `loop-design` (architecture sketch, NFR intake), `loop-scout` (prior art), `loop-build` §1 (the v1 line) | — |
| P5 Deploy Plan | `loop-ship` (rollout, platform), `loop-integrate` (SaaS candidates) | — |
| P6 Operate & Improve | `loop-operate` (SLO sketch, runbook posture), `loop-autopilot` (standing improvement loop design) | — |

**P4's deliverable is a valid `loop-build` brief** — the v1 line in ≤10 gate-checkable
bullets plus deferrals with reasons, NFR targets as numbers, and the architecture sketch.
The contract is directional: this conduct ends where `loop-build` begins; it never starts
building.

## 5. Cross-cutting: legal, and the cite-or-own rule

- Any node that touches data handling, payments, regulated markets, licensing, or
  jurisdiction **appends to `constraints.legal[]`**; the consistency sweep checks every
  band slice against the accumulated entries. Legal is a lens every node carries, not a
  phase — a legal constraint discovered at P5 that P3's channel plan violates is exactly
  what the fold exists to catch.
- **Cite or own**: every quantitative claim in a phase document is either cited to a
  graded source (per `standards.md`'s shelf discipline) or entered in `assumptions[]`
  with an owner and a validation path. A number with neither is a verify-step REFUTED by
  default.

## 6. Venture-conduct failures — the catalogue

Each row is a failure that leaves a plausible document behind — that is what makes it a
conduct failure. The instruments are §2's gates, the state contract's `assumptions[]`
ledger, and the cite-or-own rule.

| Failure — drawback first | Signal in the artifacts | Intervention | Stop the conduct when |
|---|---|---|---|
| **The unkillable venture.** GATE-2 exists to kill; a conduct that treats it as a formality launders an unvalidated premise into five more phases of confident documents. | GATE-2's record shows "proceed" with no riskiest-assumption stated, or the stated one has `status: open` while P3–P6 run anyway. | Halt the band; name the riskiest assumption and its cheapest validation; re-hold GATE-2 with kill and pivot as live options priced next to proceed. | The riskiest assumption is invalidated and no pivot preserves the vision — the correct output of this conduct is a two-page kill memo, and that is a success of the method, not a failure of the run. |
| **Research theater.** Fan-out that returns volume, not evidence: five researchers quoting the same three blog posts is one researcher with confidence. | `evidence[]` entries cluster on identical sources across researchers; the refute panel keeps winning on "the source does not say that". | Re-run research with disjoint source mandates enforced in the prompts (channels, primary data, competitor artifacts, practitioner forums — not "the web" five times). | Primary sources for the segment genuinely do not exist — the venture needs field discovery no agent can do; record it as the gating open assumption and park at GATE-1/GATE-2. |
| **Consensus panel.** A discuss panel whose three perspectives agree in round one has not discussed; a perspective that never dissents is dead weight wearing a persona. | Panel outputs are mutually paraphrasable; the synthesizer's document cites no disagreement; `conflicts[]` is empty across BOTH checkpoints of the band. | Recast the panel with the playbook's opposed personas and require each to name what the others got wrong; an empty `conflicts[]` after recast must be justified line-by-line at the gate. | — (this one always repairs; an honestly empty conflict set after a genuine recast is a legitimate, if rare, outcome the gate can inspect) |
| **Assumption laundering.** A claim enters P1 as an assumption and exits P4 as a fact, upgraded by repetition across documents instead of by evidence. | An `assumptions[]` entry with `status: open` is stated without qualification in a later phase document; the citation trail for a number dead-ends in an earlier phase's own output. | The verify step refutes any unqualified claim whose only source is upstream state; restore the assumption marker and its owner in the document text itself. | The venture's core economics rest on open assumptions after GATE-3 — the trio was approved on air; re-open GATE-3 rather than proceed to P6. |
| **The band that would not fold.** Band nodes re-negotiating with each other through prompt references to the run's transcript, or a conductor "helpfully" passing one node's Round-1 draft into another's Round-1 prompt. | Node prompts reference sibling outputs outside the checkpoint objects; conflicts surface in Round 1 that only a fold could legitimately reveal. | Strip the side-channels; re-run Round 1 blind from GATE-2's checkpoint alone. Adaptation happens at CHECKPOINT-A or it is not deterministic under resume. | — (always repairable: the fold structure is the fix) |
| **Horizon creep.** The roadmap's "now" absorbs "next" during the band — P4 plans milestones GATE-2 never approved, and the v1 line quietly becomes a v2 line. | `v1Scope.in` items trace to `roadmap[]` entries with `horizon: next\|later`; the deferral list shrinks between GATE-2 and GATE-3 with no `decisions[]` entry. | Diff `v1Scope` against the approved horizon at CHECKPOINT-B; every crossing item is ratified at GATE-3 as a recorded rescope or pushed back — no third state. | The human will not ratify the drifted horizon: the venture being planned is not the one approved at GATE-2. Re-hold GATE-2 with the new shape. |

The shared shape: a confident document over an unread instrument. And the repair-vs-stop
line is loop-build's, transposed — **repair fixes the phase; killing fixes the venture.**
A kill verdict is always delivered at a human gate, priced against pivot and proceed,
never silently mid-band.
