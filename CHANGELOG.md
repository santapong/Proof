# Changelog

All notable changes to Heimdall (formerly TheLoopSkill; renamed 1 Aug 2026) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **The 4+1 views, and a re-rendered diagram set.** New [`docs/views/4plus1.md`](docs/views/4plus1.md) adds Kruchten's four views plus scenarios, chosen because C4 is structural and says nothing about the three questions this system keeps raising: what runs concurrently and where it blocks (**process** — a sequence diagram showing that authoring is sequential and in-context, fan-out is capped and pipelined, and the gate blocks on a *human*), what a contributor edits and which gate catches them (**development** — the three gates and what each is blind to), and what process executes where (**physical** — almost everything local, `heimdall-mcp` a stdio child that dies with the session, exactly one network hop per agent node, and a dashed box for the unproven other-host case). Plus a **logical** view grouping the 22 skills by role under the governance layer, and four **scenarios** — one of which deliberately ends in a CI failure, because a scenario that only shows the happy path is decoration. The doc states how 4+1 and C4 overlap and which wins where they do.
- **Diagrams updated to match the code.** `container.mmd` gains the two containers the Level 2 diagram never had — **`heimdall-mcp`** (shipped in 2.0.0) and the generated **Host Packs** — and its stale counts are corrected (21 → 22 skills, 105 → 112 references, 27 → 28 templates); `context.mmd` gains the other-host target and drops the pre-rename "TheLoopSkill" title both diagrams still carried. A **shared visual grammar** now runs across every diagram — stereotype, palette, and the rule that generated and unverified things are dashed — documented in `docs/c4/README.md` alongside a measured note on **why these are styled flowcharts rather than mermaid's `C4Container` syntax**: the native renderer was tried on the Context diagram and produced 1151 × 2056 px for ten elements, one shape per row, with labels overlapping the shapes they described. Notation compliance beats DSL compliance. All 18 diagrams re-rendered; the mermaid-cli version drift also touched SVGs whose sources did not change.
- **Stale counts corrected across the docs** — the fleet has been twenty-two since 2.0.0, but "nineteen"/"twenty-one" survived in `docs/c4/README.md`, `docs/c4/skills.md`, `docs/c4/container.md` (93 → 112 reference files) and `docs/design/README.md` (the boundary audit's matrix has 22 rows). `docs/c4/container.md` also loses the "diagram lag" note added in H1, now that the diagram is no longer the stale copy. ADR prose is left alone on purpose: an ADR records what was true when it was decided.
- **H1 — every dangling pointer closed, and the check promoted to a gate.** ADR-0008 gains **§D8.9**: a held-back skill's *reference files* may be carried into a pack, its `SKILL.md` never. Two modes — `copy` (verbatim, behind a generated "carried without its skill" notice) and `stub` (the pointer resolves to a page explaining why the content is absent). Applied to the three classes the H0 gate found: `loop-autopilot/references/deployment.md` is **carried**, so a packed `loop-operate` keeps the autonomy ladder's single definitional home; `loop-engine/references/execution-modes.md` is **stubbed in place**, so the 13 mode-dial pointers resolve to an honest explanation rather than routing advice for models the host does not run; and `loop-engine`'s `harness-policy.md` + `loop-policy.md` are **carried**, which let `loop-orchestrate` keep its slot — its planning half (steps 1–8) is separable from the execution step already dropped. All 32 cross-skill pointers per host now resolve, so `check-host-packs.mjs` treats a dangling pointer as a **failure** instead of a warning, and enforces the D8.9 allowlist in both directions. `INSTALL.md` gains **§4 — Other hosts**, marked *in progress* with the honest caveats (18 of 22 skills, no multi-agent execution, absolute MCP launch path, and the Cursor shortcut plus the tripled-load trap it must avoid); its "No `.gitignore`, on purpose" section is corrected rather than contradicted — `dist/` is ignored, `node_modules` deliberately still is not, because ADR-0002 §D2.2 keeps `git status` as the only detector of a stray `npm install`. Residue after H1: five prose lines per host, one of which is a source defect rather than a packing one (`loop-pattern/references/design-patterns.md` still carries a "Drafting notes for the caller" block with a stale `/mnt/data/company/…` path).
- **H0 — the host-packaging seam.** [`docs/design/ADR-0008-host-packaging-seam.md`](docs/design/ADR-0008-host-packaging-seam.md) (**Proposed**, needs a ruling) plus the tooling it specifies: `scripts/host-targets.json` (data-only descriptors for Cursor, OpenAI Codex and Antigravity — skills paths, MCP config format, the held-back list, the closed rewrite-rule list, each rule carrying the clause that authorises it), `scripts/pack-host.mjs` (generates `dist/<host>/`, Node stdlib only), `scripts/check-host-packs.mjs` (the D8.8 gate, wired into `.github/workflows/validate.yml`), and a first `.gitignore` covering `dist/`. Three findings drive the ADR, all measured on this tree: **four skills are host-native by subject, not by accident** — `loop-engine`, `loop-harness`, `loop-skill`, `loop-autopilot` — so a pack carries **18 of 22 skills**, not 22; **generated trees must not live at the paths hosts auto-discover**, because Cursor also reads `.claude/skills/`, `.codex/skills/` and `.agents/skills/`, and a Cursor session in this checkout would otherwise load every skill three times; and the **509 Claude-model-name references are not the obstacle they look like** — all but two prose files sit inside the 28 `*.workflow.js` templates, which no non-Claude pack ships. Nothing in `.claude/skills/` changed: the source tree is untouched and remains the only place a skill is edited. **Gate run on this tree (Node 22):** three packs, 18 skills and 111 files each, deterministic, no forbidden token, no template survivor, every degraded skill carrying its banner — green. Its residue report then found 32 dangling cross-skill pointers per host in three classes (the autonomy ladder's definitional home now sits in a held-back skill; 13 mode-dial pointers; `loop-orchestrate`'s 16 references into `loop-engine`), recorded as open questions on the ADR rather than fixed silently, because each is a decision. They block publishing a pack, not the seam.
- **`ROADMAP.md`.** The **host-portability** track, milestones H0–H5: run Heimdall outside Claude Code, first three targets **Cursor, OpenAI Codex, Antigravity**, with a per-host support tier (A skills load / B MCP tools reachable / C multi-agent execution) and a generated-per-host packaging seam so `.claude/skills/` stays the single source of truth and host #4 costs a checklist. The roadmap records what does *not* port — the 28 `*.workflow.js` templates target Claude Code's `Workflow` tool and no target host has a known equivalent, which is an open discovery task (H2), not a promise. Host config paths in the target matrix are dated 2 Aug 2026 and marked re-confirm-before-implementing. README gains a Roadmap section, a `mcp/` row in the repository layout (previously missing), and a contents entry.

### Changed
- **GitHub repository renamed: `santapong/TheLoopSkill` → `santapong/Heimdall`** — the last identifier still carrying the old name (deferred at the v1.5.0 plugin rename because only the repo owner can click it). GitHub redirects the old URL and old git remotes indefinitely, so existing clones keep working; `plugin.json` homepage/repository, README, and INSTALL now point at the new URL. The local directory path `/mnt/data/company/TheLoopSkill` is unchanged (a filesystem path, not an identifier the plugin publishes).

## [2.1.0] — 2026-08-02

### Added
- **Engine & Planning category deepened (passes 19–21, closing the 22-skill sweep)** — 6-agent verified workflow held to the governance-layer bar: every policy citation checked against H1–H12/L1–L8, execution-modes.md, the named templates, and the commit record. `loop-engine/harness-policy.md` closes with the **waste catalogue** — six shapes that pass every rule *as it is actually checked* and still waste the run (the unearned barrier priced, the redundant-lens vote, the starved fan-out, the verifier-payload wiring bug this repo itself shipped, the guessed-target brief, the trend-blind series) — deliberately unnumbered so the five files citing "H1–H12" stay true. `loop-orchestrate/task-decomposition.md` §9 gains the decomposition-failure catalogue (noun splits, false parallels, over-decomposed slivers, undefined interfaces, phantom edges, routing-tier mismatch, the unpriced repair round). `loop-build/conduct.md` §6 gains the conduct-failure catalogue (gate theater, repair creep, the UNVERIFIED pile as a debt ledger, ledger blindness, scope drift, the rubber-stamped gate). The engine verifier corrected the draft's own citation of this repo's history twice — including softening a causal claim the commit record does not support — the catalogue's discipline applied to the catalogue itself.
- **Autonomy/Meta category deepened (passes 15–18)** — 8-agent verified workflow with repo-history verification: writers/verifiers checked claims about this plugin's own record against CHANGELOG and scripts before asserting them. `loop-autopilot/comprehension-rot.md` gains the six distribution-drift trends (D1–D6) only the weekly digest reader can see — shrinking diffs, doc-only streaks, same-file fixation, trust accretion, risk-class migration, cheap-but-mergeable — each plotted from data the loop already emits, with the anti-Goodhart rule that you adjust the pressure, never punish the symptom (the verifier corrected the auto-merge mechanism claim against canary-merge.workflow.js line 181 before landing). `loop-harness/hooks.md` gains the guardrail misuse catalogue (deny-vs-ask via the one-way-door test, CI duplication, the SessionStart tax, routine asks, allowlist rot, the untraceable deny). `loop-skill/authoring.md` gains the failure catalogue anchored to defect classes this plugin actually shipped (rejected once by its verifier and rebuilt). `loop-context/trace-invariants.md` gains the violation catalogue — each invariant's concrete failure shape in a real trace.
- **Knowledge category deepened (passes 12–14)** — 6-agent verified workflow, all three landed verifier-revised with placements line-verified: `loop-research/source-evaluation.md` gains the source-failure catalogue (citation-laundering chains — count origins, not repetitions; misattributed numbers — trace-to-primary-or-drop; vendor benchmarks as claims by an interested party; churnalism; roundup selection bias; recency-authority confusion; the confident preprint) plus the degraded-claim recording table (unverified-as-of-date discipline); `loop-docs/doc-types.md` §12 gains the rot catalogue (how each doc type dies) with the intro roadmap updated to three parts; `loop-integrate/webhooks-and-idempotency.md` §6 gains the failure-shape catalogue (forged events, double charges, retry storms, sandbox lies, refresh races, silent sunsets), strictly delegating mechanics to the sections that own them.
- **Operate category deepened (passes 9–11)** — one failure catalogue per skill via a 6-agent verified workflow (all three landed verifier-revised; the alerting draft was rejected and rebuilt; two target files were re-routed by the verifiers to the right siblings): `loop-ship/rollout-strategies.md` gains "How a green rollout lies" (starved and unrepresentative canaries, bake-vs-incubation, blue-green's instant switch over a shared schema, flag debt, rollback theater, promotion on the absence of alerts) placed inside the file where its cross-references resolve; `loop-operate/alerting.md` §6 gains the alerting misuse catalogue (cause-based paging, alert fatigue, wrong burn-rate windows, descriptive runbooks, self-healing that masks decline, dashboard sprawl); `loop-incident/incident-command.md` §7 gains the response anti-pattern catalog (diagnosing before mitigating priced rather than restated, the hero debugger, ETA promises, root-cause-singular, thrash-switching, the action-item graveyard).
- **Verify category deepened (passes 5–8)** — one drawback-first catalogue per skill, drafted by an 8-agent verified workflow (all four landed verifier-revised; the review draft was rejected outright and rebuilt): `loop-review` gains the false-positive taxonomy (five shapes that convince and are not findings — dead-code sink, sanitizer-upstream, framework-mitigates, config-not-code, wrong-trust-boundary — each with its kill-check, and the rule that an unrun kill-check caps confidence below 0.8); `loop-test` gains the test-smell catalogue (mock-echo, change-detector, shared-fixture coupling, sleep-based async, the 100%-coverage trap) plus the fake > stub > mock ladder; `loop-debug` gains the anti-pattern catalogue (shotgun, symptom-fix, Heisenbug capture-don't-interrupt, confirmation-bias localization, the cannot-reproduce tripwire, fix-without-regression-test); `loop-audit` gains the blast-radius underestimation catalogue (flag flips, dependency bumps, schema migrations, shared-utility edits, contract changes, "dead"-code deletion, CI-script edits) closing on the worst-plausible-reader rule. Verifier catches this round included near-verbatim duplication of severity-model.md's escape hatches and a backwards claim about which review phase kills sloppy matches.

## [2.0.0] — 2026-08-01

### Changed — BREAKING
- **MCP server renamed: `theloopskill-mcp` → `heimdall-mcp` (server 0.1.0 → 0.2.0)** — the rename deferred at the plugin rename lands with MCP Phase 4. Server id in `.mcp.json` and the plugin manifest, `serverInfo.name`, the stderr prefix, the tool-name prefix (`mcp__heimdall-mcp__*`), and the resource URI scheme (`heimdall://…`) all change together. Any project `.mcp.json` or permission allowlist naming the old id must be updated. ADR-0001 keeps the old name — a decision record states what was decided at the time.

### Fixed
- **`THELOOPSKILL_ROOT` → `HEIMDALL_ROOT`** — the env var escaped the 0.2.0 rename. `HEIMDALL_ROOT` is the name; the old variable still boots the server for one major as a deprecated alias, announced once on stderr at startup. Every fix/error message now names the new variable.
- **C4 docs de-staled** — the "nineteen skills" counts across context/README/skill-anatomy/skills (the refresh deferred since v1.4.0's known-stale note) updated to twenty-two.

### Added
- **`loop-frontend` deepened (Design & Mechanism pass 4, closing the category)** — `motion-toolkit.md` gains the situation→mechanism selection table (CSS transition/keyframes/View Transitions/scroll-driven/WAAPI/library, each defended against its neighbours), the property-before-mechanism rule with the thread story told correctly, the interruptibility tie-breaker (transitions retarget cleanly; keyframes snap — a hover on `@keyframes` is a bug you can feel), and the SSR/hydration cost split; `choreography.md` gains the easing/duration misuse catalogue in detection-signal-before-fix shape. The toolkit verifier rejected its draft outright (ok=false) and rebuilt it, killing real compositor folklore: a rAF library does NOT composite like CSS — CSS/WAAPI transform/opacity runs on the compositor thread and survives main-thread jank, a library writes styles from JS every frame.
- **`loop-pattern` deepened (Design & Mechanism pass 3)** — three references gain drawback-first material via the same 6-agent verified workflow (all three drafts landed verifier-revised): `design-patterns.md` §6 misuse-cost catalog (nine popular patterns: what each is for, the misuse that ships, its daily cost, and the modern-language construct that usually suffices) plus the Decorator/Proxy/Adapter/Facade wrapper line-up with the only diagrams in the file; `refactoring-catalog.md` §6–7 tie-break table and inverse pairs (refactoring has a reverse gear; reflex in one direction is a style tic, and every extraction adds a name the reader must resolve forever); `solid-and-style.md` §5 over-application table — one entry per letter with detection signal and walk-back, closing on principles as pressure gauges, not laws. Verifier catches this round: a Smalltalk-closures factual error, a miscounted table, a cross-skill precedent misattribution.
- **`loop-algo` deepened (Design & Mechanism pass 2)** — three references gain selection-first, drawback-first material, drafted by a 6-agent Heimdall workflow (3 writers + 3 adversarial verifiers; every draft was revised by its verifier before landing — dedup against `randomized-structures.md`, three unearned Θ-bounds downgraded to what the pinned standards actually prove, numbers aligned across sibling files): `complexity-and-structures.md` §7–9 situation→structure→why-not-the-runner-up catalogue + probabilistic/storage-engine drawback profiles; `concurrency.md` §8 mechanism selection table with false sharing as the failure mode of the fixes and the sharding rule; `benchmarking.md` §7 pitfalls catalogue, detection-signal before fix.
- **`loop-design` architecture catalogue deepened** — `references/architecture-patterns.md` grows from 6 to 11 patterns: CQRS, event sourcing, sagas (orchestration vs choreography with the rule of thumb), backend-for-frontend, and strangler-fig migration join the set, every pattern now carrying a Mermaid shape sketch plus explicit benefits / drawbacks / failure modes, and the situation→style decision table gains five rows. First pass of the Design & Mechanism deepening series.
- **The repo eats its own harness** — `.claude/hooks/` + wired `settings.json`, installed per `loop-harness`'s skill-hook catalogue rows: never-end-red (`stop-gate.sh` — a session leaving skills/mcp/scripts dirty cannot stop while the validation gate is red), and ask-on-one-way-doors (`harness-guard.py` — editing harness config or pushing `main` surfaces an explicit ask, never a deny). Plus two slash commands: `/gate` (all three gates, one report) and `/release <version>` (the whole release procedure, including the semver sanity check).
- **MCP Phase 4** — the intra-package carve-out flagged by Phase 3 S1 is codified: ADR-0002 gains the dated addendum (`node:`-prefixed **or** relative-inside-`mcp/`), and `validate.mjs` gains **CHECK 9**, mechanically failing any bare/scoped specifier or any relative import escaping `mcp/`. Live-verified over stdio after the rename: initialize handshake echoes `heimdall-mcp 0.2.0`; `route_node(gating, adversarial-verify, all-out)` → `claude-opus-5/max`, width 5, governing clause cited, all citations on the `heimdall://` scheme.

## [1.6.0] — 2026-08-01

### Added
- **`loop-harness/references/skill-hooks.md`** — the per-skill hook catalogue: all twenty-two skills walked, each rule graded into mechanize-as-a-project-hook (7 rows, with events and deny/ask semantics), belongs-in-CI-or-the-engine, or must-stay-judgment. Deployment rule: per-project, selective, one incident earns one hook — never plugin-global.

## [1.5.0] — 2026-08-01

### Added
- **`loop-context`** — the twenty-second skill: engineer what an agent carries at runtime. Context budgets (plan for 10–20% of the advertised window) and placement (the U-curve, compounding across hops), compaction under the addressable-store rule (nothing compacted out may be destroyed), a typed shared-state contract (per-field merge rules, phase-boundary checkpoints, decision-carrying handoffs), supersession discipline (two-timestamp facts, delta-not-rewrite, the purge caveat), and four homegrown property-based trace invariants with an evidence-anchored audit template (`context-audit.workflow.js`). Two-way boundary pointers added to `loop-engine` and `loop-harness`; boundary audit gains the row and three rated overlaps. Standards shelf pins the peer-reviewed anchors (TACL 2024, NeurIPS 2024, COLM 2024, ICML 2025, ICLR 2025, Findings of ACL 2026, ICSE 2026) and marks the 2026 preprint cluster as unreplicated.

- **`loop-ship/references/integration-train.md`** — the missing step between parallel task branches and `develop`: cut `integration/<milestone>`, merge wagons in declared dependency order, run the full gate once on the train, land as one reviewed unit. Names when a train is NOT worth it (file-disjoint work with a cheap gate) and the drop-a-wagon revert rule.

### Changed
- **Plugin renamed: TheLoopSkill → Heimdall** — the watchman who sees everything and guards the passage; the plugin had outgrown a loop-only name (it owns harness engineering below the loop and orchestration above it). The `loop-*` skill prefix is unchanged, the GitHub repository URL is unchanged, and the MCP server id `theloopskill-mcp` is deliberately unchanged until the in-flight MCP Phase 3 lands (renaming it breaks installed configurations). Historical CHANGELOG entries and ADRs keep the old name — a record states what was true at the time.
- **`loop-autopilot` AP7 guard implemented** — `improvement-loop.workflow.js` now keeps a per-run coverage archive (every candidate recorded with its area and outcome), steers idle-round research toward unexplored areas, increments the dry counter only when a round fails to reach new territory, and interleaves Act ordering across intake kinds so one noisy kind cannot monopolize a round. AP7's table row flips to guarded.
- **Skill renamed: `loop-v1` → `loop-build`** — the name now says what the description always said ("build a project end to end"); `v1` named an output version, not a purpose. Invocation is `/loop-build <project-brief>`. Historical CHANGELOG entries and plan documents keep the old name.

## [1.4.0] — 2026-07-27

### Added
- **`loop-v1`** — the twenty-first skill: conduct a project brief to a shipped version one. Multi-planner coverage (three framings + reconcile + roster sweep), delegated-law build (every task authored under its owning skill's references), sequential gating with a bounded repair round, three-state verdicts (PASS / REFUTED / UNVERIFIED), release phase and a cumulative cast-and-cost ledger. Template: `v1-conductor.workflow.js`.
- **`--fable-gate`** (§M7b) — second sanctioned Fable opt-in: routes exactly one lens of an all-out gating vote to `claude-fable-5` through `fableGateAgent()`, with a logged fallback to `claude-opus-5` on refusal or ZDR 400. The canonical §M8 block gains the optional `FABLE_GATE` + `fableGateAgent` segment; `validate.mjs` sanctions it as the fourth omissible member.

### Changed
- **§M6 `BAND` re-baselined ~2.5× upward** from the maison-aurel ladder run: the old figures assumed prompt-answer verifiers; tool-heavy verifiers measured 50–120k output each.
- **§M5 gains the dispatch rule**: same-model verify fan-outs of width ≥ 3 dispatch staggered or sequentially — three parallel width-5 all-out bursts died whole to API 529 on 2026-07-27 while the same lenses dispatched sequentially completed 6/6.
- `model-routing.md` Fable sections now name the two sanctioned entry points and the extended bounding argument.

### Known-stale
- The C4 composition diagram still says "twenty skills"; refresh deferred to the next docs pass.

_Nothing yet._

## [1.3.0] — 2026-07-27

`loop-frontend` gets eyes. It wrote motion and never observed a rendered frame — the same defect class this plugin already shipped once, when `node --check` proved every workflow template *parsed* and four turned out silently mode-inert the moment anything actually ran them.

### Added

- **`loop-frontend/references/verifying-motion.md`** — the runtime check catalogue. Opens by sorting the skill's own rules into statically checkable and not: **six of seven need a browser** — whether the reduced-motion branch *substitutes* rather than deletes, whether focus lands after `startViewTransition()`, whether a pinned scene traps focus, flash thresholds, CLS across a scroll scene, and the sequence budget. Eight checks with runnable assertions, plus an explicit section on **what automation cannot check**: whether it feels expensive, whether the motion earned its place, whether the curve is right, and the fiftieth encounter. A green suite proves the motion is not broken or harmful; it does not prove it is good.
- **`motion-audit.workflow.js` emits a `runtimeCheckSpec`** — per interaction, which checks apply — and now returns an explicit caveat that every verdict in it was read from *source*. Auditors are told to flag where their own verdict is a static guess rather than an observation.
- **`loop-harness/references/mcp.md` gains a browser-control note** — when a browser MCP server is worth its cost (interactive checking, iterating on feel) versus when the project's own test runner is the right answer (anything repeatable).

### Changed

- `loop-frontend/SKILL.md` gains a step that specifies the runtime checks, and its report step now requires stating which checks are in CI and that a green suite does not mean the motion is good.

### Not changed, deliberately

- **The plugin still has zero npm dependencies.** No Playwright, no `package.json`, no lockfile — `validate.mjs` and `smoke.mjs` remain stdlib-only. The checks run against *your* project, in whatever stack it already has: `loop-frontend` specifies them, `loop-test` authors them. A skill library with no frontend of its own has no business carrying a browser binary.

## [1.2.1] — 2026-07-27

Fills two gaps in `loop-frontend` that an audit found: idea sourcing had **zero** coverage across all eight files, and cinematic scroll had two lines — both merely triggers for "you will need a library", nothing on how to compose one.

### Added

- **`loop-frontend/references/scroll-cinema.md`** — the cinematic scroll genre, which the skill previously mentioned only as a one-line trigger for reaching a library. Carries the distinction the whole genre turns on — **trigger** (scroll as a switch: cheap, native, reversible-never) versus **scrub** (scroll as the animation's playhead: expensive, reversible, usually needs a library) — plus scene decomposition, the scroll budget in viewport heights, the rule that **pinning is legitimate and scroll-jacking never is**, the per-frame performance traps (`will-change` churn across scenes, layout reads in a scroll handler), mobile/touch differences, and the requirement that `prefers-reduced-motion` **collapses the cinema to a document** rather than merely slowing it.
- **`loop-frontend/references/sourcing-ideas.md`** — turning "make it feel like *that* site" into a mechanism you can specify. Where to look and what each source is biased toward (awards galleries reward novelty over usability; a library's showcase is an argument for that library), the five deconstruction questions, the three evaluation filters, and the delegation contract: `loop-research` finds references, `loop-scout` chooses dependencies, this skill deconstructs and evaluates. Includes the rule that **a reference failing this skill's own accessibility gates is a warning, not a reference** — take the mechanism, leave the negligence.
- `loop-frontend/SKILL.md` gains a reference-sourcing step ahead of budgeting, and routes scroll-driven pages to `scroll-cinema.md` before the rung choice.

## [1.2.0] — 2026-07-27

A third execution mode, a clearer name for all three, and a planning phase built for coverage rather than coherence. **No breaking changes** — the v1.1 mode names still work.

### Added

- **`--mode lite`** — a third rung below `balanced`, for small well-specified tasks: Haiku for mechanical work, Sonnet for everything reasoned at `medium` effort, verifier width 1, dry threshold 1. Roughly **0.2–0.4×** a balanced run.
- **`loop-orchestrate/references/coverage-planning.md` + `templates/project-coverage-plan.workflow.js`** — planning built for coverage. A single planner produces a plan that is *coherent and incomplete*, and both failure modes are invisible from the inside: it frames the problem once, so anything outside that frame is **absent** rather than rejected; and a forgotten phase leaves no trace, because a plan with no test nodes reads exactly like a plan that deliberately skipped them. Three mechanisms attack this from directions each other cannot cover — **three independent framings** (risk-first, user-first, delivery-first) catch a wrong frame, a **roster sweep** over all twenty skills catches a forgotten phase, and **gap rounds until dry** catch the long tail. Every surviving node then ships a **charter**: objective, checkable acceptance criterion, explicit out-of-scope, inputs, owning skill, and what "done" means for the next node.
- **`scripts/smoke.mjs` gains `lite` assertions** — that `lite` never leaves a node inheriting the session model, and never routes any node higher than `balanced` would.

### Changed

- **The mode ladder is renamed so the names say which is bigger:** `optimize` → **`balanced`**, `full` → **`all-out`**. The old values still resolve via a `MODE_ALIAS` map in the canonical block, so no existing invocation, persisted script or Routine breaks — which is why this is a minor bump. `smoke.mjs` asserts the alias routes identically to `balanced`, so the shim cannot rot silently while it exists.
- **`all-out` lifted from graduated effort to a flat `xhigh` floor** on every node, with `max` still reserved for gating and planner. Roughly **3–5×** a balanced run.
- **Gating and planner nodes are pinned to `claude-opus-5` in every mode, including `lite`.** They are single nodes whose wrong answer is inherited by everything downstream, so modifier B outranks the mode dial; `lite` lowers their effort, never their model.
- **`lite` never inherits.** `inherit` means "take the session model", and the session default is Opus 5 — so a `lite` run that inherited on its judgment nodes would be *more* expensive than `balanced`. It pins downward on every row.
- The canonical `ROUTES` block gained the third tier and was propagated byte-identically to all **26** templates; it still hashes to one fingerprint.

## [1.1.0] — 2026-07-27

Two new skills and the architecture documentation for authoring more of them. Additive only — **no breaking changes**, and every 1.0.0 skill name, flag and reserved argument is unchanged.

### Added

- **`loop-frontend`** — luxury UI craft: motion choreography, easing and duration budgets, stagger, shared-element continuity, type scale and optical sizing, restraint, and perceived-performance patterns. Enforces `prefers-reduced-motion` and the WCAG 2.2 flash limits as **gates rather than advice** — SC 2.3.1 is Level A seizure risk, so a flashing effect is a refusal, not a warning.

  **It deliberately does not pin an animation library.** Research confirmed anime.js **v4.5.0, MIT, 2026-06-22** live from the npm registry, and it is the default *at the rung where a library is earned* — but the skill's body carries an **escalation ladder** (CSS transition → keyframes → View Transitions → scroll-driven → WAAPI → library) and climbs to the top rung only for one of five named reasons: orchestrated timelines with seeking, genuine interruptible springs, SVG morphing, scroll-scrubbed pinning, or gesture-driven motion. The full default import is 40.3 KB gzipped against a critical-path budget `loop-design` sets at ~130–170 KB, and most luxury motion needs no library at all.

  Also records a licence correction worth having: **GSAP became free for commercial use in April 2025** after Webflow's acquisition of GreenSock — but it is **proprietary, not OSI-approved**, and bars use in competing no-code animation tools. Both "GSAP costs money" and "GSAP is open source" are now wrong.

- **`loop-skill`** — the skill that authors skills. Drafts the discriminating description and registers the boundary, researches and grades the standards shelf, writes the thin router / on-demand references / ROUTES-carrying template, and proves conformance with the validation gate. Its scaffold template handles three-or-more skills at once, with the boundary check as an earned barrier because descriptions must be read side by side. Adding a skill is a **minor** bump; renaming one is major, because skill names are API from 1.0.0.
- **`docs/c4/skill-anatomy.md`** — why a skill has the shape it has: the three loading regimes, the `description` field as API, the standards-shelf honesty convention, the sandbox contract, and the lifecycle of adding a skill. `CONTRIBUTING.md` covers the mechanics; this covers the reasoning.
- **`docs/c4/skills.md`** — the C4 view of the fleet: one *skill container view* (what is inside any single skill, and why the three parts are separate — they load differently), plus six component diagrams, one per role group, each closing with the checkable question that separates its members. Deliberately not twenty near-identical per-skill diagrams; what differs between skills is their relationships, not their internals.
- **Boundary-audit rows and overlap resolutions** for both new skills: `loop-skill` against `loop-harness` (what Claude is *permitted* to do vs what it *knows how* to do) and `loop-docs` (prose for a reader vs a directory that must pass the gate); `loop-frontend` against `loop-design`, `loop-pattern`, `loop-scout` and `loop-algo`. The matrix is now 20 rows and 28 rated overlaps.

### Changed

- **Every architecture diagram is now native C4 notation.** The README System Context and composition diagram, `docs/c4/context.md`, and both the blank template and worked example in `loop-design/templates/c4-context.md` moved from generic `graph`/`flowchart` with hand-written `classDef`s to `C4Context` / `C4Component`. The `loop-design` template's rationale is inverted accordingly: native C4 is now the default and generic `graph` the last resort, because a generic graph will let you draw two systems in focus or an actor with no role, and the native form makes those mistakes hard to express. 15 of the repo's 16 diagrams are C4; the autonomy ladder stays a flowchart because a rung is not a component and "degrades one rung down" is a state transition, not a dependency.
- **README restructured around the C4 model** — Level 1 Context inline, Level 2 summarised, Level 3 redrawn with all twenty skills and the operational cycle (`operate → incident → debug → test → ship → operate`) that justifies those five being separate skills.
- Skill count updated fleet-wide: **18 → 20**.

### Known gaps

- No skill owns **"audit this existing app for WCAG conformance."** `loop-frontend` enforces the motion criteria at *authoring* time on code it is writing and stops there. Recorded rather than quietly annexed.
- The `loop-frontend` ↔ `loop-design` boundary is rated **HIGH** and is the weakest of the four: page-loading performance is `loop-design`'s, per-animation frame cost is `loop-frontend`'s. Both files say so plainly rather than pretending it is crisp.
- The **autonomy ladder** remains defined in one skill and cited from another, deferred from 1.0.0. Still no shared home.

## [1.0.0] — 2026-07-27

The plugin grows from twelve skills to **eighteen**, gains a fleet-wide **execution-mode dial**, and rebaselines onto Opus 5. This is the API-stability release: skill names, the `argument-hint` flag surface, and reserved template argument names are now covered by SemVer.

### Added

- **Six skills**, closing the lifecycle gaps the previous twelve left open:
  - **`loop-algo`** — the mechanism inside a component: algorithm and data-structure choice, complexity analysis, invariants and correctness arguments, concurrency, benchmark-driven validation.
  - **`loop-pattern`** — applies GoF patterns, Fowler refactorings, SOLID and language/framework idioms, and removes the smells that motivate them. Emits a **diff**, where `loop-review` emits findings.
  - **`loop-integrate`** — third-party / cloud / SaaS integration: OAuth 2.0 and OIDC, token and secret handling, webhook verification, idempotency keys, rate limits, retry and backoff, contract tests.
  - **`loop-ship`** — getting a change safely to production: rollout strategy, feature flags, expand-contract migrations, release gates, tested rollback, DORA.
  - **`loop-operate`** — steady-state operation: SLIs/SLOs/error budgets, burn-rate alerting, self-healing runbooks, SLO-gated auto-rollback. Ships as honest **gated scaffolding**: without a live service its templates are not proven recipes, and the SKILL.md says so.
  - **`loop-incident`** — a live, user-impacting failure: severity triage, comms and roles, mitigate before diagnosing, reproduction harness, timeline, blameless postmortem.
- **Execution modes** — `loop-engine/references/execution-modes.md` defines `--mode optimize|full` and the orthogonal `--planner opus|fable`, a canonical `ROUTES` block reproduced byte-identically in every routed template, and a **deterministic full-mode pre-flight** that prices the DAG and asks for one confirmation before any agent spawns.
- **`scripts/validate.mjs` + `.github/workflows/validate.yml`** — a validation gate that can actually fail. It rejects unparseable frontmatter, `name`/directory mismatch, `node --check` failures, H10 clock/random violations, `ROUTES` drift, and dangling reference paths. `claude plugin validate --strict` reads only the marketplace manifest and never opens a `SKILL.md`, which is how two unparseable skills passed every previous gate.
- **`docs/c4/`** — architecture documented with the C4 model (context, container, component), the technical mechanism traced end to end, and the ideas with their prior art.
- **`docs/design/`** — the 18-skill boundary audit and the execution-mode spec, committed as **normative** records. The audit outranks any build plan that disagrees with it.
- **Reserved argument names** — `input.mode` and `input.planner` are reserved fleet-wide, documented in both `CONTRIBUTING.md` and `execution-modes.md` §M9.
- **`argument-hint`** on the ten skills that lacked one entirely.

### Changed

- **Opus 5 rebaseline.** `model-routing.md` no longer asserts "the default fleet caps at Opus 4.8" — that claim expired and took its dependent advice with it. Routing now reasons from a **session-model check** rather than a hardcoded ceiling, so the rule cannot rot the same way at the next model launch. The worked example, both override modifiers, and every model ID were rewritten.
- **Model IDs standardized on bare aliases** (`claude-haiku-4-5`, not `claude-haiku-4-5-20251001`), which two files previously disagreed about.
- **Harness policy H8** replaced: model and effort selection is now mode-governed.
- **Verifier width for a correctness-critical/gating verify in optimize mode is 3**, not 1. The policy table always said 3; the shared `WIDTH` function returned 1. The function was wrong.
- **`loop-review` retagged to OWASP Top 10:2025 and the 2025 CWE Top 25.** Injection moved **A03:2021 → A05:2025** and SSRF lost its dedicated category into A01, so all eleven playbook entries and the ASVS control map are remaps, not renumbers. Dual-tag explicitly (`A05:2025 / A03:2021`) where a client's tooling still keys on 2021.

### Breaking

- **Content moved out of `loop-design`.** `references/deployment.md` collapses from 148 lines to a design-time stub, with its mechanics split into `loop-ship`; the SLO-measurement and observability halves of `references/nfr.md` move to `loop-operate`. `loop-design` keeps target-*setting*. Two skills cannot share one body of knowledge and be selected reliably.
- **`improvement-loop.workflow.js` renamed its dry/live switch** from `input.mode` to `input.runMode`, because `mode` is now reserved fleet-wide. A caller still passing `mode: "live"` gets the safe `dry` default and a logged warning — it will not run live. Update any Routine wired against the old key.
- **`loop-design` and `loop-harness` no longer advertise `--mode`.** Neither ships a workflow template nor invokes `loop-engine`, so neither can honour it. A skill that cannot honour a flag must not advertise it.
- **`--mode full` with `--budget` now refuses to start** when the estimate's high end exceeds the ceiling, rather than throwing mid-run. This is deliberately stricter than harness policy H6.

### Fixed

- **Two `SKILL.md` frontmatter blocks did not parse as YAML** (`loop-integrate`, `loop-orchestrate`) — an unquoted `description:` containing `": "` opens a nested mapping. All eighteen descriptions are now quoted by construction and the gate rejects the unquoted form.
- **Citation currency**, each verified against a primary source: PCI-DSS future-dated requirements became mandatory **31 March 2025** (recorded as 2026); OpenTelemetry Semantic Conventions **v1.43.0** (`observability.md` still instructed readers to emit under v1.42.0); the 2025 CWE Top 25 published 11 December 2025; CycloneDX/ECMA-424 2nd-edition dating; ITIL, OpenAPI and SAFe edition claims; SLSA reconciled across four files.
- **A fabricated non-confirmation** of *Site Reliability Engineering, 2nd Edition*, propped up by an invented ISBN-prefix heuristic, was published on two shelves and elevated to a standing rule. The book is real and announced; the heuristic is deleted.
- **`loop-ship` graded Sigstore "Yes"** on a rubric whose "No" grade explicitly covers an OSS project's own spec — while the row's own text called it "an implementation rather than a specification."
- **Cross-file agreement claims removed.** Three shelves asserted what the *other* shelves currently recorded ("all three now agree"). Such a claim is false the moment any sibling is edited, and is how a 1.42/1.43 version gap opened. The propagation obligation is kept; the assertion about sibling contents is not.
- **The `ROUTES`-drift grep** documented in `CONTRIBUTING.md` was inert — it printed 304 lines on a conformant tree, and its filter would have suppressed a real violation carrying a trailing comment. Replaced by the validation gate.
- **`--planner fable` was advertised in two `argument-hint`s and implemented nowhere.** It is now wired. §M7's promised fallback on "exceeding the declared latency budget" was **removed as unimplementable** — H10 bans clock reads, so no script can enforce a timeout; the refusal and HTTP-400 fallbacks remain, since both surface as `agent()` returning `null`.

## [0.4.0] — 2026-07-04

Renamed every skill into a collision-free **`loop-*`** namespace. The previous names were identical to Claude Code's built-in skills (`reviewing-code`, `diagnosing-bugs`, …), and the orchestration skill (`workflow`) additionally shadowed the built-in `/workflows` command. This is a **breaking change**: skill invocations change (e.g. `/workflow` → `/loop-engine`, `/reviewing-code` → `/loop-review`).

### Changed
- **All 12 skills renamed:**

  | Old | New | | Old | New |
  |---|---|---|---|---|
  | `workflow` | `loop-engine` | | `writing-docs` | `loop-docs` |
  | `orchestrating-projects` | `loop-orchestrate` | | `researching-topics` | `loop-research` |
  | `reviewing-code` | `loop-review` | | `finding-frameworks` | `loop-scout` |
  | `auditing-changes` | `loop-audit` | | `engineering-harnesses` | `loop-harness` |
  | `diagnosing-bugs` | `loop-debug` | | `automating-improvements` | `loop-autopilot` |
  | `designing-systems` | `loop-design` | | `writing-tests` | `loop-test` |

- Every `SKILL.md` `name:` field, all cross-skill references and relative reference paths, the README skill map + dependency/autonomy diagrams, and `INSTALL.md` updated to the new names. Generic uses of "workflow" (the Workflow tool, `*.workflow.js` templates) are unchanged. `plugin.json` keywords are unchanged (they remain search terms, not skill names).
- Bumped plugin + marketplace version to `0.4.0`.

### Fixed
- Corrected a pre-existing broken reference link in `loop-orchestrate/references/standards.md` (`../` → `../../` for the OWASP/CWE cross-reference).

## [0.3.0] — 2026-07-04

The autonomy ladder's two open rungs — **SUSTAIN** and **SCALE** — land in `automating-improvements`. Default behavior is unchanged: the loop is still propose-only; SCALE ships off by default.

### Added
- **SUSTAIN — AP6 "Gamed Loop"** (verification runs but is fooled): `references/verifier-integrity.md` — three structural guards (impossible-test canary, protected-path diff-integrity, sampled cross-judge) — and `references/held-out-eval.md` — the out-of-band detector: a frozen task suite with hidden deterministic oracles whose rising false-accept rate is the meta-overfit alarm. Runnable gates: `templates/verifier-canary.workflow.js` (in-band, pre-Propose, hard stop) and `templates/held-out-eval.workflow.js` (deploys as a third companion Routine).
- **SCALE — autonomous delivery, off by default**: `references/deployment.md` §"Advanced: autonomous delivery" — preconditions on every SUSTAIN signal, a hard NEVER-list, merge-behind-canary, agent-driven rollback, a rollback-rate + held-out tripwire that self-revokes autonomy back to propose-only, and a pinned autonomy-state audit issue — plus the control-flow skeleton `templates/canary-merge.workflow.js`.
- **README "The autonomy ladder"** — OBSERVE → VERIFY → SUSTAIN → SCALE as a named progression, with the degradation guarantee: any alarm drops the loop one rung; the floor is always propose-only.

### Changed
- `automating-improvements/SKILL.md` gains §7 (keeping the loop honest over time) and non-negotiable safety rule 6 (the held-out suite is never visible to the Act stage); `references/anti-patterns.md` gains the AP6 row.
- Bumped plugin + marketplace version to `0.3.0`.

## [0.2.0] — 2026-07-04

Professionalization and standards-depth pass. No behavior change to any workflow template.

### Added
- **`references/standards.md` for every skill** — each names, version-pins, and maps the authoritative standards it applies. Highlights: NIST SSDF / SLSA / SBOM / MITRE ATT&CK and compliance cross-maps (`reviewing-code`); arc42 / ISO-25010 / Google SRE / CAP-PACELC (`designing-systems`); CRAAP / SIFT / PRISMA / GRADE (`researching-topics`); ISO 31000 / DORA change-failure-rate (`auditing-changes`); 5 Whys / ODC / OpenTelemetry (`diagnosing-bugs`); WSJF / RICE / critical-path (`orchestrating-projects`); POLP / CIS / OWASP CI-CD Top 10 (`engineering-harnesses`); mutation testing / Pact / FIRST (`writing-tests`); Google style guide / CommonMark / Conventional Commits / MADR (`writing-docs`); SPDX / OpenSSF Scorecard (`finding-frameworks`); DORA-SPACE / trunk-based (`automating-improvements`).
- **Professional `README.md`** — tagline, badges, table of contents, "Why", quickstart, a "how the skills compose" Mermaid diagram, and an architecture & philosophy section.
- **`CONTRIBUTING.md`** — SKILL.md conventions, the workflow-template runtime rules (H10), the `standards.md` convention, and the validation checklist.
- **`CHANGELOG.md`** — this file.

### Fixed
- Corrected a stale "all four skills" reference in `INSTALL.md` (the plugin ships twelve).

### Changed
- Bumped plugin + marketplace version to `0.2.0`.

## [0.1.0] — 2026-07-02

Initial release: the 12-skill TheLoopSkill plugin, built and merged across PRs #1–#4.

### Added
- **`workflow`** — the multi-agent orchestration engine: pipeline / parallel / loop-until-dry / loop-until-budget templates, the Harness (H1–H12) and Loop (L1–L8) engineering policies, and the pluggable **AIDLC** lifecycle framework.
- **Domain skills** — `reviewing-code`, `designing-systems`, `orchestrating-projects`, `researching-topics`, `auditing-changes`, `writing-tests`, `diagnosing-bugs`, `writing-docs`, `finding-frameworks`, and `engineering-harnesses` (Claude Code harness scaffolds: permissions, hooks, MCP, automation loops).
- **`automating-improvements`** — a propose-only autonomous engineering loop that composes the other skills, plus the **credit-horizon** self-learning extension (per-kind trust ledger), an anti-patterns checklist, and a comprehension-rot digest.
- **Plugin packaging** — `.claude-plugin/plugin.json` + `marketplace.json`, web enablement via `.claude/settings.json`, the MIT `LICENSE`, and `INSTALL.md` covering local, web, and marketplace install paths.

[Unreleased]: https://github.com/santapong/TheLoopSkill/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/santapong/TheLoopSkill/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/santapong/TheLoopSkill/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/santapong/TheLoopSkill/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/santapong/TheLoopSkill/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/santapong/TheLoopSkill/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/santapong/TheLoopSkill/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/santapong/TheLoopSkill/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/santapong/TheLoopSkill/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/santapong/TheLoopSkill/releases/tag/v0.1.0
