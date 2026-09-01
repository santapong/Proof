# Proof Roadmap

**Status: a proposal, not a commitment.** Nothing in this file is decided. The work names the ADR
that has to be opened and won before its first line of code is written, and the gate that says it
worked. Shipped work lives in [`CHANGELOG.md`](CHANGELOG.md); build plans for a cut release live in
[`docs/plans/`](docs/plans/). This file is the layer above both: what we intend, why, and in what
order.

One track is open:

| Track | One line | State | Blocking decision |
|---|---|---|---|
| **Host portability** | Run Proof on hosts other than Claude Code — **Cursor, OpenAI Codex, Antigravity** first, more after | **In progress — H0 and H1's code side landed** | [ADR-0008](docs/design/ADR-0008-host-packaging-seam.md) — *Proposed*, needs a ruling |

The milestones are numbered **H0–H5** and that numbering is what the commits, the ADR and the gate
refer to.

---

## The honest baseline

What exists today, and what would survive being pointed at a different host:

| Layer | What it is | Ports? |
|---|---|---|
| **Skills** — 22 dirs under `.claude/skills/`, `SKILL.md` + `references/` + `templates/` | Markdown with YAML frontmatter (`name`, `description`, `argument-hint`) | **Mostly.** All three targets read `SKILL.md` directories; Cursor reads `.claude/skills/` directly for compatibility. Frontmatter dialects and command-invocation syntax differ. |
| **MCP server** — `proof-mcp` 0.2.0, `mcp/server.mjs` + 10 lib modules, ~7.8k lines | Five tools (`route_node`, `boundary_lookup`, `estimate_phase`, `run_gate`, `standards_shelf`) + read-only `proof://` resources, hand-rolled JSON-RPC 2.0 over stdio, Node stdlib only | **By protocol, yes.** All three targets speak MCP stdio. What does not port is the *launch contract*: a `node` interpreter, a repo checkout, and a `${CLAUDE_PROJECT_DIR}` / `${CLAUDE_PLUGIN_ROOT}` expansion no other host performs. |
| **Workflow templates** — 28 `*.workflow.js` | Scripts targeting Claude Code's `Workflow` tool: `agent()`, `pipeline()`, `parallel()`, `phase()`, `budget` | **No.** No target host exposes an equivalent callable surface. This is the real gap, and this track must answer it rather than route around it. |
| **Harness** — `.claude/settings.json`, `hooks/harness-guard.py`, `hooks/stop-gate.sh`, `/gate`, `/release`, plugin + marketplace manifests | Claude Code configuration | **No.** Per-host analogues exist in pieces; none map one-to-one. |

So the fleet splits cleanly into a portable half (knowledge: skills, standards, boundaries, the MCP
tools that serve them) and a non-portable half (execution: the multi-agent engine and the harness
that governs it). This track is mostly the work of admitting that split in the layout instead of
discovering it per host.

---

## Host portability

**Scope for the first cut: three hosts.** Cursor, Antigravity, OpenAI Codex. The point of stopping
at three is that the fourth host must cost a checklist, not a redesign — so the deliverable is a
*seam*, and the three hosts are how the seam gets proven.

### Support tiers

Define once, apply per host. A host's row in the matrix is its tier, and nothing else needs
negotiating:

| Tier | Means | Depends on |
|---|---|---|
| **A — Knowledge** | The 25 skills load, route correctly, and their references resolve | Skill discovery + `SKILL.md` frontmatter dialect |
| **B — Tools** | `proof-mcp`'s five tools and `proof://` resources are reachable from the host's agent | MCP stdio config, plus `node` on the user's `PATH` and an absolute launch path resolved at pack time |
| **C — Execution** | A multi-agent run — fan-out, phases, gates, budget — actually executes under the host's own orchestration | The host having *any* programmable multi-agent surface. **Unknown for all three. Discovery task, see H2.** |

Tier A + B is a genuinely useful product on every host: the routing, the boundary matrix, the
standards shelf, the estimator, the gate. Tier C is where Claude Code stays ahead until proven
otherwise, and pretending otherwise in a README would be the dishonest move.

**A pack carries 21 of the 25 skills, not 25.** [ADR-0008 §C2](docs/design/ADR-0008-host-packaging-seam.md)
found four that are host-native *by subject* rather than by accident — `loop-engine` (its subject is
the `Workflow` tool), `loop-harness` (its subject is `.claude/settings.json`, Claude Code hooks and
permissions), `loop-skill` (its deliverable is defined by this repo's `validate.mjs`), and
`loop-autopilot` (deployment is Routines / `/loop` / headless Claude Code). A translation pass can
rewrite a noun; it cannot rewrite what a skill is about. Shipping those four would put a Cursor
agent confidently editing `.claude/settings.json`.

### Target matrix

> **Verified 2 Aug 2026 by web search against vendor docs and community write-ups; not yet verified
> by installing each host.** Every cell below is a claim to re-confirm at the start of its
> milestone — the same dated-confirmation discipline `references/standards.md` applies to living
> documents. Config formats for all three moved inside the last twelve months.

| | **Cursor** | **Antigravity** | **OpenAI Codex (CLI)** |
|---|---|---|---|
| **Skills path** | `.cursor/skills/`, `.agents/skills/`, global `~/.cursor/skills/`; **also loads `.claude/skills/` and `.codex/skills/` for compatibility** | Project `.agents/skills/`; global `~/.gemini/config/skills/` (the only path all three Antigravity variants read) | Project `.codex/skills/`; global `~/.codex/skills/` |
| **MCP config** | `.cursor/mcp.json` (project) / `~/.cursor/mcp.json` (global), `mcpServers` object — same shape as ours | `~/.gemini/antigravity/mcp_config.json`, `~/.gemini/config/mcp_config.json` (shared across variants), or workspace `.agents/mcp_config.json`. **Remote servers use `serverUrl`, not `url`** | `[mcp_servers.<name>]` in `~/.codex/config.toml` (TOML, not JSON); `codex mcp add` is the safer path than hand-editing |
| **Always-on instructions** | Cursor rules | Antigravity rules | `AGENTS.md` |
| **Known friction** | ~40 active tools across all servers before tools silently drop (we ship 5 — fine, but a user's other servers are not); no MCP hot-reload, config changes need a window reload | Three variants (AGY, IDE, CLI) with different discovery paths; get the global path wrong and the install silently does nothing | TOML translation of the `mcpServers` block; `[mcp_servers.…]` naming differs from every other host |
| **Cheapest first win** | Tier A is close to free — Cursor already reads `.claude/skills/` | Tier A needs a copy into `.agents/skills/`; Tier B is one config file | Tier A needs a copy into `.codex/skills/`; Tier B needs a TOML emitter |
| **Tier C story** | Unknown — background/subagent surfaces exist, callable-from-a-skill is unverified | Unknown — the agent manager runs parallel agents, programmability unverified | Unknown |

**Proposed order: Cursor → Codex → Antigravity.** Cursor first because its compatibility loader
makes Tier A nearly free, which turns milestone H1 into a real test of the seam rather than a test
of our patience. Codex second because TOML is the one config dialect that genuinely differs and it
is better to discover that early than fourth. Antigravity third because its three-variant discovery
surface is the most likely to produce a "works on my machine" bug, and by then the seam is stable
enough to absorb it.

### The seam — [ADR-0008](docs/design/ADR-0008-host-packaging-seam.md), written, *Proposed*

The failure mode to design against is obvious and fatal: **four hand-maintained copies of 22
skills.** They drift in a week and the drift is invisible.

What the ADR rules: `.claude/skills/` is the **sole source of truth**; every host tree is generated
by `scripts/pack-host.mjs` from `scripts/host-targets.json` and never hand-edited (D8.1). Packs land
in **`dist/<host>/`**, git-ignored and built rather than committed (D8.2–D8.3) — and pointedly *not*
at `.agents/skills/` or `.codex/skills/` inside this repo, because Cursor's compatibility loader
reads those paths too and a Cursor session opened in this checkout would load all 25 skills three
times (C3). Four skills are held back as Claude Code-native (D8.4, above). Rewrite rules may rename
host nouns and nothing else — a passage that cannot be made true by renaming is dropped or its skill
is held back, never quietly softened (D8.5). `scripts/check-host-packs.mjs` gates all of it, as a
sibling of `check-modes-extraction-parity.mjs` rather than folded into `validate.mjs`, which must
keep scoping its walk to `.claude/skills` (D8.8).

Alternatives the ADR weighs rather than assumes away: symlinks (break on Windows, in zips, and
through `cp -r`), a per-host git branch (named so it is visibly rejected), committing the packs
(named as the reversal path for D8.3), and asking each host to read `.claude/skills/` directly —
free, and works on exactly one of the three targets, so it is the recommended Cursor shortcut and
not a strategy.

The second thing it owns is the **degradation contract** (D8.6): a skill whose
`templates/*.workflow.js` cannot execute must say so and hand the user the sequential path — not
silently produce a single-agent answer while its own description promises a governed multi-agent
run. The packer drops the 28 templates, injects a stated host note into every affected `SKILL.md`,
and the gate fails any pack that lost a template without saying so. That is the honest version of
"supports Cursor".

### Milestones

| # | Milestone | Contains | Gate |
|---|---|---|---|
| **H0** ✅ | Seam decided | [ADR-0008](docs/design/ADR-0008-host-packaging-seam.md) (*Proposed*), `scripts/host-targets.json` (descriptors for all three hosts), `scripts/pack-host.mjs`, `scripts/check-host-packs.mjs`, `dist/` git-ignored, CI step added | ✅ `node scripts/check-host-packs.mjs` green for all three hosts (18 skills, 111 files each, deterministic); `validate.mjs` (46723 assertions, 0 failures) and `smoke.mjs` (28/28) still green |
| **H1** ◑ | Cursor at Tier A+B | Close the three dangling-pointer classes the H0 gate found ([ADR-0008 §"What the first gate run found"](docs/design/ADR-0008-host-packaging-seam.md)) — the autonomy ladder's definitional home, 13 mode-dial pointers, and `loop-orchestrate`'s 16 references into the engine — then install docs | An **installed** pack (not this checkout) in a scratch project: a Cursor session routes a task to the right skill and calls `route_node`. **Code side done — all 32 pointers closed by D8.9, the check promoted from warning to failure, INSTALL §4 written. The session test is the open half and needs a human at a Cursor window.** |
| **H2** ✅ | Tier C discovery | Research pass on all three hosts' programmable multi-agent surfaces; write it up as a design note, not a promise | ✅ [`docs/design/host-tier-c-discovery.md`](docs/design/host-tier-c-discovery.md) (2026-08-04): all three hosts now have multi-agent surfaces; Cursor is the only plausible adapter target; Codex expresses static fan-out only; Antigravity is a redesign, not a port. Tier C stays Claude-Code-only; ADR-0010's answer is "not now, and never per-host" |
| **H3** | Codex at Tier A+B | TOML emitter, `.codex/skills/`, `AGENTS.md` fragment | Same gate as H1, on Codex CLI |
| **H4** | Antigravity at Tier A+B | `mcp_config.json` emitter (mind `serverUrl`), all three variant paths documented | Same gate as H1, on the Antigravity IDE **and** CLI |
| **H5** | Support matrix published | README + INSTALL carry the per-host tier table; CI packs every host tree | No host claims a tier its gate has not passed |

### Adding host #4

The point of the whole track. Once H5 lands, a new host is:

1. Add a host descriptor: skills path, MCP config path + format, frontmatter dialect, command syntax.
2. Run `pack-host.mjs`, get `dist/<host>/`.
3. Pass the H1 gate — route a task, call a tool.
4. Add a matrix row with the tier that gate actually proved.
5. Anything beyond those four steps is a seam bug, and gets fixed in the seam.

Likely candidates after the first three: Windsurf, Zed, JetBrains AI, VS Code Copilot, OpenClaw,
Gemini CLI. None are scoped; they are listed so step 5 has something to be tested against.

---

## Decisions to open

| ADR | Question | Blocks |
|---|---|---|
| **ADR-0008** | The packaging seam: generated per-host trees, the held-back list, carried files, and the Tier-B degradation contract | Everything below H0 |
| **ADR-0009** | *(conditional on H2)* Whether Proof grows its own orchestrator for Tier C hosts, or Tier C stays Claude-Code-only | H2's outcome decides whether this exists at all |

## Explicit non-goals

- **Re-implementing the `Workflow` tool** for hosts that lack one — until H2 says what each host
  can actually do, that is a rewrite justified by a guess.
- **A hosted service, an HTTP transport, or an account.** Still deferred, still out of scope.
- **Rewriting `proof-mcp` in another language to make it easier to launch.** The absolute-path,
  `node`-on-`PATH` launch contract is a standing cost, not a temporary one; D8.7 keeps it behind a
  single descriptor field so a future runtime change stays a one-line edit, and that is as far as
  this roadmap goes.
- **Forking the skills per host.** If the seam cannot keep one source of truth, the answer is to fix
  the seam or drop the host, not to keep two copies.
- **Claiming support on a host nobody has run.** A matrix row requires a passed gate.
