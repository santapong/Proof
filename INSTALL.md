# Installing TheLoopSkill

TheLoopSkill ships twenty Claude Code skills:

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
| `loop-autopilot` | Autonomous engineering loop: read feedback (issues/PRs/CI), act as draft PRs with tests, research improvements when idle — propose-only, never merges |
| `loop-algo` | The mechanism inside a component: algorithm and data-structure choice, complexity analysis, invariants, concurrency, benchmark-driven validation |
| `loop-pattern` | Apply GoF patterns, Fowler refactorings, SOLID and language/framework idioms; remove the smells that motivate them — emits a diff |
| `loop-integrate` | Third-party / cloud / SaaS integration: OAuth 2.0 + OIDC, webhook verification, idempotency keys, rate limits, retry and backoff, contract tests |
| `loop-ship` | Get a change safely to production: rollout strategy (rolling/blue-green/canary), feature flags, expand-contract migrations, go/no-go, tested rollback, DORA |
| `loop-operate` | Operate a running service in steady state: SLIs/SLOs/error budgets, burn-rate alerts, self-healing runbooks, SLO-gated auto-rollback |
| `loop-incident` | Respond to a live, user-impacting failure: severity triage, comms, mitigate before diagnosing, reproduction harness, blameless postmortem |
| `loop-skill` | Author a new skill for this plugin or bring an existing one up to contract — boundary, standards shelf, router, references, template, gate |
| `loop-frontend` | Luxury UI craft: motion choreography, easing and duration budgets, stagger, shared-element continuity, type scale, perceived performance — with the motion accessibility gates enforced |

The **canonical location** is `.claude/skills/<name>/` — a single source of truth that works for all three install paths below. The plugin references these same files via the `skills` field in `.claude-plugin/plugin.json`, so nothing is duplicated.

---

## 1. Local (Claude Code CLI)

**Option A — use this repo directly.** Open a Claude Code session anywhere inside the repo. Project skills under `.claude/skills/` are auto-discovered; type `/loop-engine`, `/loop-review`, etc. No enable step.

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
    "extraKnownMarketplaces": { "theloopskill": { "source": "./" } },
    "enabledPlugins": { "theloopskill@theloopskill": true }
  }
  ```

  > **Caveat:** the docs don't explicitly confirm that a *same-repo* marketplace auto-installs in a web session. If the plugin isn't active automatically, run the manual steps in section 3 once inside the session. Using the skills directly from `.claude/skills/` always works and needs none of this.

---

## 3. As a plugin (marketplace)

Install the bundle into any project or user scope via the plugin system.

```
# add this repo as a marketplace
/plugin marketplace add santapong/TheLoopSkill

# install the bundled plugin (all twenty skills)
/plugin install theloopskill@theloopskill
```

To test the marketplace from a local checkout instead of GitHub:

```
/plugin marketplace add ./
/plugin install theloopskill@theloopskill
```

Marketplace manifest lives at `.claude-plugin/marketplace.json`; the plugin manifest at `.claude-plugin/plugin.json` (its `skills` field points at `./.claude/skills`, so the plugin exposes the same files as the project skills — no duplication).

---

## Layout

```
TheLoopSkill/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (skills → ./.claude/skills)
│   └── marketplace.json     # marketplace manifest (plugin source → ./)
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
