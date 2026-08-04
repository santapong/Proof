---
name: loop-comprehend
description: "Understand an existing codebase and recover what was never written down: map the as-built architecture from code, trace how a feature actually flows end to end, build an onboarding dossier for an unfamiliar repo, and reverse-engineer ADRs for decisions the record never captured — every claim anchored to a file:line. Use when the user asks how a codebase or subsystem works, to explain or map an unfamiliar repo, to trace a feature or request path, to onboard onto a project, or to recover why the code is the way it is. The subject is code that already exists. For designing a system or making a new architecture decision, use loop-design. For turning findings into maintained documentation that ships in the repo, use loop-docs. For the impact and risk of a specific change set or diff, use loop-audit. For explaining one observed defective behavior, use loop-debug."
argument-hint: <repo-or-subsystem> [--mode <lite|balanced|all-out>]
---

# Codebase Comprehension

**If the question is "how does this existing code work, or why is it the way it is," it is this skill.** If the system does not exist yet and the question is what it *should* be, that is `loop-design`. If the deliverable is a document the repo keeps and maintains, that is `loop-docs` — this skill produces the *understanding* it formats. If the subject is a specific change set, that is `loop-audit`; a specific failing behavior, `loop-debug`.

The governing rule, and the one every trap in `references/comprehension-traps.md` violates: **a claim about a codebase carries a `file:line` or it is a guess.** A map assembled from directory names and README prose describes the system its authors intended, not the one that runs. Every deliverable here is evidence-anchored and states its own coverage — what was read, what was sampled, what was not looked at.

**Execution flags.** `--mode <lite|balanced|all-out>` is parsed by `loop-engine`, never here — pass the raw argument string through. See `../loop-engine/references/execution-modes.md`.

## 1. Name the question

Four jobs, one section each. If the ask spans several (typical for "help me onboard"), run §2 first — the others consume its map.

| Ask | Job | Section |
|---|---|---|
| "How is this repo/subsystem put together?" · "map the architecture" | **Architecture recovery** | §2 |
| "How does feature X actually work?" · "trace this request/path" | **Feature tracing** | §3 |
| "Why is it built this way?" · "recover the decisions" · no ADRs exist | **Decision recovery** | §4 |
| "Get me productive on this repo" | **Onboarding dossier** | §5 |

## 2. Architecture recovery — `references/architecture-recovery.md`

Recover the **as-built** architecture: extract evidence from the code, abstract it into components and relations, present it in the repo's documentation convention (here: C4, `.mmd` → `.svg`).

- Work **hypothesis-driven**, not exhaustive: form a model from the entry points and the dependency graph, then read to confirm or refute it. Reading every file front-to-back does not scale and produces notes, not a map.
- Extract from **load-bearing artifacts first**: build files, entry points, route/handler registries, schema definitions, CI config. They are smaller than the code and harder to let rot.
- Record **as-built vs. as-documented drift** explicitly. Where the README and the imports disagree, the imports win — and the disagreement itself is a finding.

## 3. Feature tracing — `references/feature-tracing.md`

Follow one behavior from its entry point to its observable effects, across every boundary it crosses.

- Anchor the trace at both ends first — the entry point (route, CLI arg, event subscription) and the effect (row written, message emitted, pixel drawn) — then close the middle. A trace grown only forward from the entry point dies in the first dispatch table.
- At every **indirection** (DI container, event bus, dynamic dispatch, config-selected implementation), record *how you resolved it* — that resolution is exactly what the next reader cannot do in their head.
- Prefer **runtime evidence** where static reading is ambiguous: run the code, log the path, read the test that exercises it. A test is a trace someone already wrote down.

## 4. Decision recovery — `references/decision-recovery.md`

Reverse-engineer the ADRs nobody wrote: find decision sites in the code, reconstruct the decision and its likely rationale from evidence, and grade each reconstruction's confidence.

- **Decision sites** are where an alternative visibly lost: a dependency in the manifest, a schema shape, an architectural seam, a pattern applied repo-wide, a config default. Each is a decision *made*, whether or not it was ever *taken* consciously.
- Every recovered ADR separates **what the code shows** (cited) from **what is inferred** (marked), and carries a confidence grade — `evidenced` / `inferred` / `speculative`. A recovered rationale asserted as fact is fabricated history; the grade is what keeps the dossier honest.
- Mine the **record before the code**: `git log` on the decision site, the PR that introduced it, the issue it closed. A commit message is a primary source; a plausible story is not.
- The output is ADR *content*, in the repo's ADR format (Nygard fields; MADR where the repo uses it) — hand the write-up and its maintenance to `loop-docs`, and any *re-deciding* to `loop-design`.

## 5. Onboarding dossier — `references/architecture-recovery.md` §Dossier

The composite deliverable: the §2 map, one or two §3 traces of the repo's central feature, the §4 decisions a newcomer would otherwise trip over, plus the operational facts (how to build, test, run — verified by running them, not quoted from the README).

Scope it to the reader's **first task**, not to completeness. A dossier is progressive disclosure for a human: the ten things that unlock the repo, each with a pointer deeper, ordered by what they need first.

## 6. State your coverage

Every deliverable ends with a coverage statement: what was read in full, what was sampled, what was skipped, and which claims rest on runtime evidence vs. static reading vs. inference. **A map that does not state its coverage claims more than it knows** — this is the skill's non-negotiable, same rule as the engine's "log anything a cap drops."

## Orchestration

Inline for a single subsystem or one trace — comprehension work is cheap to read and expensive to fragment. For a whole-repo map or dossier, `templates/comprehend.workflow.js` fans out one mapper per dimension (structure, runtime flow, data, dependencies, decision sites), verifies each claim's cited evidence, and synthesizes the dossier — the synthesis barrier is earned (H2): the dossier needs every dimension's confirmed claims at once to reconcile them.

## Reference files

- `references/architecture-recovery.md` — the extract → abstract → present method, hypothesis-driven reading, drift recording, the dossier structure
- `references/feature-tracing.md` — both-ends anchoring, indirection resolution, runtime vs. static evidence, tests as recorded traces
- `references/decision-recovery.md` — decision-site catalogue, the evidence/inference split, confidence grades, mining git history, the handoff to loop-docs and loop-design
- `references/comprehension-traps.md` — the failure catalogue: how comprehension work convinces and is still wrong
- `references/standards.md` — the pinned authorities, graded, with the confirmation log
- `templates/comprehend.workflow.js` — whole-repo fan-out: per-dimension mappers, evidence verify, dossier synthesis
