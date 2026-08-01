# ADR-0006 — Width is a shape question, `lite` is unpriced, and two BAND rows are flag-selected

- **Status:** Accepted
- **Date:** 2026-07-27
- **Ruling:** D6, Phase 1 DECIDE, theloopskill-mcp conduct
- **Owner skill:** loop-engine
- **Supersedes / amends:** nothing. Constrains `mcp/tool-contracts.json` (D3) at three named paths.
- **Companion contract:** `mcp/width-and-band-contract.json`

---

## Context

D3 published `route_node` and `estimate_phase` signatures. D4 ruled how §M8 is located and evaluated. D5 ruled that no answer may contain a value the server chose because a lookup failed. D6 is the check that the approved signatures can actually answer correctly from the source. On three questions they cannot, and each failure is silent — the tool returns a well-formed, schema-valid, plausible number that is wrong.

Every claim below is labelled **MEASURED** (run against the tree today), **DERIVED** (follows from measured facts), or **EVIDENCE** (quoted from a source line). Probes are in the scratchpad and were never written into the repo.

### C1. `WIDTH` is not wrong — it is *partial*, and its domain lives in prose

The task states §M8's `WIDTH` is "wrong by construction". The sharper and more useful finding is that it is a **partial function whose domain §M8 declares in prose and does not encode**.

**EVIDENCE** — `execution-modes.md:397`:

> A template that does not loop omits `DRY_LIMIT`; one with no adversarial verify stage omits `WIDTH` **(see §M5 on which node shapes count)**

That parenthetical is §M8 explicitly delegating the shape question to §M5 and declining to encode it. `WIDTH`'s domain is *adversarial verify nodes*. `WIDTH('scout')` is a **domain error**, not a value error. The block is correct for its intended caller — a template that has a verify stage, calling `WIDTH` at that stage — and unusable as a general answer, which is exactly what `route_node` was about to make it.

**MEASURED** — the real block located by D4's coordinate walk (lines 306–392, 6278 bytes) and evaluated in a null-prototype `vm`:

| mode | scout | doc | implement | analyze | synthesize | verify | judge | critic | gating | planner |
|---|---|---|---|---|---|---|---|---|---|---|
| `lite` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| `balanced` | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **3** | 1 |
| `all-out` | **3** | **3** | **3** | **3** | **3** | 3 | 3 | 3 | **5** | **3** |

Against §M6:185–194's own `width(n)` rules:

| Case | §M6 says | §M8 `WIDTH` says | Verdict |
|---|---|---|---|
| any non-verify node, `all-out` | 1 (`:185`) | 3 | **wrong on 7 of 10 kinds** |
| gating **DECISION**, all modes | 1 (`:186–187`, §M5:141–146) | 3 balanced / 5 all-out | **wrong** |
| deterministic **measurement**, all modes | 1 (`:186–187`) | 3 balanced / 5 all-out | **wrong** |
| standard verify, `balanced`, ordinary ask | 1 (`:188–189`) | 1 | agrees |
| standard verify, `balanced`, thorough ask | 3 (`:190–191`) | 1 | **wrong** |
| gating VERIFY, `balanced` | 3 (`:192`) | 3 | agrees |
| standard verify, `all-out` | 3 (`:193`) | 3 | agrees |
| gating VERIFY, `all-out` | 5 (§M5:133) | 5 | agrees |

`WIDTH` is a function of `(kind, mode)`. The correct width is a function of `(shape, mode, ask, declaredLenses)`. `kind` does not determine `shape`, and §M5 says so twice.

**EVIDENCE** — §M5:141 and §M5:146:

> Two node shapes are therefore **width 1 in all three modes** … `taskType: 'gating'` on a **verify** node widens to 5 under all-out mode; `taskType: 'gating'` on a **decision** node does not.

And carve-out 2 — "a node that re-queries a metric, re-runs a check, or reads a system state rather than arguing about one" — can wear a `verify` taskType. So `taskType → nodeShape` is **not a function in either direction**. Any default is a guess.

### C2. The disagreement is already live in the repo, in the audit artifact

**MEASURED** — 27 of 27 templates carry `const WIDTH`. Most call it in-domain (`WIDTH('verify')`, `WIDTH('judge')`, `WIDTH(VERIFY_NODE.taskType)`). Four sites call it over **every node**:

- `.claude/skills/loop-orchestrate/templates/project-plan.workflow.js:290` — `width:${WIDTH(n.taskType)}` in the cast log, for every node in `TASKS`
- `.claude/skills/loop-orchestrate/templates/project-plan.workflow.js:420` — `width: WIDTH(n.taskType)` in the JSON `ledger`
- `.claude/skills/loop-v1/templates/v1-conductor.workflow.js:208` — same cast log
- `.claude/skills/loop-v1/templates/v1-conductor.workflow.js:332` — same JSON `ledger`

Under `--mode all-out` a scout node's cast row reads `width:3` and the JSON ledger carries `width: 3`. The cast ledger is the audit artifact — `project-plan.workflow.js:281–285` calls it "the only evidence of which one happened" — and §M6:180's `agents = Σ items(n) × width(n)` computed from it is **3× over on every non-verify node**. No gate catches this: `scripts/validate.mjs` reads only §M8 from this file (`:442–565`) and diffs *templates against the block*, never a call site against §M5.

### C3. `lite` has no band, and `balanced` is not a sound upper bound for it

**MEASURED** — the §M6 BAND table header at `:209` is `| Node kind | \`balanced\` | \`all-out\` |` — three pipe-columns, two data columns, no `lite`. **MEASURED** — §M5's own width table header at `:130` likewise has exactly two columns and no `lite`.

The tempting answer is to return the `balanced` figures as a labelled upper bound. **DERIVED: that bound is unsound.** §M3's judgment rows (`analyze`, `synthesize`, `verify`, `judge`, `critic`) carry `model: null` under `balanced` — inherit the session model — while `lite` **pins** `claude-sonnet-5`. So `balanced ≥ lite` holds only if the session model is at least Sonnet. §M3:97 records Opus 5 as "the default" but nothing pins it, and the server answers at authoring time (H10) and cannot read the session model at all. The ordering therefore depends on a fact that is **in no located byte range**, which is precisely what ADR-0005's I1 forbids a result field from depending on. What looks like a judgment call is a derivation.

**EVIDENCE** — the bands are calibration, not physics. §M6:219: "every row lifted ~2.5× from the maison-aurel ladder run … (run journals are the source)". §M6:223: "these are calibration, not physics … the `all-out` column is the thinner-evidence half because far fewer full-mode runs exist to re-baseline from." There are no `lite` run journals at all. Synthesising a `lite` column by scaling `balanced` down would be fabricated calibration wearing a measured column's clothes.

**DERIVED** — but `agents` is *unaffected*. §M6:180's `agents = Σ items(n) × width(n)` needs no BAND, and every `lite` width is 1 (measured above, and §M5's carve-outs agree). A `lite` phase has an exactly computable agent count and no computable token figure. The gap is per-section, which is exactly the granularity ADR-0005 §D5.3 made atomic.

### C4. Two BAND rows are selected by a flag, and one of them does not exist

**EVIDENCE** — §M6:201: "`planner on Fable` is selected by the *flag*, not by the node: it applies when `n.taskType === 'planner'` **and** `input.planner === 'fable'` … Without this rule the Fable row is unreachable and a `--planner fable` run is priced as though it were running Opus 5."

**MEASURED** — the BAND row labels, split on `/` and excluding the flag-selected row, are **set-equal to the ten `ROUTES` keys**:

```
ROUTES keys     : analyze critic doc gating implement judge planner scout synthesize verify
BAND split keys : analyze critic doc gating implement judge planner scout synthesize verify
SETS EQUAL      : true
```

`planner on Fable` (`:217`) is the sole row that is not a taskType and does **not** split on `/`. That makes the resolver mechanical and gate-checkable rather than a hand-written map.

**MEASURED** — the cost of keying on `taskType` alone:

| mode | plain `planner` | `planner on Fable` | understated by | missing |
|---|---|---|---|---|
| `balanced` | 45k–110k | 75k–200k | 1.67×–1.82× | 30k–90k |
| `all-out` | 60k–140k | 90k–230k | 1.50×–1.64× | 30k–90k |

**MEASURED — a second flag-selected row that has no entry at all.** `--fable-gate` (§M7b) routes one lens of the all-out gating verify to Fable. The BAND table has a `gating` row and no *gating on Fable* row. Pricing all five lenses from the `gating` row understates the node by **10–12%** at the planner row's own Fable ratio. There is no located band for a Fable gating lens, and deriving one by borrowing the planner row's ratio across kinds is exactly the invented value I1 forbids.

**DERIVED — a third, unpriced branch: the fallback.** §M7a's automatic fallback means a `--planner fable` node can spend *two* agents — the Fable attempt and the Opus retry. §M7a:277 makes this unconditional under zero data retention: "under zero data retention every Fable request returns **HTTP 400**". A ZDR org passing `--planner fable` pays a wasted round-trip that emits no output tokens plus a full Opus planner, so its true cost sits near the plain `planner` row, not the Fable row. The published Fable band is a **success-path** price, and §M6 exists to put honest numbers on a consent screen.

### C5. `declaredLenses` is on the wrong tool

**EVIDENCE** — §M5:137–139: "Mode picks *how many* of a node's declared lenses run; it never invents new ones … a node that declares **no** lenses … is pinned at width 1 forever."

**MEASURED** — 11 templates cap width by the declared lens count, via `Math.min(WIDTH(...), LENSES.length)` or `LENSES.slice(0, WIDTH(...))`. So the width a run actually dispatches is `min(width, declaredLenses)`.

D3 put `declaredLenses` on `route_node`'s input and **not** on `estimate_phase`'s node items. `estimate_phase` therefore over-counts agents on every capped node while `route_node` gets it right — the same question answered two ways by one server.

---

## Decision

### D6.1 — `nodeShape` is required and total; `width` is returned as a structure

Both options the task offers, because they are not alternatives. The discriminator makes width *computable*; the structure makes it *auditable*.

**D6.1.1 — `nodeShape` is REQUIRED, with a four-member total enum.**

```
adversarial-verify | gating-decision | deterministic-measurement | non-verify
```

D3's enum has three members and no member for a plain non-verify node, and it is optional. Both are corrected. `non-verify` is added because §M6:185's first rule is about exactly that shape and there was no way to say it.

It is **required, never defaulted from `taskType`** (C1: the mapping is not a function in either direction), and never defaulted at all — a default here is a guess on the node §M5 exists to protect. Because absence is a structural failure, it lands as JSON-RPC `-32602` per ADR-0003's seam. To keep that error *teachable* rather than opaque, the field's `description` carries the §M5 carve-out text and cites `§M5:141–148` — a description is what a model-driven client reads when it repairs a `-32602`.

**D6.1.2 — `askIsThorough` is required exactly where it decides, and in-band when missing.**

**DERIVED** from §M6:188–192, the ask changes the answer in exactly one cell: `mode === 'balanced' && nodeShape === 'adversarial-verify' && taskType !== 'gating'` (1 on an ordinary ask, 3 on thorough/audit/comprehensive). All-out is always 3 (§M5:132) and balanced gating VERIFY is always 3 (§M6:192), so the ask is inert elsewhere and is echoed as `inert`. Missing *in that cell* is shape-valid but unanswerable, so it returns in-band `width_undetermined` naming the field and the clause — the seam ADR-0003 drew.

**D6.1.3 — `width` is a structure that refuses to collapse.**

```jsonc
"width": {
  "value":            3,              // the §M5/§M6 width for (shape, mode, ask)
  "effective":        3,              // min(value, declaredLenses) — what will dispatch
  "shape":            "adversarial-verify",
  "governingClause":  { "text": "...", "citation": { /* D3.2 Citation */ } },  // REQUIRED
  "cappedBy":         null,           // "declared-lenses" | null   (§M5:137-139)
  "dispatch":         "staggered-or-sequential",                    // (§M5:150)
  "m8WidthWouldSay":  3,              // what §M8's WIDTH(kind) returns for this kind+mode
  "agreesWithM8":     true            // REQUIRED
}
```

`widthReason` (D3, optional, free string) is subsumed by `governingClause` and becomes **required**: a scalar with no clause is precisely the thing that is confidently wrong.

`m8WidthWouldSay` / `agreesWithM8` are the load-bearing pair. D3's own `route_node` description says the tool "explains what the canonical ROUTES block will compute at run time". If the server silently returned the §M5-correct `1` for a scout node while the template's block computes `3` into the cast ledger, the server would be right, the transcript wrong, and nothing would connect them. Carrying both — and naming the disagreement — is also the mechanism by which the four live ledger sites in C2 get discovered by the first person who asks.

**D6.1.4 — `declaredLenses` moves onto `estimate_phase`'s node items** with `route_node`'s semantics. **Absent is not a failed lookup**: it has a declared meaning (the node has not yet declared its lens set), and §M6:205 already supplies the idiom — the node's agents are reported as a **strict upper bound** and the phase says so. This is ADR-0005's absent-vs-unrecognized distinction applied exactly.

### D6.2 — `lite` is refused, explicitly and citably; no substituted bound

`estimate_phase` with `mode: "lite"` or `compareTo: "lite"` returns `ok:false`, code **`mode_not_priceable`**, citing the new §M6:225 sentence. It does **not** return the `balanced` figures under any label (C3: the bound is unsound and depends on an unlocatable fact).

The `mode` and `compareTo` enums **stay at three**. Removing `lite` from one tool would make `route_node` and `estimate_phase` disagree about what a mode is, and a client that got a `lite` answer from `route_node` would hit an opaque `-32602` at `estimate_phase` instead of a sentence explaining why.

The error carries the one thing that *is* fully located for `lite` — the agent count — in `details[]`, never as a `result`. There is no `result` field on the error branch, so a schema-driven client reading `result.tokens` finds nothing rather than finding a number that means something else. That is the whole reason it goes in `details[]` and not in a partial result.

**The §M6 doc fix is opened and applied** — but it is **not** a `lite` column, which would be fabricated calibration (C3). It is a positive statement of the absence and its reason, added after `:223`. This was worth doing for the server's own sake: citing absence-by-omission from a table header is weak evidence, and citing an explicit sentence is strong.

### D6.3 — BAND is keyed by a declared resolver, not by `taskType`

```
bandKey(node, flags) =
  "planner on Fable"   when node.taskType === 'planner' && flags.planner === 'fable'   (§M6:201)
  otherwise            the unique row whose '/'-split label set contains node.taskType
```

Row labels are **read from the BAND table** (ADR-0005: enums read from source, never hardcoded), with exactly one **declared** exception — the flag-selected row, which does not split on `/`. A gate assertion pins it: the `/`-split of every row except the declared flag-selected row must be **set-equal** to the `ROUTES` key set. If §M6 gains a row, loses one, or renames a kind, the gate fires. That is what stops the Fable row becoming unreachable a second time.

**D6.3.1 — `--fable-gate` is priced as a lower bound with the unpriced lens named.** Four lenses from the `gating` row; the Fable lens reported as `unpricedLenses: 1`; the node and the phase total carry `lowerBound: true`. No ratio is borrowed from the planner row. §M6:203 now states this, so the server cites a sentence rather than a table's silence.

**D6.3.2 — the Fable planner is returned as two branches, never one number.**

```jsonc
"fableBranches": {
  "successPath":  { "bandKey": "planner on Fable", "citation": { } },
  "fallbackPath": { "bandKey": "planner",          "citation": { } },
  "condition":    "§M7a:281-284 — a refusal or an HTTP 400 under zero data retention resolves agent() to null and retries at claude-opus-5/max. Under ZDR this fires on every request (§M7a:277), so the fallback path is the normal case, not the exception.",
  "alwaysUnderZDR": true
}
```

Both branches are located rows. Nothing is invented. "This figure assumes Fable answers" belongs on the consent screen, and §M6 is the consent screen.

### D6.4 — codes added to D3's closed enum

`mcp/tool-contracts.json` declares its error `code` enum **closed**. D6 requires exactly two additions, written verbatim into the companion contract under `requiredAdditionsToD3Enum` so they can be lifted without re-deriving them:

| code | when |
|---|---|
| `width_undetermined` | shape-valid input where width cannot be determined without a field the caller did not supply (today: `askIsThorough` in the one cell of D6.1.2) |
| `mode_not_priceable` | `estimate_phase` at a mode with no BAND column (today: `lite` only) |

These are additive to D5's one-entry `unknown_task_kind` requirement. Three total across D5 and D6.

---

## Consequences

**Positive.** The three questions the approved signatures answered wrongly now either answer correctly or refuse citably. Width stops being a scalar on the node class whose error cost §M3 calls "a false 'all clear' ships the defect". The Fable rows become reachable and stay reachable under a gate. `lite` fails loudly instead of quietly borrowing another mode's numbers. And the server is now the only thing in the repo that can tell you the cast ledger's width column is wrong.

**Negative — the callers get longer.** `nodeShape` is required on every `route_node` call and every `estimate_phase` node. That is real friction, and it is the point: the shape distinction is exactly what §M5's DECIDED clause spent five paragraphs establishing, and a tool that lets you skip it re-introduces the defect the clause exists to prevent.

**Negative — `estimate_phase` returns bounds more often than point figures.** A `--fable-gate` phase is a lower bound; a phase with undeclared lens sets is an upper bound. §M6:205 already sanctions the idiom for discovery loops, so this extends an existing convention rather than inventing one — but a consent screen showing "≥ X, plus one lens with no published band" is less satisfying than a number, and it should be, because the number would be fiction.

**Negative — the server will disagree with running templates.** `agreesWithM8: false` on seven of ten kinds under all-out is a permanent, expected state until the four ledger call sites in C2 are fixed. That is disclosure, not a bug, but the first reader will need this ADR to interpret it.

**Neutral — two law-file sentences changed.** `execution-modes.md:203` and a new paragraph at `:225`. Both gates re-run and unchanged from the baseline recorded in ADR-0001 through ADR-0005: `validate.mjs` **PASSED — 45252 assertions, 0 failures, 5 warnings**; `smoke.mjs` **26 of 27** with the same pre-existing `loop-v1` `v1-conductor` planner failure. `validate.mjs` reads only §M8 from this file (`:442–565`), so neither edit is in its path — which is also why the drift in C1 and C4 survived.

---

## Alternatives considered

**Default `nodeShape` from `taskType`.** Rejected on C1: the mapping is not a function in either direction, and §M5:146 splits `taskType:'gating'` into two shapes with different widths in the same sentence. A default would be right most of the time and wrong on the gating node — the worst possible error distribution.

**Return the §M5-correct width and say nothing about §M8.** Rejected: the server would be right and the running template wrong, with no artifact connecting them. `agreesWithM8` is what turns a silent divergence into a finding.

**Return `balanced` as a labelled upper bound for `lite`.** Rejected on C3 — the bound is unsound because §M3's balanced judgment rows inherit, so the ordering depends on the session model, which is in no located range. This was the most tempting option and the measurement is what killed it.

**Add a `lite` column to §M6.** Rejected: §M6:219 sources the bands from run journals and §M6:223 calls them calibration; there are no `lite` journals. A synthesised column would be indistinguishable from a measured one at the point of use, which is worse than an honest absence.

**Add a `gating on Fable` row to §M6.** Rejected for the same reason, plus D6.3.1's lower bound is honest and creates the right pressure to measure one.

**Derive the Fable gating lens from the planner row's ratio.** Rejected: a ratio transposed across kinds is a value the server chose, which I1 forbids. §M6:221 explicitly says the lift "is per-kind, not a flat multiplier".

**Drop `lite` from `estimate_phase`'s enums so absence is a `-32602`.** Rejected: it makes two tools on one server disagree about what a mode is, and converts an explainable refusal into an opaque transport fault on the exact question that needs explaining.

**Fix the four ledger call sites in C2 as part of D6.** Rejected as out of scope — D6 rules on `route_node` and `estimate_phase` signatures, and template edits are governed by `validate.mjs` check 5 and the fleet-wide duplication rule. Recorded as an open question with the exact remedy, not silently carried.
