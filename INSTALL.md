# Installing Heimdall

Heimdall ships twenty-two Claude Code skills:

| Skill | What it does |
|---|---|
| `loop-engine` | Author & run multi-agent Workflow scripts (pipeline/parallel/loop) governed by engineering policies and a lifecycle framework |
| `loop-review` | Security + code-quality review (OWASP Top 10, CWE Top 25, ASVS; finder→verify orchestration) |
| `loop-design` | System/architecture design: patterns, API, backend, frontend perf, deployment, NFRs, ADRs + C4 |
| `loop-orchestrate` | Project-manager planning layer: decompose into a task DAG and assign the right model+effort per task |
| `loop-research` | Multi-source research with adversarial fact-checking: search fan-out → deep-read → refute-first verify → cited synthesis |
| `loop-audit` | Change/impact audit → report: classify changes, trace blast radius, rate risk, check coverage (delegates security to loop-review) |
| `loop-test` | Design + write tests matching the repo's stack; verify each runs and fails for the right reason |
| `loop-debug` | Hypothesis-driven debugging: reproduce → localize → root-cause → fix → regression test |
| `loop-docs` | Write + maintain docs (README, API, docstrings, ADRs) via the Diátaxis model, verified against code |
| `loop-scout` | Prior-art / build-vs-buy check before building: search stdlib → registries → services → standards, evaluate, recommend reuse |
| `loop-harness` | Set up a project's Claude Code harness: permissions, hooks, MCP (`.mcp.json`), and automation loops — from copy-paste scaffolds |
| `loop-context` | Engineer agent context & state: budgets, placement, compaction with an addressable store, typed shared state, supersession, trace-invariant audits |
| `loop-autopilot` | Autonomous engineering loop: read feedback (issues/PRs/CI), act as draft PRs with tests, research improvements when idle — propose-only, never merges |
| `loop-algo` | The mechanism inside a component: algorithm and data-structure choice, complexity analysis, invariants, concurrency, benchmark-driven validation |
| `loop-pattern` | Apply GoF patterns, Fowler refactorings, SOLID and language/framework idioms; remove the smells that motivate them — emits a diff |
| `loop-integrate` | Third-party / cloud / SaaS integration: OAuth 2.0 + OIDC, webhook verification, idempotency keys, rate limits, retry and backoff, contract tests |
| `loop-ship` | Get a change safely to production: rollout strategy (rolling/blue-green/canary), feature flags, expand-contract migrations, go/no-go, tested rollback, DORA |
| `loop-operate` | Operate a running service in steady state: SLIs/SLOs/error budgets, burn-rate alerts, self-healing runbooks, SLO-gated auto-rollback |
| `loop-incident` | Respond to a live, user-impacting failure: severity triage, comms, mitigate before diagnosing, reproduction harness, blameless postmortem |
| `loop-skill` | Author a new skill for this plugin or bring an existing one up to contract — boundary, standards shelf, router, references, template, gate |
| `loop-build` | Conduct a project brief to a shipped version one: multi-planner plan, delegated-law build across the fleet, gates with repair rounds, release + ledger |
| `loop-frontend` | Luxury UI craft: motion choreography, easing and duration budgets, stagger, shared-element continuity, type scale, perceived performance — with the motion accessibility gates enforced |

The **canonical location** is `.claude/skills/<name>/` — a single source of truth that works for all three install paths below. The plugin references these same files via the `skills` field in `.claude-plugin/plugin.json`, so nothing is duplicated.

---

## 1. Local (Claude Code CLI)

**Option A — use this repo directly.** Open a Claude Code session anywhere inside the repo. Project skills under `.claude/skills/` are auto-discovered; type `/loop-engine`, `/loop-review`, etc. No enable step.

The repo root also ships a project-scope `.mcp.json` that wires up `heimdall-mcp` — the `route_node` / `estimate_phase` / `boundary_lookup` / `standards_shelf` / `run_gate` tools and the read-only skill/doc resources described in `mcp/`. Claude Code shows a one-time workspace-trust prompt the first time a session opens this repo with an unapproved `.mcp.json`; approve it there (or `claude mcp get heimdall-mcp` / `claude mcp reset-project-choices` to inspect or reset the choice). **Do not** add `"enableAllProjectMcpServers": true` to `.claude/settings.json` to skip that prompt — it is a project-wide, silent auto-trust of every current *and future* project-scoped server for every teammate who opens the repo, which is a materially bigger grant than "trust this one server," and the prompt itself is the harness's own consent gate working as designed. If the prompt is a genuine friction point, the fix is a documented one-time `claude mcp` approval per teammate, not turning the gate off in a committed file.

**Option B — copy into another project.** Copy the skill folders you want into that project's `.claude/skills/`:

```bash
cp -r .claude/skills/loop-engine /path/to/your-project/.claude/skills/
```

Commit them so your team gets them too.

**Option C — make them personal (all your projects).** Copy into your user skills dir:

```bash
cp -r .claude/skills/loop-engine ~/.claude/skills/
```

---

## 2. Claude Code on the web (remote)

Web sessions start from a **fresh clone and see only committed project files** — so anything you want available must be committed to the repo.

- The skills under `.claude/skills/` are picked up automatically once committed. Nothing else is required to use them by name in a web session on this repo.
- To make the whole set available as an installable **plugin** in web sessions, this repo commits `.claude/settings.json` declaring the same-repo marketplace and enabling the plugin:

  ```json
  {
    "extraKnownMarketplaces": { "heimdall": { "source": "./" } },
    "enabledPlugins": { "heimdall@heimdall": true }
  }
  ```

  > **Caveat:** the docs don't explicitly confirm that a *same-repo* marketplace auto-installs in a web session. If the plugin isn't active automatically, run the manual steps in section 3 once inside the session. Using the skills directly from `.claude/skills/` always works and needs none of this.

---

## 3. As a plugin (marketplace)

Install the bundle into any project or user scope via the plugin system.

```
# add this repo as a marketplace
/plugin marketplace add santapong/Heimdall

# install the bundled plugin (all twenty-two skills)
/plugin install heimdall@heimdall
```

To test the marketplace from a local checkout instead of GitHub:

```
/plugin marketplace add ./
/plugin install heimdall@heimdall
```

Marketplace manifest lives at `.claude-plugin/marketplace.json`; the plugin manifest at `.claude-plugin/plugin.json` (its `skills` field points at `./.claude/skills`, so the plugin exposes the same files as the project skills — no duplication).

`.claude-plugin/plugin.json` also declares an `mcpServers` entry for `heimdall-mcp`, using `${CLAUDE_PLUGIN_ROOT}` in place of the repo-root `.mcp.json`'s `${CLAUDE_PROJECT_DIR}`. This is not redundant with the repo-root `.mcp.json` above — the two are read on disjoint paths:

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
| **OpenAI Codex CLI** | `.codex/skills/` or `~/.codex/skills/` | append `config.toml.fragment` to `~/.codex/config.toml` (or use `codex mcp add`) |
| **Antigravity** | `.agents/skills/` or `~/.gemini/config/skills/` | merge `mcp_config.json` into `~/.gemini/config/mcp_config.json` |

Three things to know before you install one:

- **A pack carries 18 of the 22 skills.** `loop-engine`, `loop-harness`, `loop-skill` and
  `loop-autopilot` are Claude Code-native by subject and are held back ([ADR-0008 §C2](docs/design/ADR-0008-host-packaging-seam.md)).
- **No multi-agent execution.** The 28 `*.workflow.js` templates are excluded and every affected
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
Heimdall/
├── .mcp.json                # project-scope MCP wiring for a direct checkout (Option 1)
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (skills → ./.claude/skills; mcpServers for plugin installs)
│   └── marketplace.json     # marketplace manifest (plugin source → ./)
├── mcp/                      # heimdall-mcp: stdio MCP server (route_node, estimate_phase,
│                              # boundary_lookup, standards_shelf, run_gate + read-only resources)
├── .claude/
│   ├── settings.json        # extraKnownMarketplaces + enabledPlugins (web)
│   └── skills/
│       ├── loop-engine/      loop-orchestrate/  loop-skill/
│       ├── loop-design/      loop-algo/         loop-pattern/
│       ├── loop-test/        loop-review/       loop-audit/       loop-debug/
│       ├── loop-integrate/   loop-ship/
│       ├── loop-operate/     loop-incident/
│       └── loop-research/    loop-scout/        loop-docs/        loop-harness/   loop-autopilot/
├── docs/
│   ├── c4/                  # architecture: context, container, component, skill anatomy
│   └── design/              # normative: the boundary audit
├── scripts/validate.mjs     # the validation gate (run by .github/workflows/validate.yml)
├── INSTALL.md
└── README.md
```
