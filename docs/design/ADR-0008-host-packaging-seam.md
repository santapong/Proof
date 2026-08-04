# ADR-0008: One source of truth, generated per-host packs under `dist/`, and a stated Tier-B degradation contract

## Status

**Proposed**

Date: 2026-08-02 · Deciders: H0 (host portability) · Blocks: all of ROADMAP H1–H5

Rules on how the 22 skills reach a host that is not Claude Code. It amends no existing ADR: ADR-0001
through ADR-0007 all rule on `mcp/`, and none of them says anything about where skills live or who
may copy them. It does **not** change how `heimdall-mcp` is built or launched; it only pins the one
field a future change to that would have to touch.

---

## Context

### C1. What actually has to move, measured

Measured on `develop` @ `1c033a0`, 2 Aug 2026: **22 skills, 175 files, 2.7 MB** under
`.claude/skills/`, plus 28 `*.workflow.js` templates spread across 20 of the 22 (only `loop-design`
and `loop-harness` ship none).

The host-specific surface inside that tree is far smaller than its size suggests:

| Token class | Hits | Files | Where |
|---|---|---|---|
| `${CLAUDE_PROJECT_DIR}` / `${CLAUDE_PLUGIN_ROOT}` | 10 | 8 | **All ten inside `loop-harness`** — its templates and references *are* Claude Code config |
| `.claude/skills` path literals | 12 | 8 | Mostly workflow templates telling an agent where to read; one is a stale absolute path in `loop-pattern/references/design-patterns.md:222` |
| "Claude Code" in prose | 20 | 13 | 9 in `loop-harness`, 3 in `loop-autopilot/references/deployment.md`, and two incidental one-liners (`loop-test:56` pointing at the built-in verify skill, `loop-frontend/references/verifying-motion.md:29` at Claude in Chrome) |
| "Workflow tool" | 13 | 6 | `loop-engine` and the skills that hand work to it |
| Claude model names (`Opus 5`, `Sonnet 5`, `Fable 5`, `claude-*-5`) | **509** | 34 | Concentrated: `loop-engine/references/execution-modes.md` (69), `loop-orchestrate/references/model-routing.md` (37), and 23–40 per workflow template |

**The 509 number is the one that looks alarming and is not.** Model routing only binds at the moment
an agent is spawned, so every hit outside those two reference files is inside a `*.workflow.js`
template — a file that targets a tool the host does not have and therefore does not ship in a
non-Claude pack at all. Once templates are excluded, the model-name surface is two prose files.

### C2. Four skills are host-native by subject, not by accident

This is the finding that decides what a pack contains. A translation pass can rewrite a noun; it
cannot rewrite what a skill is *about*:

| Skill | Its subject | Portable? |
|---|---|---|
| `loop-engine` | Authoring and executing scripts for Claude Code's `Workflow` tool | **No.** Remove the tool and nothing remains. |
| `loop-harness` | Configuring `.claude/settings.json`, Claude Code hooks, permissions, `.mcp.json` | **No.** Its own description names the product. |
| `loop-skill` | Authoring a skill for *this plugin*, gated by `scripts/validate.mjs` | **No.** Its deliverable is defined by this repo's gate. |
| `loop-autopilot` | A standing loop deployed as a Claude Code Routine / `/loop` / headless run | **No.** `references/deployment.md` is three Claude Code mechanisms deep. |
| `loop-build`, `loop-orchestrate` | Project decomposition and model routing — doctrine portable, *execution clause* not | **Partly.** Keep the skill, drop the template, state the degradation. |
| The other 16 | Domain knowledge: design, algorithms, review, testing, incidents, docs… | **Yes**, minus templates. |

So the honest claim for a non-Claude host is **18 of 22 skills**, not 22. Any pack that ships all 22
is shipping four skills that will confidently instruct a Cursor agent to edit
`.claude/settings.json`.

### C3. The in-repo collision — why packs cannot live at the paths hosts read

Cursor loads skills from `.cursor/skills/`, `.agents/skills/`, and **for compatibility**
`.claude/skills/` and `.codex/skills/` (plus the `~/` globals of each). That compatibility loader is
this track's cheapest win and its nastiest trap in the same sentence:

- **The win:** on Cursor, this repo needs *no* pack for Tier A. Cursor already reads
  `.claude/skills/` as it stands.
- **The trap:** if we generate `.agents/skills/` and `.codex/skills/` into this repo's root to serve
  Antigravity and Codex, then a **Cursor session opened in this checkout loads all 22 skills three
  times** — 66 entries competing for one routing decision, in a fleet whose entire design premise is
  mutually-exclusive descriptions. Cursor also carries a ~40-active-tool ceiling past which tools
  are silently dropped; tripling the skill surface is the same class of problem one layer up.

Any option that writes a pack to a path a host auto-discovers is therefore rejected on this checkout
alone, before portability is even considered.

### C4. Per-host landing zones

> **Verified 2 Aug 2026 against vendor docs and community write-ups; not verified by installing each
> host.** Re-confirm at the start of the milestone that consumes each row — all three formats moved
> within the last twelve months.

| Host | Skills read from | MCP config | Format |
|---|---|---|---|
| **Cursor** | `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, `.codex/skills/` + `~/` globals | `.cursor/mcp.json` (project), `~/.cursor/mcp.json` (global) | JSON, `mcpServers` — identical shape to ours |
| **Codex CLI** | `.codex/skills/`, `~/.codex/skills/` | `~/.codex/config.toml` | **TOML**, `[mcp_servers.<name>]`; `codex mcp add` preferred over hand-editing |
| **Antigravity** | `.agents/skills/` (project), `~/.gemini/config/skills/` (the one path all three variants read) | `~/.gemini/antigravity/mcp_config.json`, `~/.gemini/config/mcp_config.json`, or workspace `.agents/mcp_config.json` | JSON; **remote servers use `serverUrl`, not `url`** |

### C5. The launch contract does not survive the trip

`.mcp.json` today is `node ${CLAUDE_PROJECT_DIR}/mcp/server.mjs`. No target host expands
`${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, and none guarantees a `node` on `PATH` — the
machine this ADR was drafted on has no `node` installed at all. Emitting a *literal absolute path
resolved at pack time* is the only thing that works, and it is a standing cost rather than a
temporary one: there is no plan to ship the server as a self-contained binary. This ADR therefore
emits the launch command through one indirection, so that if the runtime ever *does* change, it is a
one-line descriptor edit rather than a change to three emitters.

---

## Decision

### D8.1 — `.claude/skills/` is the sole source of truth; every host tree is generated

No host tree is hand-edited, ever. A change to a skill is a change to `.claude/skills/**` and
nothing else. This is not a style preference: four hand-maintained copies of 175 files drift within
one release, and the drift is invisible because no reviewer diffs a copy against its original.

### D8.2 — Packs are written to `dist/<host>/`, never to a path a host auto-discovers

Per C3. `dist/` is git-ignored. Nothing in this repo's root ever becomes `.agents/skills/`,
`.codex/skills/`, or `.cursor/skills/`. Installing a pack is an explicit copy into the *target*
project or the user's global skills directory, performed by the user or by a documented one-liner —
never a side effect of cloning this repo.

### D8.3 — Packs are built, not committed

`dist/` is git-ignored and CI attaches the packs to the GitHub release. Committing them would add
~5 MB of duplicated content and, worse, rewrite three copies of every file in git history on every
skill edit. The cost, stated plainly: **a user who wants a pack from a checkout needs `node`** (or a
release download). **That cost is permanent as things stand**, which is precisely why the
runner-up below — committing the packs — stays live as a reversal path rather than being closed
out.

### D8.4 — A pack contains 18 skills; the four in C2 are held back

`loop-engine`, `loop-harness`, `loop-skill` and `loop-autopilot` are excluded from every non-Claude
pack, by name, in the host descriptor. If one of them is ever ported it will be by writing a
host-native body for it — a rewrite with its own ADR, not a translation rule.

### D8.5 — The packer translates host nouns; it never touches doctrine

The rewrite rules are a closed, reviewable list — path literals, env-var expansions, the
Claude-Code-specific one-liners in C1 — and a rule may only rewrite a **host noun**. No rule may
touch a claim about engineering. If a passage cannot be made true on the target host by renaming
nouns, the passage is excluded or the skill is held back under D8.4; it is never quietly softened.

One line is treated specially: **`argument-hint`**, because it is the one part of a skill a host
renders as a promise about its own invocation. Every bracketed flag on it (`--mode`, `--planner`,
`--fable-gate`, `--budget`, `--dry-run`) is parsed by `loop-engine`, which no pack contains, so the
packer keeps the positional argument and drops everything from the first `[`.

### D8.6 — `templates/*.workflow.js` are excluded, and their absence is stated

All 28 templates target the `Workflow` tool. Shipping them to a host that has no such tool is dead
weight in the context window and an implicit promise the host cannot keep. They are excluded, and
every skill that loses one gains a generated **degradation banner** in its `SKILL.md` naming what is
unavailable and what the sequential fallback is. A skill that silently produces a single-agent
answer while its description promises a governed multi-agent run is the specific failure this clause
exists to prevent.

`loop-engine/references/execution-modes.md` and `loop-orchestrate/references/model-routing.md` are
excluded from packs for the same reason (C1): they route between Claude model tiers, which is a
Tier-C concern and wrong advice on a host running Gemini or GPT. Any router pointer at those two
files is rewritten to the degradation note.

### D8.7 — One launch contract, three emitters

The host descriptor carries the MCP config *format* (`mcpServers` JSON / `mcp_config.json` JSON /
TOML `[mcp_servers.*]`); the launch command comes from a single field resolved at pack time. Today
it resolves to `node <abs>/mcp/server.mjs`. Nothing on the roadmap changes that. The indirection is
kept anyway, because the alternative is the same string hand-written into a JSON emitter, a second
JSON emitter and a TOML emitter — three places to get wrong for no benefit.

### D8.8 — The pack is deterministic, and a sibling script gates it

Pack output is byte-deterministic — sorted directory walk, no timestamps, no randomness — so CI can
pack twice and assert an identical tree. `scripts/check-host-packs.mjs` asserts, per host: the pack
is deterministic, the held-back skills are absent, no `*.workflow.js` survived, and **zero residual
host-specific tokens** remain from the C1 table. It is a sibling of
`scripts/check-modes-extraction-parity.mjs` — a developer/CI check, deliberately **not** folded into
`validate.mjs`, which scopes its walk to `.claude/skills` and must keep doing exactly that.

---

### D8.9 — A held-back skill's *reference files* may be carried; its router never is

Added in H1, after the H0 gate run below found 32 dangling cross-skill pointers per host. A skill can
be held back under D8.4 while a file inside it is still load-bearing for a skill that *is* packed —
the autonomy ladder's single definitional home is the worked example. So the descriptor gains
`carryFiles`, and a carried file arrives in the pack at its original path, under a stated notice, in
one of two modes:

- **`copy`** — the file is carried verbatim behind a generated "carried without its skill" notice.
- **`stub`** — the pointer resolves to a generated page explaining why the content is absent, for
  files D8.6 excludes on their merits (`execution-modes.md` routes between Claude model tiers).

**The router is never carried.** A directory with no `SKILL.md` is not a skill to any host — it is an
appendix, which is exactly what it is. `check-host-packs.mjs` enforces both halves: a held-back
skill's `SKILL.md` in a pack is a failure, and so is any other file from a held-back skill that
`carryFiles` does not declare.

With D8.9 applied, a cross-skill pointer that does not resolve inside the pack is a **failure**, not
a warning. It was a warning for exactly as long as the 32 were open.

## What the first gate run found — three open questions this ADR does *not* close

`node scripts/check-host-packs.mjs` was run against this tree on 2 Aug 2026 (Node 22): **three packs,
18 skills and 111 files each, deterministic, no forbidden token, no template survivor, every
degraded skill carrying its banner — green.** Its residue report then surfaced 32 dangling
cross-skill pointers per host, in three classes. They are recorded here rather than fixed silently,
because each is a decision:

1. **`loop-operate` → `../loop-autopilot/references/deployment.md` (4 pointers).** The worst of the
   three: the **autonomy ladder has exactly one definitional home** and D8.4 just held that home
   back. A packed `loop-operate` currently defines its central concept by pointing at a file that
   is not there. Options: carry the reference file without its skill router (a `carryFiles` clause,
   which is an amendment to D8.4), stub it with the ladder inlined, or un-hold `loop-autopilot`.
   **Recommendation: carry the file**, since a missing definition is worse than a Claude
   Code-flavoured deployment section further down it.
2. **13 skills → `../loop-engine/references/execution-modes.md` (1 each).** The mode dial. These are
   Tier-C clauses that D8.6's banner already explains in prose, so the pointer is redundant rather
   than wrong. Cheapest honest fix: a rewrite rule pointing them at the banner.
3. **`loop-orchestrate` → `loop-engine` (16 pointers).** Not a pointer problem — a **classification
   problem**. Sixteen references into the engine is a skill whose planning layer is welded to the
   executor. Either it earns a fifth slot on the C2 held-back list, or the engine's two policy
   references (`harness-policy.md`, `loop-policy.md`) get carried under class 1's mechanism.

None of the three blocks the seam; all three block *publishing* a pack, which is ROADMAP H5. They
are H1's opening worklist, and the ruling on this ADR should settle at least class 1.

> **Closed in H1 (2 Aug 2026) by D8.9.** Class 1 took the recommendation — `deployment.md` is carried
> verbatim, so a packed `loop-operate` keeps its definition. Class 2 is stubbed in place rather than
> rewritten: 13 pointers resolve to a page that says why the mode dial is absent, which is honest
> where a rewritten pointer would have been merely tidy. Class 3 did **not** cost `loop-orchestrate`
> its slot — its planning half is separable (steps 1–8 plan, step 9 executed and is dropped), so the
> two engine policy files it constrains a plan against are carried and the skill stays. All 32
> pointers resolve; the check is now a failure. **Residue after H1: five prose lines per host**, all
> informational — three "Claude Code" mentions inside the carried `deployment.md`, two pointer
> sentences, and one that is a *source* defect rather than a packing one (`loop-pattern/references/
> design-patterns.md` §"Drafting notes for the caller" is authoring scaffolding left in a shipped
> reference file, carrying a stale `/mnt/data/company/TheLoopSkill/…` path. It is wrong in
> `.claude/skills/` too and should be fixed there, outside this track).

## Consequences

- **The support claim gets smaller and true.** "18 of 22 skills, Tier A+B" instead of "works on
  Cursor". D8.4 and D8.6 are what make the claim checkable.
- **Cursor at Tier A costs nothing** and therefore proves nothing about the seam. H1's gate must be
  passed with an *installed pack* in a scratch project, not by opening this repo in Cursor.
- **A `node` prerequisite lands on pack consumers, permanently** (D8.3), along with a launch path
  that breaks if the checkout moves. Stated in INSTALL, not hidden. This is the single sharpest
  edge of the whole seam and the most likely reason to revisit D8.3.
- **The repo grows a build step it did not have.** `pack-host.mjs` and `check-host-packs.mjs` are
  Node stdlib only, matching the `scripts/` law; they add no manifest and no dependency, so
  `CONTRIBUTING.md:69` stays true.
- **Two prose files become Claude-Code-only** (D8.6). If a per-host model map is ever wanted, it is a
  new descriptor field and a new ADR, not an edit to those files.
- **Deferred, deliberately:** anything about Tier C. This ADR gets knowledge and tools onto three
  hosts. Whether Heimdall grows its own orchestrator is ADR-0009, and H2's discovery pass is what
  should decide it.

## Alternatives Considered

- **Symlink the source tree into each host path** — cheapest, and broken where it matters: Windows
  needs privilege or developer mode, and a symlink does not survive a zip, a release asset, or a
  `cp -r` into a global skills directory.
- **A branch per host** — named so it is visibly rejected. Merge conflicts on every skill edit, and
  it makes the drift in D8.1 permanent rather than merely likely.
- **Commit the packs** (runner-up to D8.3, and a live one). Removes the `node` prerequisite for
  checkout users — who would otherwise carry it forever, since no binary is coming. Costs ~5 MB and
  triples the diff of every skill change. Reversible in one commit if D8.3 turns out wrong.
- **Ship all 22 skills and let each host cope** — rejected by C2. Four of them would instruct the
  host's agent to configure a product it is not.
- **Ask every host to read `.claude/skills/` directly** — free, and works on exactly one of the three
  targets. Kept as the *recommended* Cursor path for a user who has already cloned this repo; it is
  not a strategy.
