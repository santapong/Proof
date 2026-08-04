# Contributing to Heimdall

Thanks for helping improve Heimdall. This repo is a Claude Code plugin of skills, so "contributing" usually means **adding or improving a skill**, **deepening a skill's reference standards**, or **adding a lifecycle framework**. This guide covers the conventions and how to validate a change.

## Repository shape

Every skill lives in `.claude/skills/<name>/` and follows one shape:

```
<name>/
├── SKILL.md              # thin router — what the skill does + when, in <~400 lines
├── references/           # deep knowledge, loaded on demand (progressive disclosure)
│   ├── <topic>.md
│   └── standards.md      # the authoritative standards this skill applies (see below)
└── templates/            # runnable Workflow scripts (*.workflow.js) and/or scaffolds
```

The plugin is wired via `.claude-plugin/plugin.json` (which points at `./.claude/skills`) and published through `.claude-plugin/marketplace.json`. New skills under `.claude/skills/` are auto-discovered — no manifest edit needed. `scripts/validate.mjs` is the repo's validation gate; see [Validating your change](#validating-your-change).

A skill's `references/` file may cross-reference a **sibling skill's** `references/` with a relative `../../<skill>/references/<file>.md` path (from `<skill>/references/`, `../../` lands in `.claude/skills/`). Verify the depth by resolving the path from the file you are editing — a `../` vs `../../` error of exactly this kind shipped in 0.4.0 and is recorded in the CHANGELOG. `node scripts/validate.mjs` resolves every such path a `SKILL.md` names and fails on any that is not on disk.

## Authoring a `SKILL.md`

- **Frontmatter is required**: a YAML block with `name`, `description` and `argument-hint`.
  - `name` — lowercase letters, numbers, hyphens; gerund style **matching the directory exactly** (`loop-review`, `loop-test`). A mismatch does not error, it just fails to resolve.
  - `description` — third person, **≤1024 characters**, stating *what it does* AND *when to use it* (the trigger phrases Claude matches on). No first/second person.
  - `argument-hint` — the invocation shape, including every flag the skill accepts (`<target> [--mode <lite|balanced|all-out>]`).
  - **Quote any value containing a colon.** `description: Integrate a platform: OAuth 2.0 flows…` is not valid YAML — a colon followed by whitespace opens a nested mapping, and the parser reports `mapping values are not allowed here`. Two skills shipped this way in 1.0.0. Wrap the whole value in double quotes and it is safe by construction; `node scripts/validate.mjs` rejects the unquoted form.
- **Keep the body a thin router** (aim under ~400 lines). Push depth into `references/` files and load them on demand — this keeps token cost low, since only `SKILL.md` stays in context.
- **Be prescriptive**: sane defaults with named escape hatches, not a neutral glossary. No leftover TODO/placeholder text.
- End with a **Reference files** list that names every file under `references/` and `templates/`, so nothing is a dangling link. The gate checks this in both directions: every path you name must exist, and every file that ships must be named.

## The `references/standards.md` convention

Each skill carries a `references/standards.md` that grounds it in authoritative standards. For every standard it lists:

1. **Name** the framework/standard and its issuing body.
2. **Pin** the current version/edition (with an "edition discipline" note — standards get revised).
3. **Map** it to *this skill's* workflow — how a practitioner applies it here, not a generic description.

`loop-review/references/owasp-cwe.md` is the exemplar (OWASP Top 10 2021, CWE Top 25, ASVS 5.0, CVSS v4). Match that rigor.

## Authoring a workflow template (`*.workflow.js`)

Workflow templates run under the Workflow tool's runtime, which has hard constraints (harness policy **H10**):

- `export const meta = {...}` first, a **pure literal** (no variables/calls/spreads/interpolation); required `name`, `description`; `phases` titles must match the `phase:` strings used. The gate evaluates the literal in an empty sandbox — if it needs anything from outside itself, it fails.
- **Plain JavaScript**, not TypeScript.
- **No `Date.now()`, `Math.random()`, or argless `new Date()`** — they throw (they'd break resume). Pass timestamps in via `args`; vary prompts by index for diversity.
- Normalize input: `const input = typeof args === 'string' ? JSON.parse(args) : args`.
- `.filter(Boolean)` every `parallel()` result (dead agents resolve to `null`); pass a `schema` to every consumed `agent()`; `log()` progress.
- Prefer `pipeline()`; use a `parallel()` barrier only when a stage needs all prior results (dedup/merge, early-exit). See the harness & loop policies under `.claude/skills/loop-engine/references/`.
- **Every template that sets `model` or `effort` carries the canonical `ROUTES` block verbatim** from `.claude/skills/loop-engine/references/execution-modes.md` §M8, and routes each `agent()` call through `optsFor()`. The duplication is intentional: H10 gives scripts no filesystem and no module access, so the block cannot be imported. §M8 is the single source of truth, and **drift between copies is a defect** — when the block changes, every copy changes in the same commit. `node scripts/validate.mjs` enforces this: it reads §M8 at runtime and diffs every copy against it, so a §M8 edit that misses a template fails the gate rather than shipping.
- **`input.mode` and `input.planner` are reserved fleet-wide** and belong to that block. See [Reserved argument names](#reserved-argument-names) before you name a new argument.
- **A Haiku-routed node carries no `effort`.** Haiku 4.5 has no effort dial, so `ROUTES` records `effort: null` and `optsFor()` omits the key. Writing `effort: 'low'` on a Haiku node is a no-op at best and an error at worst.

## Adding a lifecycle framework

Copy `.claude/skills/loop-engine/frameworks/_TEMPLATE.md` to `frameworks/<Name>.md`, fill in the phases (each with a human gate where appropriate), and it's usable via `/loop-engine <task> --framework <Name>`. No skill changes needed.

## Validating your change

**One command is the gate:**

```bash
node scripts/validate.mjs      # add --verbose to see every path it resolved
```

It exits **0** when the tree conforms and **non-zero** with a `file:line` for every violation. Node stdlib only — the plugin has no `package.json` and no third-party dependencies, and must not grow either. `scripts/validate.mjs` checks:

| # | Check | Fails on |
|---|---|---|
| 1 | Frontmatter parses, and carries `name`, `description`, `argument-hint` | YAML that does not parse; a missing or empty required key; a `description` over 1024 characters |
| 2 | `name:` matches the skill's directory | `.claude/skills/loop-algo/` declaring `name: loop-algorithms` — the skill silently fails to resolve |
| 3 | Every `*.workflow.js` parses | `node --check` on the source wrapped exactly as the Workflow runtime wraps it |
| 4 | Harness policy **H10** | `Date.now()`, `Math.random()`, argless `new Date()`, `performance.now()`, `crypto.randomUUID()` in executable code |
| 5 | Canonical `ROUTES` conformance | any copy that is not byte-identical to `execution-modes.md` §M8, and any bare `model:`/`effort:` literal outside the block |
| 6 | Reference paths in a `SKILL.md` resolve | a `references/…`, `templates/…`, `frameworks/…` or `../…` path with no file behind it (this is the `../` vs `../../` class from 0.4.0) |
| 7 | `export const meta` | a missing declaration; a literal that is not pure (a variable, call or interpolation makes it throw at author time); a missing `name`/`description`; a `phase:` string no `meta.phases` title declares |
| 8 | No orphan files | anything under `references/`, `templates/` or `frameworks/` that the SKILL.md's **Reference files** list does not name |

Check 5 reads the expected block **out of `execution-modes.md` §M8 at runtime** — it is never hardcoded in the script. Change §M8 and every template that has not been updated in the same commit fails immediately, which is the whole point of the rule in the [template section](#authoring-a-workflow-template-workflowjs). The three §M8-sanctioned omissions (`WIDTH`, `DRY_LIMIT`, `plannerAgent`) may be absent, but a segment you *do* carry must be verbatim.

In checks 4 and 5, a match found inside a `//` comment is reported as a **warning**, not a failure — but the scan is comment-aware rather than line-oriented, so a real violation carrying a trailing comment (`model: 'claude-opus-5', // pin the gate`) still **fails**. The pipeline-of-greps this replaced dropped any line containing `// `, which suppressed exactly that case while emitting 304 false positives on a clean tree; do not reintroduce it.

Warnings are printed and counted but do not change the exit code. They cover the cases where the script can see something suspicious but cannot prove a defect: a banned identifier appearing in prose, and a `meta.phases` title that no node uses (the reverse — a `phase:` string with no declaring title — is a hard failure, because that one always breaks the run's phase display). Read them; do not let them accumulate.

Also run, and note in the PR:

```bash
# Plugin + marketplace manifests are valid (fails on unknown fields in --strict).
# Note what this does NOT do: it validates .claude-plugin/*.json only and never opens a SKILL.md,
# so it is not evidence about frontmatter, descriptions, references, or templates. That is check
# 1–8 above, and it is why scripts/validate.mjs exists.
claude plugin validate . --strict

# Hook scripts (if you touched them) parse and behave
bash -n .claude/skills/loop-harness/templates/hooks/*.sh

# Templates actually RUN, and route as intended in both modes (should print 0 failed)
node scripts/smoke.mjs

# The per-host packs still build, are deterministic, and dangle no pointer
node scripts/check-host-packs.mjs
```

**On the third gate.** `check-host-packs.mjs` builds the Cursor / Codex / Antigravity packs twice and asserts they are byte-identical, that no held-back skill's router leaked in, that no `*.workflow.js` survived, that no `${CLAUDE_*}` expansion remains, that every skill which lost a template says so, and that **every `../<sibling-skill>/…` pointer resolves inside the pack**. That last one is the check most likely to catch you: four skills are held back from packs by [ADR-0008 §C2](docs/design/ADR-0008-host-packaging-seam.md), so a new cross-reference into `loop-engine`, `loop-harness`, `loop-skill` or `loop-autopilot` is green in `.claude/skills/` and red here. The fix is a `carryFiles` entry in `scripts/host-targets.json` (§D8.9), a stub, or a rethink of the pointer — not an edit to `dist/`, which is generated and git-ignored and will be overwritten on the next pack.

To parse a single template by hand without the script — note the temp file. `node --check` stats the path it is given rather than reading the stream, so piping into `node --check /dev/stdin` fails with `ENOENT … /proc/<pid>/fd/pipe:[…]` on every input, including valid ones:

```bash
f=.claude/skills/loop-engine/templates/pipeline.workflow.js
t=$(mktemp /tmp/wf-XXXXXX.js)
{ echo 'async function wf(agent,parallel,pipeline,phase,log,args,budget,workflow){';
  sed 's/^export const meta/const meta/' "$f"; echo '}'; } > "$t"
node --check "$t" && echo "OK $f"; rm -f "$t"
```

### Extending the gate

If you find a defect class the gate cannot see, **add the check before you fix the instance** — the two invalid-YAML frontmatters that shipped in 1.0.0 passed every check the project defined at the time. Each check in `scripts/validate.mjs` is a standalone function; add one, then confirm it fails on a deliberately broken copy of the tree before you trust it green.

## Reserved argument names

Workflow templates read their arguments off one normalized `input` object, and a few names are **reserved fleet-wide**. They are consumed by the canonical `ROUTES` block, which is pasted verbatim into every routed template — so taking one of these names for a template-local purpose does not shadow the flag, it *silently breaks routing* for that template.

| Reserved | Flag | Values | Read by |
|---|---|---|---|
| `input.mode` | `--mode` | `balanced` (default) \| `all-out` | `const MODE` in the canonical `ROUTES` block (§M8) |
| `input.planner` | `--planner` | `opus` (default) \| `fable` | `const PLANNER` in the canonical `ROUTES` block (§M7, §M8) |

**Never take `mode` for anything else.** `improvement-loop.workflow.js` had a dry/live safety switch on `input.mode` in v0.4.0 and had to rename it to `input.runMode` for this release — a breaking change to a shipped argument, carrying a back-compat branch that logs a warning when it sees a legacy value. After 1.0.0, renaming an argument is a breaking change; the cheap fix is to not collide in the first place.

**What to do instead:** name the argument after what it selects, not after the word "mode". `runMode: 'dry'|'live'` for an act-or-propose safety switch; `strategy`, `rung`, `docType`, `framework` for domain choices. Grep before you choose:

```bash
grep -rhoE '\binput\.[A-Za-z_][A-Za-z0-9_]*' .claude/skills --include='*.workflow.js' | sort -u
```

Prefer a name already in that list when it means the same thing, and a new one when it does not — two spellings for one concept is the same defect as two names for one concept. The tree currently carries one such divergence: `improvement-loop.workflow.js` spells its dry/live switch `runMode` while `health-response.workflow.js` spells the same concept `execution`. `runMode` is the fleet spelling; `execution` is the outlier and should converge on it.

New reservations are fleet-wide contract changes: they belong in `execution-modes.md` and in the table above, in the same commit.

## Pull requests

- Branch from `main`; keep PRs focused (one skill or one coherent change).
- Open as a **draft** until `node scripts/validate.mjs` exits 0.
- Describe what changed and how you verified it. Paste the gate's final line. "Validation green" on its own is not evidence — say *which* command produced it, because `claude plugin validate` and `node scripts/validate.mjs` cover disjoint surfaces.
- If you added a workflow template, note that it passes the gate and, ideally, a bounded live run.

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
