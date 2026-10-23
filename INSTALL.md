# Installing Proof

Use the [documentation index](docs/README.md) and [26-skill catalog](docs/skills.md) to choose a task before installing more than you need.

**Proof 4 beta candidate, 23 October 2026.** Use a checkout containing the
`proof-*` directories. The public GitHub release is still v3.0.0; its old command
names do not invoke this candidate. No legacy skill aliases are installed here.
Start with [your first task](docs/getting-started.md) and read the
[breaking-change migration](docs/migration-proof-4.md).

For a candidate plugin session, open your consuming project and run
`claude --plugin-dir /absolute/path/to/this-proof-checkout`. Plugin skills use
`/proof:proof-guide` and `/proof:proof-review`; the unqualified `/proof-guide`
form below applies to project/personal skill copies. Structural and clean-directory
tool tests are distinct from a real installed-host session.

Proof ships twenty-six Claude Code skills:

| Skill | What it does |
|---|---|
| `proof-engine` | Author & run multi-agent Workflow scripts (pipeline/parallel/loop) governed by engineering policies and a lifecycle framework |
| `proof-review` | Security + code-quality review (OWASP Top 10, CWE Top 25, ASVS; finder→verify orchestration) |
| `proof-design` | System/architecture design: patterns, API, backend, frontend perf, deployment, NFRs, ADRs + C4 |
| `proof-orchestrate` | Project-manager planning layer: decompose into a task DAG and assign the right model+effort per task |
| `proof-research` | Multi-source research with adversarial fact-checking: search fan-out → deep-read → refute-first verify → cited synthesis |
| `proof-experiment` | Empirical study whose evidence is generated, not gathered: falsifiable hypothesis → harness with independent ground truth → run → re-derivation, mutation and confound gate → adversarial review against the raw artifacts |
| `proof-audit` | Change/impact audit → report: classify changes, trace blast radius, rate risk, check coverage (delegates security to proof-review) |
| `proof-test` | Design + write tests matching the repo's stack; verify each runs and fails for the right reason |
| `proof-debug` | Hypothesis-driven debugging: reproduce → localize → root-cause → fix → regression test |
| `proof-docs` | Write + maintain docs (README, API, docstrings, ADRs) via the Diátaxis model, verified against code |
| `proof-comprehend` | Understand an existing codebase: recover the as-built architecture, trace feature flows, build onboarding dossiers, reverse-engineer confidence-graded ADRs — every claim evidence-anchored |
| `proof-guide` | The front door when you don't know which skill fits: short interview, justified routing verdict, delegated invocation with managed handoffs |
| `proof-scout` | Prior-art / build-vs-buy check before building: search stdlib → registries → services → standards, evaluate, recommend reuse |
| `proof-harness` | Set up a project's Claude Code harness: permissions, hooks, MCP (`.mcp.json`), and automation loops — from copy-paste scaffolds |
| `proof-context` | Engineer agent context & state: budgets, placement, compaction with an addressable store, typed shared state, supersession, trace-invariant audits |
| `proof-autopilot` | Autonomous engineering loop: read feedback (issues/PRs/CI), act as draft PRs with tests, research improvements when idle — propose-only, never merges |
| `proof-algo` | The mechanism inside a component: algorithm and data-structure choice, complexity analysis, invariants, concurrency, benchmark-driven validation |
| `proof-pattern` | Apply GoF patterns, Fowler refactorings, SOLID and language/framework idioms; remove the smells that motivate them — emits a diff |
| `proof-integrate` | Third-party / cloud / SaaS integration: OAuth 2.0 + OIDC, webhook verification, idempotency keys, rate limits, retry and backoff, contract tests |
| `proof-ship` | Get a change safely to production: rollout strategy (rolling/blue-green/canary), feature flags, expand-contract migrations, go/no-go, tested rollback, DORA |
| `proof-operate` | Operate a running service in steady state: SLIs/SLOs/error budgets, burn-rate alerts, self-healing runbooks, SLO-gated auto-rollback |
| `proof-incident` | Respond to a live, user-impacting failure: severity triage, comms, mitigate before diagnosing, reproduction harness, blameless postmortem |
| `proof-skill` | Author a new skill for this plugin or bring an existing one up to contract — boundary, standards shelf, router, references, template, gate |
| `proof-build` | Conduct a project brief to a shipped version one: multi-planner plan, delegated-law build across the fleet, gates with repair rounds, release + ledger |
| `proof-venture` | Conduct a venture idea through the whole product lifecycle — discovery, vision/roadmap with a kill/pivot/proceed gate, GTM ∥ build-plan ∥ deploy-plan band, operate plan — as verified decision documents; ends with a proof-build-ready brief, never code |
| `proof-frontend` | Luxury UI craft: motion choreography, easing and duration budgets, stagger, shared-element continuity, type scale, perceived performance — with the motion accessibility gates enforced |

The **canonical location** is `.claude/skills/<name>/` — a single source of truth that works for all three install paths below. The plugin references these same files via the `skills` field in `.claude-plugin/plugin.json`, so nothing is duplicated.

---

## 1. Local (Claude Code CLI)

**Option A — use this repo directly.** Open a Claude Code session anywhere inside the repo. Project skills under `.claude/skills/` are auto-discovered; type `/proof-engine`, `/proof-review`, etc. No enable step.

The repo root also ships a project-scope `.mcp.json` that wires up `proof-mcp` — the `route_node` / `estimate_phase` / `boundary_lookup` / `standards_shelf` / `run_gate` tools and the read-only skill/doc resources described in `mcp/`. Claude Code shows a one-time workspace-trust prompt the first time a session opens this repo with an unapproved `.mcp.json`; approve it there (or `claude mcp get proof-mcp` / `claude mcp reset-project-choices` to inspect or reset the choice). **Do not** add `"enableAllProjectMcpServers": true` to `.claude/settings.json` to skip that prompt — it is a project-wide, silent auto-trust of every current *and future* project-scoped server for every teammate who opens the repo, which is a materially bigger grant than "trust this one server," and the prompt itself is the harness's own consent gate working as designed. If the prompt is a genuine friction point, the fix is a documented one-time `claude mcp` approval per teammate, not turning the gate off in a committed file.

**Option B — copy into another project.** Copy the skill folders you want into that project's `.claude/skills/`:

Use this only after checking the selected skill's sibling/reference dependencies.
Copying a single engine folder does not copy its whole framework or configure
MCP. New users should use the plugin path above; do not overwrite differing
existing skills or host configuration.

```bash
cp -r .claude/skills/proof-engine /path/to/your-project/.claude/skills/
```

Commit them so your team gets them too.

**Option C — make them personal (all your projects).** Copy into your user skills dir:

```bash
cp -r .claude/skills/proof-engine ~/.claude/skills/
```

---

## 2. Claude Code on the web (remote)

Web sessions start from a **fresh clone and see only committed project files** — so anything you want available must be committed to the repo.

- The skills under `.claude/skills/` are picked up automatically once committed. Nothing else is required to use them by name in a web session on this repo.
- To make the whole set available as an installable **plugin** in web sessions, this repo commits `.claude/settings.json` declaring the same-repo marketplace and enabling the plugin:

  ```json
  {
    "extraKnownMarketplaces": { "proof": { "source": "./" } },
    "enabledPlugins": { "proof@proof": true }
  }
  ```

  > **Caveat:** the docs don't explicitly confirm that a *same-repo* marketplace auto-installs in a web session. If the plugin isn't active automatically, run the manual steps in section 3 once inside the session. Using the skills directly from `.claude/skills/` always works and needs none of this.

---

## 3. Published plugin (marketplace)

Install the released bundle into a project or user scope via the plugin system.
As of this candidate review, these GitHub commands install v3.0.0, not Proof 4.
They become the Proof 4 path only after an explicitly published release; use the
documentation matching the installed version.

```
# add this repo as a marketplace
/plugin marketplace add santapong/Proof

# install the bundled plugin (all twenty-six skills)
/plugin install proof@proof
```

To test the marketplace from a local checkout instead of GitHub:

```
/plugin marketplace add ./
/plugin install proof@proof
```

Marketplace manifest lives at `.claude-plugin/marketplace.json`; the plugin manifest at `.claude-plugin/plugin.json` (its `skills` field points at `./.claude/skills`, so the plugin exposes the same files as the project skills — no duplication).

`.claude-plugin/plugin.json` also declares an `mcpServers` entry for `proof-mcp`, using `${CLAUDE_PLUGIN_ROOT}` in place of the repo-root `.mcp.json`'s `${CLAUDE_PROJECT_DIR}`. This is not redundant with the repo-root `.mcp.json` above — the two are read on disjoint paths:

- Opening this repo directly (Option 1) reads the **project-scope** `.mcp.json`, where `${CLAUDE_PROJECT_DIR}` correctly resolves to the repo you have open.
- Installing the bundled plugin into some *other* project (Option 3) never reads that file — it reads the **plugin manifest's** `mcpServers`, where `${CLAUDE_PLUGIN_ROOT}` correctly resolves to wherever the plugin got installed, which is not the consuming project's directory. `${CLAUDE_PROJECT_DIR}` in a plugin manifest would resolve to the *consumer's* project and silently fail to find `mcp/server.mjs` there.

Without the manifest entry, every marketplace/plugin-install consumer got the skills and no server — the repo-root `.mcp.json` only ever serves a session opened inside this checkout. `mcpServers` is a recognized `plugin.json` field: `claude plugin validate . --strict` passes with it present (verified against this repo, 2026-07-28) and, as a negative control, flags an actually-unknown field added alongside it (`✘ Validation failed (--strict treats warnings as errors)` for a planted `definitelyBogusUnknownField12345`, removed before commit) — so this is not merely "the validator didn't complain," it demonstrably distinguishes a real field from a typo.

---

## 4. Other hosts — Cursor, OpenAI Codex, Antigravity (in progress)

**Status: ROADMAP H1 (host portability). The packs build and pass their gate; no pack has yet been installed
into a real session of any of the three hosts.** Treat this section as instructions to try, not a
support claim — the support matrix lands in H5, and a host only gets a row once its gate passes.

Skills are generated per host rather than copied by hand ([ADR-0008](docs/design/ADR-0008-host-packaging-seam.md)):

```sh
node scripts/pack-host.mjs --all       # → dist/cursor/, dist/codex/, dist/antigravity/
node scripts/check-host-packs.mjs      # the gate: determinism, held-back skills, dangling pointers
```

Each `dist/<host>/` carries a generated `README.md` with that host's exact install paths and its
known friction. In short:

| Host | Skills → | MCP config → |
|---|---|---|
| **Cursor** | `.cursor/skills/` or `~/.cursor/skills/` | merge `mcp.json` into `.cursor/mcp.json` |
| **OpenAI Codex CLI** | `.agents/skills/` or `~/.agents/skills/` | review/merge `config.toml.fragment` into `~/.codex/config.toml` (or use `codex mcp add`) |
| **Antigravity** | `.agents/skills/` or `~/.gemini/config/skills/` | merge `mcp_config.json` into `~/.gemini/config/mcp_config.json` |

Three things to know before you install one:

Generated packs remove Claude-only `argument-hint` frontmatter. Their package
target is not evidence of live host discovery/tool access. Do not replace an
existing host configuration wholesale or copy account authentication into a pack.

- **A pack carries 22 of the 26 skills.** `proof-engine`, `proof-harness`, `proof-skill` and
  `proof-autopilot` are Claude Code-native by subject and are held back ([ADR-0008 §C2](docs/design/ADR-0008-host-packaging-seam.md)).
- **No multi-agent execution.** The 32 `*.workflow.js` templates are excluded and every affected
  skill says so in a generated host note. The judgment is intact; the fan-out is not.
- **The MCP launch path is absolute and resolved at pack time**, because no other host expands
  `${CLAUDE_PROJECT_DIR}`. Re-pack if the checkout moves, and keep `node` on `PATH` — the server is
  a Node script, and no self-contained binary is planned.

**Cursor shortcut:** if you have already cloned this repo, Cursor reads `.claude/skills/` natively —
point it at the checkout and skip the pack entirely. Do *not* generate a pack into `.agents/skills/`
or `.codex/skills/` inside this repo: Cursor reads those paths too and would load every skill three
times.

---

## The `.gitignore` is one line, on purpose

`dist/` is generated (ADR-0008 §D8.2–D8.3) and never committed. **`node_modules` is deliberately
*not* listed**, and adding it would break a real detector: `mcp/`'s own law (`docs/design/ADR-0002-dependency-seam-and-boot-contract.md` §D2.2, §5) is explicit that one must not be added for `node_modules`: `git status` is the *only* signal that a stray `npm install` violated the zero-dependency rule (`claude plugin validate --strict`, `scripts/validate.mjs` and `scripts/smoke.mjs` all measured blind to a planted `mcp/node_modules` — ADR-0002 §2), and an ignore entry would remove that last detector to buy tidiness. Anyone running `npm install` anywhere in this tree will see `?? node_modules/` in `git status` until they remove it — that nuisance is deliberate, not an oversight to "fix" with a `.gitignore`.

## Layout

```
Proof/
├── .mcp.json                # project-scope MCP wiring for a direct checkout (Option 1)
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (skills → ./.claude/skills; mcpServers for plugin installs)
│   └── marketplace.json     # marketplace manifest (plugin source → ./)
├── mcp/                      # proof-mcp: stdio MCP server (route_node, estimate_phase,
│                              # boundary_lookup, standards_shelf, run_gate + read-only resources)
├── .claude/
│   ├── settings.json        # extraKnownMarketplaces + enabledPlugins (web)
│   └── skills/
│       ├── proof-engine/      proof-orchestrate/  proof-skill/
│       ├── proof-design/      proof-algo/         proof-pattern/
│       ├── proof-test/        proof-review/       proof-audit/       proof-debug/
│       ├── proof-integrate/   proof-ship/
│       ├── proof-operate/     proof-incident/
│       └── proof-research/    proof-scout/        proof-docs/       proof-comprehend/  proof-guide/        proof-harness/   proof-autopilot/
├── docs/
│   ├── c4/                  # architecture: context, container, component, skill anatomy
│   └── design/              # normative: the boundary audit
├── scripts/validate.mjs     # the validation gate (run by .github/workflows/validate.yml)
├── INSTALL.md
└── README.md
```
