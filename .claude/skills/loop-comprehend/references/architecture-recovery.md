# Architecture recovery — mapping the system that actually runs

Recovering an architecture from code is a distinct discipline from designing one, and the literature has a name and a shape for it: **extract → abstract → present** (Ducasse & Pollet's process-oriented taxonomy — see `standards.md`). Every recovery pass, however informal, does those three things; doing them *deliberately* is what separates a map from an impression.

## The three steps

### 1. Extract — gather evidence, cheapest first

Evidence sources, in rising cost and rising fidelity:

| Source | Cost | What it proves |
|---|---|---|
| Build & manifest files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`) | Minutes | The real dependency set, the entry points the build knows about, the tooling |
| Directory & module layout | Minutes | The *intended* decomposition — a hypothesis, not a fact |
| Entry points: `main`, route tables, CLI arg parsers, event subscriptions, cron/service definitions | Small | Where control genuinely enters — the roots every trace hangs from |
| Import/dependency graph between modules | Small–medium | The *actual* decomposition; where it disagrees with the directory layout, it wins |
| Schema definitions, migrations, message contracts | Medium | The data model as enforced, not as described |
| CI config and test layout | Medium | What the authors considered worth protecting, and how the system is actually exercised |
| Runtime traces: logs of a real request, a debugger walk, a profiler snapshot | High | The one source that cannot describe a system that does not run |

**Load-bearing artifacts first.** Build files, entry points, registries and schemas are small, mechanically parseable, and rot slower than prose — they are constraint surfaces the code cannot casually violate. A recovery that starts from the README starts from the least reliable artifact in the repo.

### 2. Abstract — form the model hypothesis-first

Do not read the codebase front to back. It does not scale, and it produces notes rather than a map. Instead:

1. **Form a hypothesis** from the extraction layer: "this looks like N components with these responsibilities, communicating this way."
2. **Predict what the hypothesis implies** — "if the `billing` module is really isolated, nothing outside it imports its internals."
3. **Read to confirm or refute the prediction** — one grep answers the isolation question; reading the module does not.
4. **Revise and repeat** until the model survives its own predictions.

This is Naur's point made operational: a program *is* the theory its maintainers hold, and recovery is rebuilding that theory — which means testing it, not accumulating text. A hypothesis that survives three refutation attempts is a component boundary you can draw; one you never tested is a directory name you copied.

**Choose an abstraction target before abstracting.** "Map the architecture" is underspecified; ISO 42010's frame is the useful one — an architecture description answers *specific stakeholders' concerns* through *viewpoints*. Pick the concern first: deployment topology, module dependency structure, data flow, and failure domains are four different maps of the same code, and a map drawn for no concern answers none.

### 3. Present — in the repo's convention, with drift marked

- Present in the documentation convention the repo already uses. In this fleet's repos that is **C4** with diagrams as `.mmd` → `.svg` (see the docs convention); a container diagram plus one component diagram per concern is usually the whole deliverable.
- **Every box and every arrow cites its evidence** — the file:line, the manifest entry, the trace that shows the call actually happens. An arrow you believe but cannot cite goes in dashed, labeled `inferred`.
- **Record as-built vs. as-documented drift as first-class findings.** Where the README, an old diagram, or a stale ADR disagrees with the imports, the imports win — and the disagreement is one of the most valuable things the recovery produces, because it marks exactly where the previous theory of the system died. List each drift: the documented claim, the evidence against it, and which artifact should be corrected (hand that correction to `loop-docs`).

## Boundaries to check, not assume

The abstraction step's standard hypotheses, each with its one-step check:

- **Layering** — "the domain layer doesn't import the web layer": grep the imports upward.
- **Module isolation** — "only the public surface is imported from outside": grep for deep imports.
- **Ownership of data** — "only service X writes table T": grep for the table name / model class across the repo.
- **Synchronous vs. async seams** — "these components only talk via the queue": grep for direct client construction across the seam.

Each check is one grep. A recovered architecture is precisely the set of such claims that survived their grep.

## §Dossier — the onboarding deliverable

The dossier is the composite the router's §5 names: recovery + traces + decisions + operations, scoped to a reader's **first task**. Structure that has worked:

1. **The one-paragraph theory** — what the system is, in the terms its own code uses.
2. **The map** — the container diagram, every element carrying its evidence pointer.
3. **The central trace** — the repo's most representative feature, end to end (`feature-tracing.md`), because one worked trace teaches the idiom every other path follows.
4. **The recovered decisions a newcomer trips over** (`decision-recovery.md`) — usually three to five: the odd dependency, the surprising seam, the pattern the repo enforces.
5. **Operations, verified** — build, test, run, *executed during the recovery*, with the actual commands and their actual output. A dossier that quotes the README's install steps unverified inherits the README's rot.
6. **The coverage statement** — read in full / sampled / skipped, and per-claim evidence class (runtime / static / inferred). Non-negotiable (router §6).

Order by what the reader needs first, and keep each item one screen with a pointer deeper — progressive disclosure for a human, the same regime this plugin's own routers use for a model.

## When recovery is not the job

- The map is wanted so a **change** can be assessed → the map is input; the deliverable is `loop-audit`'s.
- The map reveals the architecture should *change* → recovery ends at the finding; the re-decision is `loop-design`'s, with the recovered ADRs as its context.
- The map is wanted as **permanent repo documentation** → recover here, then hand the artifact to `loop-docs` to fit the doc set and stay maintained.
