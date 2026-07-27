# C4 — the skill fleet

Nineteen skills, drawn at two altitudes.

**One diagram per skill would be nineteen copies of the same picture.** Every skill has an identical internal structure — router, references, template — which is drawn once below as the *skill container view* and explained in [`skill-anatomy.md`](skill-anatomy.md). What actually differs between skills is their **relationships**: who delegates to whom, and where each one stops. So the per-skill views are grouped by role, and each shows the edges that make its members distinct.

---

## The skill container view — true for all nineteen

Zoom into any single skill and this is what you find. The three parts are separate **because they load differently**, which is the constraint the whole design turns on.

```mermaid
C4Container
    title Container diagram — inside any one skill

    Person(dev, "Developer", "Invokes the skill")

    System_Boundary(skill, "A skill — .claude/skills/<name>/") {
        Container(router, "SKILL.md", "Markdown + YAML frontmatter, 6–13 KB", "Thin router. Its description is the sole input to skill selection; its body is a numbered flow that points at references rather than inlining them. Loaded into agent context on EVERY invocation")
        Container(refs, "references/*.md", "Markdown, 5–7 files, ~100 KB", "The deep knowledge, including a version-pinned standards.md. Loaded ON DEMAND — costs nothing until the router asks")
        Container(tmpl, "templates/*.workflow.js", "Plain JavaScript", "A runnable multi-agent script. EXECUTED by the Workflow tool, never read into agent context")
    }

    System_Ext(host, "Claude Code", "Selects the skill, loads context, runs the Workflow tool")
    System_Ext(law, "Governance", "harness H1–H12 · loop L1–L8 · modes M1–M9")
    System_Ext(gate, "scripts/validate.mjs", "CI — fails the build on a contract breach")
    System_Ext(fleet, "Claude Model Fleet", "The agents the template spawns")

    Rel(dev, host, "Types /loop-<name>")
    Rel(host, router, "Matches on description, loads body", "Markdown")
    Rel(router, refs, "Reads only what this task needs", "Markdown")
    Rel(router, tmpl, "Authors from", "JavaScript")
    Rel(law, router, "Binds", "read-only")
    Rel(host, tmpl, "Executes in a sandbox with no FS, clock or modules", "Workflow tool")
    Rel(tmpl, fleet, "Spawns agents at the tier ROUTES selects", "agent() opts")
    Rel(gate, router, "Validates frontmatter, name, paths", "CI")
    Rel(gate, tmpl, "Validates H10 rules and ROUTES byte-identity", "CI")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

The asymmetry is the point: **the router is charged on every invocation, the references are charged only when read, and the template is never charged at all** — it runs somewhere the agent's context does not reach.

---

## Engine & planning

The base layer. Everything else authors through `loop-engine`; `loop-skill` authors the skills themselves.

```mermaid
C4Component
    title Component diagram — Engine & planning

    Container_Boundary(g, "Engine & planning") {
        Component(eng, "loop-engine", "Orchestration engine", "Authors and runs the workflow script — pipeline, parallel, loop")
        Component(orch, "loop-orchestrate", "Planning layer", "Decomposes a project into a task DAG; routes a model to each node")
        Component(mk, "loop-skill", "Meta", "Authors a conforming skill directory and proves it with the gate")
    }

    Component_Ext(law, "Governance", "harness · loop · modes · AIDLC", "Read-only law")
    Component_Ext(audit, "boundary-audit.json", "Normative", "The 19-skill scope matrix")
    Component_Ext(gate, "validate.mjs", "CI gate", "Rejects a contract breach")
    Component_Ext(all, "The other sixteen skills", "Domain skills", "Author through the engine")

    Rel(law, eng, "Governs shape and routing")
    Rel(orch, eng, "Hands over the DAG to execute")
    Rel(all, eng, "Author their templates against")
    Rel(mk, audit, "Registers a new boundary in")
    Rel(mk, law, "Authors templates against")
    Rel(mk, gate, "Proves conformance with")
    Rel(mk, all, "Creates and repairs")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Where each stops.** `loop-orchestrate` plans and never runs; `loop-engine` runs one task now. `loop-skill` changes what Claude *knows how to do* — `loop-harness` changes what it is *permitted* to do.

---

## Design & mechanism

Three altitudes on "how should this be built", separated by the shape of the deliverable.

```mermaid
C4Component
    title Component diagram — Design & mechanism

    Container_Boundary(g, "Design & mechanism") {
        Component(design, "loop-design", "Architecture", "Deliverable: a box-and-arrow diagram, an API contract, an ADR, NFR and SLO targets")
        Component(algo, "loop-algo", "Mechanism", "Deliverable: a Big-O, an invariant, a memory-ordering argument, a benchmark table")
        Component(pat, "loop-pattern", "Refactoring", "Deliverable: a behaviour-preserving diff")
    }

    Component_Ext(ship, "loop-ship", "Release", "")
    Component_Ext(ops, "loop-operate", "Steady state", "")
    Component_Ext(test, "loop-test", "Tests", "")
    Component_Ext(rev, "loop-review", "Review", "")
    Component_Ext(scout, "loop-scout", "Prior art", "")

    Rel(design, algo, "Mechanism inside a component")
    Rel(design, ship, "Execution machinery lives there")
    Rel(design, ops, "Measuring the targets lives there")
    Rel(rev, pat, "Findings become remediation")
    Rel(pat, test, "Behaviour preservation proved by")
    Rel(algo, test, "Correctness oracle")
    Rel(scout, pat, "Already-adopted dependency, so idiom not selection")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**The tests.** Boxes and contracts → `loop-design`. A complexity bound or an invariant → `loop-algo`. A diff whose test suite passes unchanged before and after → `loop-pattern`. *Shard the queue across N nodes* is design; *which lock-free queue and what are its progress guarantees* is mechanism.

---

## Build & verify

Everything that inspects or proves code. The split is the **artifact each produces**.

```mermaid
C4Component
    title Component diagram — Build & verify

    Container_Boundary(g, "Build & verify") {
        Component(test, "loop-test", "Tests", "Deliverable: test files that run and fail for the right reason")
        Component(rev, "loop-review", "Security + quality", "Deliverable: a findings list. Judges; never refactors")
        Component(aud, "loop-audit", "Change impact", "Deliverable: a backward-looking risk memo over a diff")
        Component(dbg, "loop-debug", "Root cause", "Deliverable: a minimal fix + regression. Requires a REPRODUCIBLE defect")
    }

    Component_Ext(pat, "loop-pattern", "Refactoring", "")
    Component_Ext(ship, "loop-ship", "Release", "")
    Component_Ext(inc, "loop-incident", "Live failure", "")
    Component_Ext(algo, "loop-algo", "Mechanism", "")

    Rel(aud, rev, "Security dimension")
    Rel(aud, ship, "Risk memo as go/no-go input")
    Rel(rev, pat, "Each smell class points at its remediation")
    Rel(inc, dbg, "Service restored — now find the defect")
    Rel(dbg, test, "Lock the fix with a regression")
    Rel(dbg, algo, "Never fast enough, rather than got slower")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

**The tests.** Findings list or diff? → review vs pattern. Backward over a diff, or forward over a rollout? → audit vs ship. Can you paste a stack trace? → debug. Is the service *down*? → incident, not debug.

---

## Integrate & ship

Both face outward — one at someone else's API, one at production.

```mermaid
C4Component
    title Component diagram — Integrate & ship

    Container_Boundary(g, "Integrate & ship") {
        Component(intg, "loop-integrate", "Platform integration", "Obeys someone else's contract and defends against it: OAuth/OIDC, webhooks, idempotency, retry and backoff")
        Component(ship, "loop-ship", "Release", "Deploy start to bake complete: rollout strategy, flags, expand-contract migrations, tested rollback, DORA")
    }

    Component_Ext(scout, "loop-scout", "Prior art", "")
    Component_Ext(test, "loop-test", "Tests", "")
    Component_Ext(design, "loop-design", "Architecture", "")
    Component_Ext(aud, "loop-audit", "Change impact", "")
    Component_Ext(ops, "loop-operate", "Steady state", "")

    Rel(scout, intg, "Provider already named — stop re-litigating the choice")
    Rel(intg, test, "Specifies the contract; loop-test authors the files")
    Rel(design, intg, "Publishes an API; loop-integrate consumes one")
    Rel(aud, ship, "Backward-looking memo feeds the forward-looking gate")
    Rel(ship, ops, "Bake complete — the service is yours")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**The tests.** Does answering add a line to the dependency manifest? → `loop-scout` first, then `loop-integrate`. Does this system *publish* the API or *consume* it? → design vs integrate. Idempotency appears in both, as different obligations: design requires callers to send a key, integrate requires this system to send one.

---

## Run & respond

The thinnest boundary in the fleet, held apart by one checkable predicate.

```mermaid
C4Component
    title Component diagram — Run & respond

    Container_Boundary(g, "Run & respond") {
        Component(ops, "loop-operate", "Steady state", "AUTOMATED mitigation of KNOWN conditions: SLIs, SLOs, error budgets, burn-rate alerts, self-healing runbooks, SLO-gated auto-rollback")
        Component(inc, "loop-incident", "Exception state", "HUMAN-COORDINATED mitigation of NOVEL failures: triage, comms, mitigate before diagnosing, reproduction, postmortem")
    }

    Component_Ext(ship, "loop-ship", "Release", "")
    Component_Ext(dbg, "loop-debug", "Root cause", "")
    Component_Ext(auto, "loop-autopilot", "Autonomous loop", "")
    Component_Ext(harn, "loop-harness", "Claude's harness", "")

    Rel(ship, ops, "Rollout baked — hands the service over")
    Rel(ops, ship, "Owns the SIGNAL that presses the rollback button ship authored")
    Rel(ops, inc, "No runbook, or impact beyond its scope")
    Rel(inc, dbg, "Service restored — hand the defect over")
    Rel(ops, auto, "Cites the autonomy ladder; never redefines it")
    Rel(harn, ops, "May deploy a runbook's schedule — composition, one-directional")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**The predicate, stated as the first sentence of both bodies:** *does a runbook exist for this condition, **and** does executing it restore the SLI?* Yes → `loop-operate`, no declaration. No, or the impact exceeds the runbook's scope, or a human must be paged → `loop-incident`. Only `loop-incident` writes postmortems.

This pair ships **on probation**: a review tripwire fires if either skill's body spends more than ~30% of its length restating the other's phase, on the grounds that one honest skill beats two fighting for the same trigger.

---

## Knowledge & automation

Cross-cutting support, plus the loop that composes everything.

```mermaid
C4Component
    title Component diagram — Knowledge & automation

    Container_Boundary(g, "Knowledge & automation") {
        Component(res, "loop-research", "Cited research", "Search fan-out → deep-read → refute-first verify → cited synthesis")
        Component(scout, "loop-scout", "Prior art", "Build-vs-buy BEFORE building; terminates at a named recommendation")
        Component(docs, "loop-docs", "Documentation", "Diátaxis; for a HUMAN READER seeking understanding")
        Component(harn, "loop-harness", "Claude's harness", "Permissions, hooks, MCP, schedules — what Claude is PERMITTED to do")
        Component(auto, "loop-autopilot", "Autonomous loop", "Reads feedback, acts on a branch, opens DRAFT PRs. Never merges")
    }

    Component_Ext(design, "loop-design", "Architecture", "")
    Component_Ext(inc, "loop-incident", "Live failure", "")
    Component_Ext(mk, "loop-skill", "Meta", "")
    Component_Ext(many, "Domain skills", "review · test · debug · docs · scout · design · audit", "")

    Rel(scout, res, "Delegates its searching")
    Rel(docs, design, "Consumes the ADR / C4 it emits")
    Rel(inc, docs, "Postmortem prose pass — incident owns the timeline")
    Rel(harn, auto, "Unattended substrate")
    Rel(auto, many, "Composes")
    Rel(mk, harn, "Permitted-to-do vs knows-how-to-do")
    Rel(mk, docs, "Gate-checked directory vs prose for a reader")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

**The tests.** A runbook is markdown but its steps are *executed*, possibly unattended — that is `loop-operate`, not `loop-docs`. A postmortem belongs to `loop-incident`, which owns the timeline data. `loop-research` gathers evidence for any question; `loop-scout` answers one specific question — should we build this — and delegates its searching here.

---

**See also:** [Context (L1)](context.md) · [Container (L2)](container.md) · [Component (L3)](component.md) · [skill anatomy](skill-anatomy.md) · [the normative boundary matrix](../design/boundary-audit.json)
