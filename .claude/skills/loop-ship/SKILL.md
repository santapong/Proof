---
name: loop-ship
description: "Plan and execute getting a change safely to production: rollout strategy (rolling, blue-green, canary), feature-flag plan, expand-contract migrations, the release checklist and go/no-go, a tested rollback path, and DORA measurement. Use when the user asks how to ship, release, roll out, or deploy a change, whether to canary or blue-green it, how to run a zero-downtime schema migration, how to roll back, or how to build a release checklist. For choosing a delivery architecture for a system still being designed, use loop-design and record it as an ADR. For watching SLOs and auto-remediating after the rollout has baked, use loop-operate. For assessing what is in the release and how risky it is, use loop-audit."
argument-hint: <change> [--mode <lite|balanced|all-out>]
---

# Shipping a change

## 1. The predicate: you own the window from deploy start to bake complete

**From the moment a deploy starts until the bake completes, the rollout belongs to this skill; after the bake, the service belongs to `loop-operate`.** That temporal line is the discriminator, not the vocabulary — canary, SLO, burn rate, and rollback all appear on both sides of it, and the only reliable test is whether something is *currently being promoted*. If a ramp is in flight, it is yours. If nothing is being promoted and the question is "is this service healthy," it is `loop-operate`'s.

The second line is mechanism versus trigger: **this skill authors the rollback mechanism and proves it works — the button. `loop-operate` owns the signal that presses it unattended — the wire.** You define the ramp schedule and the abort criteria; `loop-operate` supplies the SLI those criteria are evaluated against and the autonomy level at which the abort may fire without a human.

| If the ask is… | Go to | Because |
|---|---|---|
| "what *is* a canary / which delivery shape should this system have?" | `loop-design` (step 6) and an ADR | The system is still being designed; delivery shape is an architectural constraint, not a release in flight. |
| "watch the SLOs / auto-remediate / who is on call" | `loop-operate` | Nothing is being promoted; this is perpetual steady state. |
| "what is in this release and how risky is it?" | `loop-audit` | Backward-looking over a diff. Its risk rating is an *input* to §2 below — consume it, do not re-derive it. |
| "prod is broken right now and users are affected" | `loop-incident` | Declared, live, user-facing harm. Mitigate before anything else. |

You are the first link of the handoff chain and the last: the original ship, then — after `loop-operate` detects, `loop-incident` mitigates, `loop-debug` root-causes and `loop-test` regresses — the fix goes back out through here. You are never the incident-handling middle.

## 2. Pick the strategy for *this* change

Do not start from the strategy menu; start from the risk of being wrong about **this specific change**. Read the risk rating that `loop-audit` already produced (or produce one by invoking `loop-audit` first) and take it as the input to the decision tree.

- The Risk → strategy table, the mechanics of rolling / blue-green / canary, the recreate anti-pattern, the four feature-flag kinds and flag hygiene, IaC, and environment topology: **`references/rollout-strategies.md`**.
- The decision tree that consumes the audit rating and lands on one strategy: **`references/release-gates.md`** §"Choosing the strategy for this change".

**House default: rolling for the routine change, canary + feature flags for the high-risk one.** Escalating past rolling costs real machinery — name the risk that bought it. If the strategy choice was itself high-stakes, record it as an ADR via `../loop-design/templates/adr-template.md`.

## 3. Run the go/no-go gate

The release-readiness gate is an **AND across independent lenses, and any hard-fail vetoes** — six clean dimensions do not outvote one missing rollback proof. The dimensions are CI/test status, migration expand-step state, feature-flag wiring, rollback-path evidence, supply-chain attestation, and SLO/error-budget headroom.

The full pre-deploy checklist, what counts as *evidence* rather than a claim on each dimension, the CI/CD pipeline read as the gate chain, and the sign-off rule: **`references/release-gates.md`**.

The one rule worth stating in the router: **a rollback path with no evidence is a failed gate, not a passed one.** "We can roll back" is an assertion; a dated drill record is evidence. See §6.

## 4. Promote on SLO burn, not on a timer

A canary that advances because five minutes elapsed is a slow rolling deploy. Each rung of the ramp is gated on the canary's error-budget burn rate, with an explicit promote / hold / abort rule, a named override authority, and a stated choice between auto-aborting and paging.

Burn-rate thresholds per rung, the promote-vs-hold-vs-abort logic, and who may override: **`references/release-gates.md`** §"SLO-gated promotion".

**This file owns the promotion procedure; it does not own the targets.** The SLOs and error budgets the thresholds are evaluated against live in `../loop-operate/references/slo-model.md`. If you find yourself deciding what the availability target *should be*, you have crossed into `loop-design` (target-setting at design time) or `loop-operate` (steady-state ownership).

## 5. Gate the artifact, once, before promotion

The ship-time supply-chain gate is **a binary pass/fail on ONE artifact about to be promoted**: is the provenance attestation present and verified against this build's hash, is the SBOM current and diffed against the last release, is the signature valid. It is not a survey and it is not a judgment call.

Procedure, hard-block vs advisory failures, and the mid-promotion escalation path: **`references/supply-chain-gate.md`**.

That file opens by separating three moments that use the same standards, because confusing them is the most common way this gate gets mis-scoped: `loop-scout` asks *should we adopt this dependency at all* before the code is written; `loop-review` asks *is this dependency healthy* on a diff or a repo; you ask *does this build carry valid provenance right now*. Same standards, three different questions.

## 6. Decide rollback vs roll-forward deliberately

Reverting is usually right and occasionally impossible. The decision turns on four factors — data mutation already committed, expand-contract stage (**you cannot roll back past a contract step**), blast radius already exposed, and time-to-fix-forward versus time-to-revert.

Decision factors, the per-strategy rollback **drill** checklist with its has-this-actually-been-exercised verification step, and the narrow cases where roll-forward wins: **`references/rollback-playbook.md`**.

Migration sequencing — which deploy in the release carries expand, which carries contract, and the gate that blocks contract until every consumer is confirmed off the old shape: **`references/migrations.md`**.

## 7. Instrument the release

Tag every shipped change with the DORA keys so the release loop itself is measurable: deployment frequency, lead time for changes, change failure rate, failed deployment recovery time. Per-release instrumentation, the honest caveats about which metrics are stable and which are being piloted, and what feeds back to `loop-audit`: **`references/dora.md`**.

`loop-audit` already claims change-failure-rate as part of its own reason to exist. **You instrument it per release; you do not re-derive its framing.**

## 8. Handoff

**The moment a shipped change causes live, user-facing harm, hand to `loop-incident`.** Not when it looks bad — when users are affected. Your own rollback-vs-roll-forward call in §6 is for a deploy caught failing *its own gate* during the ramp, before that handoff is needed. Once an incident is declared, mitigation sequencing, comms, and the postmortem belong to `loop-incident`; you come back only for the redeploy of the fix.

Once the bake completes and the ramp is at 100% with no rollback pending, close the release and hand steady-state ownership to `loop-operate`.

## 9. Orchestration: size-gate first

**A single-service, low-risk change with a green pipeline is a checklist you run inline in this session — do not spin up agents for it.** Reach for the workflow when the gate is genuinely wide: a multi-service release, a migration-carrying release, a change `loop-audit` rated high risk, or a release where any gate dimension needs independent evidence-gathering.

For those, run **`templates/release-readiness-gate.workflow.js`** — one checker agent per gate dimension in parallel, an earned barrier that merges the six verdicts into a single release picture, an adversarial re-derivation of any gate that passed on thin evidence, and a synthesized go / no-go / go-with-conditions naming the blocking gate. Invoke the `loop-engine` skill to author and execute the run; flag parsing (`--mode`, `--planner`) is delegated to `loop-engine` and this skill carries no mode logic of its own.

## Reference files

- `references/rollout-strategies.md` — deploy-vs-release, the three strategies plus the recreate baseline, the Risk → strategy table, feature-flag kinds and hygiene, IaC, environment topology, exemplars
- `references/migrations.md` — expand-contract sequencing across a real release, and the gate that blocks contract
- `references/release-gates.md` — the pre-deploy checklist, the strategy decision tree, the CI/CD gate chain, SLO-gated promotion, sign-off
- `references/supply-chain-gate.md` — the ship-time artifact gate: provenance, SBOM diff, signature; hard-block vs advisory; escalation
- `references/rollback-playbook.md` — rollback-vs-roll-forward decision factors, per-strategy drill checklists, recording the outcome
- `references/integration-train.md` — many task branches → one gated merge candidate → develop: when a train pays, the procedure, and the rules that keep it short-lived
- `references/dora.md` — the four keys, per-release instrumentation, and what is stable versus piloted
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to gate time
- `templates/release-readiness-gate.workflow.js` — checker-per-gate-dimension → barrier → adversarial verify → go/no-go decision
