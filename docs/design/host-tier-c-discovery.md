# H2 — Tier C discovery: the three hosts' programmable multi-agent surfaces

**Status:** design note, not a promise · **Researched:** 2026-08-04 · **Milestone:** ROADMAP Track 2, H2

Tier C asks whether a Proof multi-agent run — fan-out, phases, gates, budget — can execute under a target host's *own* orchestration. At H0 the answer was "unknown for all three." As of August 2026 it is **known, and it is "possible in principle, expensive in practice, on every host"**: all three now expose a programmable multi-agent surface, and none of them executes a `*.workflow.js` script, which is the only form Proof's 28 templates exist in.

**Evidence grade for everything below:** secondary — vendor announcements as covered by press and community documentation, read 2026-08-04. None of it was verified against a running host (none is installed on the research machine). Every claim here is **re-confirm-before-implementing**, the same discipline the ROADMAP's target matrix already carries for config paths. Version numbers and dates are what the coverage stated, not what a hands-on session confirmed.

## Per-host findings

### Cursor — the closest analogue

- **What exists (as reported):** Cursor 3.x (April–May 2026) rebuilt around agent orchestration: "Build in Parallel" spawns N subagents from one prompt, each with its own context window; background/cloud agents run in isolated VMs and report back asynchronously. The **Cursor SDK** (public beta, reported 2026-04-29) exposes the same runtime — subagent orchestration, MCP, Skills, Hooks — as a **programmable TypeScript package**.
- **What Tier C would take:** a translation layer from Proof's template shapes (pipeline / earned-barrier parallel / guarded loop, `optsFor` routing, schema-forced results) onto SDK primitives. TypeScript SDK + JS templates is the smallest conceptual gap of the three. The hard parts are semantic, not syntactic: Proof's determinism rules (no clock/random, resume-from-cache) and its schema-validated `agent()` results have no stated SDK equivalent, and model routing would route among *Cursor's* model set — the ROUTES block's Claude tiers do not transfer, which is a policy question (what does `gating: max-effort` mean on another vendor's fleet?) before it is a code question.
- **Verdict:** *feasible as a dedicated adapter project; not a packaging task.* This is the host to attempt first if Tier C is ever attempted.

### OpenAI Codex — parallel fan-out, thinner programmability

- **What exists (as reported):** Multi-Agent v2 in Codex CLI v0.137 (reported June 2026): one session spawns a team of role-defined agents (**TOML-defined roles**), runs them in parallel (~6 threads by default per community documentation), and consolidates results. Orchestration is configuration-plus-prompt, not a scripting runtime.
- **What Tier C would take:** compiling each workflow's *static structure* into TOML role definitions. Anything dynamic — loop-until-dry with a seen-set, budget-guarded loops, mid-run re-routing, earned barriers with cross-item reduces — has no reported expression: the consolidation model is "wait for all, then merge," which is precisely the unearned barrier H2's own governing policy prices. A faithful port would need an external driver process re-invoking Codex per phase, at which point Proof would be *bringing* the orchestrator rather than using the host's.
- **Verdict:** *partial at best.* Static fan-out/consolidate workflows could compile; the guarded-loop and pipelined-verify shapes that carry most of Proof's value could not, on what is reported today.

### Google Antigravity — a parallel universe, not a gap

- **What exists (as reported):** Antigravity 2.0 (I/O 2026, May 19): squads of role-composed subagents (researcher / planner / coder / reviewer / ops), scheduled background tasks, an Agent Manager surface, and five distribution shapes — desktop, `agy` CLI, SDK, Managed Agents API, enterprise.
- **What Tier C would take:** Antigravity's orchestration model is *role-squad composition* under its own manager, not user-authored control flow. Proof's phase/gate/budget discipline would have to be re-expressed as squad configuration plus its Artifacts-based verification — a redesign per workflow, not a translation, and against the youngest and fastest-moving surface of the three (2.0 shipped ten weeks before this note).
- **Verdict:** *not a port target today.* Re-evaluate when the SDK surface stabilizes; a redesign attempted now would chase a moving API.

## What this means for the open decisions

- **ADR-0010 (whether Proof grows its own orchestrator for Tier C hosts):** this note's answer is **not now, and never per-host**. Three adapters against three moving, semantically different surfaces is unpayable maintenance for a two-person-hour-budget repo. If Tier C is ever pursued, it is one host (Cursor, via its SDK) as a standalone experiment — and the experiment's first deliverable is discovering which of Proof's guarantees (determinism, schema-forced results, earned barriers, mode routing) survive translation, because a port that loses the governance is just prompts.
- **Tier C stays Claude-Code-only** in the support matrix, stated as a fact about the templates ("target Claude Code's `Workflow` tool"), not as a limitation of the hosts — the hosts have orchestration; they do not have *this* orchestration contract.
- **The model-routing question is host-independent and unresolved:** every ROUTES block routes Claude models by name. Any Tier C attempt on any host must first decide what the routing policy *means* off-fleet. That decision belongs in an ADR, not in an emitter.

## Confirmation obligations

Before any milestone builds on this note: install the host, and re-confirm (1) the orchestration surface still exists in the shape described, (2) its concurrency and consolidation semantics, (3) the SDK's stability tier. The sources this note rests on are press and community coverage of vendor announcements, collected 2026-08-04; treat every specific (version numbers, thread counts, dates) as a lead, not a fact.
