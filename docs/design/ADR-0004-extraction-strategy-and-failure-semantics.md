# ADR-0004: Extract routing facts by evaluating §M8 in a locked `node:vm`, cross-checked against §M3

## Status

**Accepted**

Date: 2026-07-27 · Deciders: loop-design (D4, theloopskill-mcp conduct, Phase 1 DECIDE)

Scope: the extraction layer of `theloopskill-mcp` (ADR-0001 §runtime, ADR-0002 §dependency seam, ADR-0003 §tool contracts). This ADR gives the approved v1 line's phrase *"parsed LIVE from the source docs, never a duplicated table"* an operational definition, and rules on two verified internal contradictions in the source.

---

## Context

### C1. What "parsed LIVE" has to mean, and why prose is not enough

ADR-0003 already ruled that every `tools/call` returns `citations[]` with `minItems: 1` on both branches, each carrying a `sha256` over the LF-normalized cited range, so a caller can `resources/read` the cited file and recompute the hash. That makes *"check the server rather than trust it"* executable. It does not say **what the server reads**, **how it turns bytes into a routing answer**, or **what it does when two readings of the same repo disagree**. Without that, "parsed live" degrades into "a table transcribed into `server.mjs` once, refreshed by hand" — which is exactly the duplicated table the line forbids, and which `scripts/validate.mjs` would never catch, because check 5 diffs *templates* against §M8 and nothing else (`scripts/validate.mjs:513-583`).

The repo already treats this class of duplication as the primary defect mode. `execution-modes.md:399` — "**drift is a defect**"; `execution-modes.md:395` — "an omission with no note is indistinguishable from drift"; `model-routing.md:14` — "**If the two disagree, this file is the defect**". A server that adds an eleventh copy of the routing table is not neutral; it is a new drift site with no gate on it.

### C2. The substrate, measured

`execution-modes.md` is 48,550 bytes. `§M8` (`.claude/skills/loop-engine/references/execution-modes.md:303`) carries one fenced `js` block at lines **305–393**, **87 block lines**, opening with `// Canonical ROUTES block — single source of truth: …`. `scripts/validate.mjs:446 canonicalBlock()` already locates it by exactly the walk this ADR adopts: `^##\s+M8\.` heading (`:449`), then the first `^```js\s*$` under it aborting at the next `^##\s` (`:456-457`), then the first `^```\s*$` close (`:462`), then the first-line assertion `^\/\/ Canonical ROUTES block` (`:468`).

Evaluated (see C5), the block yields **three** modes and **ten** kinds:

```
ROUTES keys      : lite, balanced, all-out
kinds (all three): scout, doc, implement, analyze, synthesize, verify, judge, critic, gating, planner
MODE resolution  : lite→lite  balanced→balanced  all-out→all-out
                   optimize→balanced  full→all-out            (MODE_ALIAS, :310)
                   LITE→balanced  fast→balanced  absent→balanced   (silent fallback, §M9.5:421)
WIDTH()          : lite {gating 1, verify 1}  balanced {gating 3, verify 1}  all-out {gating 5, verify 3}
```

**The anchor comment is not unique.** A naive content-search locator — "find the fence whose first line is `// Canonical ROUTES block`" — matches **29 sites** in the tree: 27 `*.workflow.js` templates, `execution-modes.md:306` (the one authority), and `.claude/skills/loop-skill/references/template-contract.md:34`. That last one is a **stale illustrative copy**: its `MODE` line (`:37`) is the retired v1.1 two-mode definition and its `WIDTH` line (`:41`) has no `lite` branch, and no gate sees it because check 5 walks `*.workflow.js` only (`validate.mjs:592`). A content-search locator picks up a 50/50 chance of reading the wrong one.

### C3. `DRY_LIMIT` is not in §M8 — a second, unflagged authority split

Measured: `grep -c DRY_LIMIT` over `execution-modes.md:306-392` returns **0**. `const DRY_LIMIT` exists at exactly four sites in the plugin — `execution-modes.md:153` (inside **§M5**'s own fence, not §M8's) and three templates (`loop-until-dry.workflow.js:90`, `improvement-loop.workflow.js:98`, `project-coverage-plan.workflow.js:71`), all four byte-identical today. Two consequences follow:

1. `execution-modes.md:395` says "A template that does not loop omits `DRY_LIMIT`", listing it among the block's four sanctioned omissions — but it is not a member of the block at all.
2. `validate.mjs:508-509` registers `^const DRY_LIMIT` as an optional segment **of the canonical block** and therefore never finds it. That branch is dead code, and no gate enforces that the three templates' `DRY_LIMIT` lines match `execution-modes.md:153`. They agree today by hand, not by check.

So authority is **per symbol**, not per section, and a server that answers "where does the dry threshold come from?" with "§M8" would be wrong.

### C4. The two contradictions this ADR was asked to rule on, verified

**(a) §M5's stale quote.** `execution-modes.md:156` read, before this ADR:

> `MODE` is defined by the canonical `ROUTES` block in §M8 (`const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'`), and this line is byte-identical to the one there

§M8:309-311 defines `RAW_MODE` / `MODE_ALIAS` / `MODE` and has not looked like the quoted line since v1.1 (`§M9.6:427`). **Both** literal readings of the sentence are false: read as a claim about the quoted `MODE` line, the quote is the retired two-mode definition; read as a claim about the `DRY_LIMIT` line in the fence above it, there is no `DRY_LIMIT` line in §M8 to be identical to (C3). The same retired snippet survives verbatim at `template-contract.md:37`.

**(b) §M6's half-renamed formula.** `execution-modes.md:185-194`'s `width(n)` block labelled three rows `optimize` while the `BAND` table twelve lines below it (`:209`) is headed `` | Node kind | `balanced` | `all-out` | ``, and `:199` said "once at `mode = 'full'` … once at `mode = 'optimize'`" about that same table. §M6 contradicted itself within twenty-five lines.

Neither is cosmetic. §M6 is the pre-flight that prices the bill a human approves before any agent spawns (`:164`, `:229`), and §M5:156 is the paragraph an implementer reads immediately before pasting `DRY_LIMIT` into a template.

### C5. Evaluating beats reimplementing, and the repo already does it

`validate.mjs:373` evaluates template `meta` with `vm.runInNewContext('(' + literal + ')', Object.create(null), { timeout: 1000 })` rather than parsing it — the precedent for reading a fact out of a source file by running it. §M8's block is stronger than a literal: `MODE` is a two-step alias-then-membership expression (`:309-311`), `routeFor` has a fallback to `analyze` (`:351`), `WIDTH` is a nested ternary over mode *and* kind (`:352`), and `optsFor` encodes the omit-vs-pin rule and the `PLANNER` override (`:353-360`). A hand-written parser would have to re-derive all four, and would be free to be subtly wrong in a way nothing detects.

Measured properties of the locked context (Node v24.18.0), each verified by probe:

| Property | Measured |
|---|---|
| `process` / `require` / `globalThis.process` from a null-prototype context | all `undefined` |
| vm-realm `Function("…")`, `eval` | throw `EvalError` under `codeGeneration:{strings:false,wasm:false}` |
| synchronous infinite loop | throws `ERR_SCRIPT_EXECUTION_TIMEOUT` at the `timeout` |
| block syntax error | `SyntaxError`, catchable |
| free global (`input` unbound) | `ReferenceError`, catchable |
| `async function` body referencing unbound `agent`/`log` | **defines cleanly** — bodies are not evaluated |
| **host-realm object passed in as `input`** | **`input.constructor.constructor("return typeof process")()` returns `"object"` — the host realm is reachable** |

That last row is the one non-obvious result: `codeGeneration:{strings:false}` binds the *vm's* `Function`, not the host's, so any host-realm object handed into the sandbox is a prototype-chain bridge straight out of it. Constructing `input` **inside** the vm (or passing a null-prototype object) closes it — both verified clean.

Full extraction — read 48,550 bytes, locate, evaluate, hash — costs **1.98 ms** (50 iterations, 99.0 ms total). At that price "live on every call" is simply correct, and ADR-0001's deferral of caching costs nothing on this path.

### C6. §M3 is a genuine independent witness — and it is green

§M3's table (`:81-89`) is prose written for humans, authored separately from the block. Cross-checked mechanically against the evaluated `ROUTES` — after mapping its slash-separated row labels onto the ten keys — the result is **10 keys × 3 modes, zero disagreements, every key claimed exactly once**. The alias map needs three declared entries beyond the literal key names:

| §M3 row label token | maps to | why |
|---|---|---|
| `mechanical` | *nothing* | descriptive gloss on the `scout / doc` row |
| `correctness-critical` | *nothing* | descriptive gloss; `gating` is already a literal token in the same row |
| `**planner** with `--planner fable`` | *no key* — checked via `optsFor` | `:201` — "selected by the *flag*, not by the node"; `PLANNER` (`:312`) overrides only `opts.model` while effort still comes from `routeFor('planner')` |

The first draft of this cross-check reported `gating` claimed **twice**, because `correctness-critical` was mapped to `gating` *and* `gating` appeared literally in the same row. The bug was in the checker, not the doc: **row labels must be deduped to a set before counting**. That is a checker rule, not a doc rule, and it is pinned in the contract.

### C7. A third copy exists, and it is red

`model-routing.md`'s "Routing table (base route)" (`:31-43`) is a fourth statement of the same facts. Measured against the evaluated §M8:

- **Three disagreements**: `scout/all-out`, `doc/all-out`, `implement/all-out` all say effort `high` where §M8 says `xhigh`.
- **No `lite` column at all** — the table is still two-mode.
- Its header is half-renamed: `` | Node kind | balanced model | optimize effort | all-out model | full effort | Rationale | `` (`:35`).
- `execution-modes.md:221` carries the same class of error in prose — "a `scout` node moving Haiku 4.5 → Opus 5 at `high`", where §M8's `all-out.scout` is `xhigh`.

The tie-break is **already law** and needs no new ruling: `§M4:102` — "If they disagree, this file is the source and the other is the defect" — and `model-routing.md:14` — "**That file is the source of truth for the routing table and both modifiers; this file is the rationale and the worked example. If the two disagree, this file is the defect.**"

---

## Decision

We will extract every routing fact by **locating §M8 positionally and evaluating it in a locked `node:vm` context**, cross-checking the result against §M3's independently-parsed table, and we will treat any disagreement as a tool-level error that names both readings rather than silently picking one.

### D4.1 — Authority is per symbol, and the ladder is written down

| Symbol | Sole authority | Extraction |
|---|---|---|
| `MODE`, `MODE_ALIAS`, `PLANNER`, `ROUTES`, `routeFor`, `optsFor`, `WIDTH` | `execution-modes.md` §M8 fenced `js` block | evaluate (D4.3) |
| `DRY_LIMIT` | `execution-modes.md` **§M5**'s own `js` fence (`:152-154`) | evaluate, separate locate (C3) |
| `BAND`, `SIZE` | `execution-modes.md` §M6's markdown tables (`:209-217`) | table parse |
| `agents/items/width/tokens` formulae | `execution-modes.md` §M6's **untagged** fence (`:179-197`) | **not parsed** — returned as a cited text range with `parsed:false` |
| routing *rationale*, worked example | `model-routing.md` | never an answer source; advisory cross-check only (D4.8) |

§M6's fence carries `Σ`, `for a non-verify node` and prose clauses — it is pseudo-code, not JavaScript, and must never be fed to the evaluator. Returning it verbatim-and-cited follows ADR-0003's `standards_shelf` precedent: a parser limitation surfaced as `parsed:false` is honest; the same limitation hidden reads as an absence of rules.

### D4.2 — The locator is a coordinate, never a content search

`locate(file, headingRegex, fenceLang, ordinal, firstLineRegex)`, in that order, aborting at the next `^##\s`. For §M8 that is exactly `canonicalBlock()`'s walk (`validate.mjs:446-470`), reused rather than reinvented so the server and check 5 cannot diverge on what "the block" is. The first-line assertion is an **anchor, not an identifier**: measured, it matches 29 sites (C2), so it may only ever confirm a block already found by coordinate. A content search over the tree is forbidden — it would sometimes return `template-contract.md:34`, which is stale.

### D4.3 — Evaluate the block; never reimplement it

```
ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })
src = "const input = <literal built by the server>;" + block + ";({MODE,PLANNER,ROUTES,routeFor,optsFor,WIDTH})"
vm.runInContext(src, ctx, { timeout: 1000, displayErrors: true })
```

Five binding constraints, each traceable to a measurement in C5:

1. **`input` is constructed inside the vm from a JSON literal the server serializes.** No host-realm object crosses the boundary — measured, one does leak the host realm through `constructor.constructor` regardless of the context's `codeGeneration` setting.
2. `codeGeneration: { strings: false, wasm: false }`, `timeout: 1000`, null-prototype context object.
3. **The vm is isolation from the server's own globals, not a security boundary.** Node's own documentation says so, and the honest justification is provenance: §M8 is a law file in the repo the server ships from, held by check 5 and by review. If that ever stops being true, evaluation stops being safe and the fallback is D4.9's rejected alternative.
4. The harvested surface is exactly `{MODE, PLANNER, ROUTES, routeFor, optsFor, WIDTH}` — §M8:397's declared invariant core plus `WIDTH`, which §M8 always carries even though templates may omit it. `plannerAgent` / `fableGateAgent` / `FABLE_GATE` are **not** harvested: they call `agent()` and `log()`, which the server does not and must not provide.
5. Re-evaluate per distinct `input`; do not mutate a harvested `ROUTES`. At 1.98 ms per full extraction, evaluate live on every call.

### D4.4 — §M3 is parsed independently and cross-checked, with coverage asserted

Parse §M3's first markdown table under `^##\s+M3\.`; assert its data columns are exactly `['lite','balanced','all-out']`; map each row label through a **declared** alias table (C6) after `<br/>`-stripping; **dedupe each row's keys to a set**; assert every one of the ten `ROUTES` keys is claimed **exactly once** across the table; then compare cell-by-cell, `inherit → model:null` and `omit → effort:null`. The `--planner fable` row is checked through `optsFor({taskType:'planner'})` under `{planner:'fable'}`, never against `ROUTES`.

An unmapped row-label token is an **error, not a skip** (`crosscheck-label-unmapped`). A silently-skipped token is how a renamed kind stops being cross-checked while the coverage count still reads 10.

### D4.5 — Failure semantics: a disagreement is a tool-level error, never a silent winner

A closed error-code enum, extending ADR-0003 §D3.5's envelope. Three tiers:

| Tier | Codes | Behaviour |
|---|---|---|
| **Structural** — the source is unreadable | `source-missing`, `source-heading-missing`, `source-fence-missing`, `source-fence-unclosed`, `source-fence-empty`, `source-anchor-moved`, `source-block-uninterpretable`, `source-shape-changed` | `tools/call` returns `ok:false` / `isError:true` **in band**, per ADR-0002's degrade-not-die rule. `initialize` and `tools/list` still succeed; the server never dies on a bad document. |
| **Semantic** — two readings disagree | `crosscheck-disagreement`, `crosscheck-coverage`, `crosscheck-label-unmapped`, `crosscheck-columns-changed`, `mode-vocabulary-changed`, `kind-vocabulary-changed` | `ok:false`, and `error.details[]` carries **both** readings with **both** citations. Never resolve by precedence at call time. |
| **Advisory** — a non-authoritative copy drifted | `advisory-copy-drift` | `ok:true`. The answer is §M8's. The drift rides in `notes[]` with both citations. |

Two rules make this load-bearing. **The authority ladder in D4.1 does not license silent resolution.** §M8 wins a *doctrinal* dispute about which file to fix; it does not license the server to answer from §M8 while §M3 says something else, because §M3 disagreeing with §M8 means the reader of either one is being misinformed and the server is the only party that knows. And **`error.fix` is mandatory and imperative** (ADR-0002 §D2.4's grammar): `crosscheck-disagreement` fixes to "edit `execution-modes.md` §M3 to match §M8 — §M4:102 makes §M8 the source", never "ignore §M3".

### D4.6 — The contradiction ruling: §M8 and §M5's own fence are authoritative; the prose moved

**§M8's fenced block is authoritative for `MODE` and the mode vocabulary.** The three-mode `RAW_MODE` / `MODE_ALIAS` / `MODE` form at `:309-311` is correct; §M5's parenthetical quote of the retired two-mode line was the half that failed to move. **§M5's own fence (`:152-154`) is authoritative for `DRY_LIMIT`**, which §M8 does not carry (C3). **§M6's `BAND` table (`:209`) is authoritative for the mode vocabulary inside §M6**; the `width(n)` rows and `:199` were the half that failed to move.

Three surgical repairs were applied to `execution-modes.md` — 5 insertions, 5 deletions, no other file touched:

| Line | Before | After |
|---|---|---|
| 156 | ``…in §M8 (`const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'`), and this line is byte-identical to the one there — copy the whole block, never this snippet alone.`` | ``…in §M8 and is deliberately **not** restated here — read it there and copy the whole block, never a snippet of it. `DRY_LIMIT` is the one routed constant §M8 does *not* carry: **this fence is its single source of truth**, and a template that loops reproduces this line byte-identically from here.`` |
| 188/190/192 | `optimize, standard verify…` ×2, `optimize, correctness-critical/gating VERIFY` | `balanced, …` ×3 |
| 199 | ``once at `mode = 'full'` … once at `mode = 'optimize'` … against the optimize band`` | ``once at `mode = 'all-out'` … once at `mode = 'balanced'` … against the `balanced` band`` |

The §M5 repair **deletes a copy rather than refreshing it**. Refreshing the quote would have restored a second definition of `MODE` that drifts again on the next `§M8` edit with no gate on it — the exact failure being repaired. The replacement points at §M8 and states the `DRY_LIMIT` authority split that C3 uncovered, so §M5 is now the only place `DRY_LIMIT` is defined and says so.

Both gates re-run after the edit: `validate.mjs` **PASSED — 45252 assertions, 0 failures, 5 warnings**; `smoke.mjs` **26 of 27**, the same pre-existing `loop-v1/v1-conductor` planner failure recorded in `mcp/runtime-pin.json.gateBaseline`. Identical to the baseline in ADR-0001, ADR-0002 and ADR-0003. Neither gate reads §M5 or §M6 prose (`smoke.mjs` never opens `execution-modes.md`; `validate.mjs` reads only §M8 via `MODES_DOC`, `:25`), which is precisely why the drift survived and precisely why the repair is safe.

**Human-facing strings at `:229` and `:244` were deliberately left alone.** There, `optimize` is the word a human *types* as the third answer to the pre-flight question, not a mode value — renaming it would change a consent contract this ADR does not rule on. It is recorded as an open question, not silently swept into the diff.

### D4.7 — Eight probes, each demonstrated firing on a planted mutation

`E1` locate · `E2` evaluate · `E3` invariant core present · `E4` mode vocabulary pinned to `[lite, balanced, all-out]` + `{optimize→balanced, full→all-out}` · `E5` ten kinds identical across all three modes · `E6` §M3 cross-check with coverage · `E7` retired-vocabulary allowlist · `E8` advisory third-copy check.

**E7 is a sha256 content allowlist, not a line-number allowlist.** The first design pinned sanctioned lines by number; measured, deleting one §M3 row shifted every later line and produced two spurious failures. Pinning the **sha256 of the line text** is shift-proof and **shrink-only**: a sanctioned line that disappears is not an error (the compat shim shrinking is the intended direction, `§M9.6:429`), while any new or edited occurrence of a retired mode *value* fails. Two lines are sanctioned today: `:30` (the aliases-still-accepted sentence) and `:427` (§M9.6 itself).

The mutation matrix, all run against the real tree:

| Planted mutation | Caught by | Reported as |
|---|---|---|
| §M8 heading renamed `M8.` → `M8bis.` | E1 | `source-heading-missing` |
| anchor comment reworded | E1 | `source-anchor-moved` |
| §M8 fence retagged ```` ```js ```` → ```` ```javascript ```` | E1 | `source-fence-missing` |
| file truncated mid-block | E1 | `source-fence-unclosed` |
| §M8 fence emptied | E1 | `source-anchor-moved` |
| §M8 syntax broken (`const ROUTES = {{`) | E2 | `source-block-uninterpretable` |
| **§M8 reverted to the two-mode `MODE`** | E4, E6, E7 | `mode-vocabulary-changed: alias optimize resolves to optimize, pinned balanced` |
| §M8 `all-out.scout` effort `xhigh`→`high` | E6 | `crosscheck-disagreement` naming both readings |
| §M3 `balanced.implement` → `claude-opus-5` | E6 | `crosscheck-disagreement` naming both readings |
| §M3 loses the gating row | E6 | `crosscheck-coverage: [["gating",0]]` |
| §M3 gains an unmapped kind (`triage`) | E6 | `crosscheck-label-unmapped` |
| `MODE_ALIAS` remapped `optimize: 'lite'` | E4 | `mode-vocabulary-changed` |
| `MODE_ALIAS` line deleted | E2 | `source-block-uninterpretable` (`ReferenceError`) |
| **the stale `optimize` prose reinstated at `:156`** | E7 | `retired-vocabulary` naming the line |

The unmutated tree passes all eight (E8 excepted — see D4.8). Rows 7 and 14 are the ones the task asked for: **if §M8 is the half that moves back to the retired vocabulary, E4 fails; if the prose is the half that moves, E7 fails.**

### D4.8 — `model-routing.md` is advisory in v1, and its drift is pinned rather than fixed

E8 cross-checks `model-routing.md:31-43` and is **RED today**: three cells (`scout`, `doc`, `implement` at `all-out`) say `high` where §M8 says `xhigh`, and the table has no `lite` column (C7). Ruling: E8 emits `advisory-copy-drift` at `ok:true` with both citations in `notes[]`, never `ok:false`. Three reasons. The tie-break is already law twice over (`§M4:102`, `model-routing.md:14`), so §M8 answering is not a judgement call. The fix is an edit to a file D4 does not rule on. And blocking every `route_node` call on a pre-existing red would ship a server that never answers — the mistake ADR-0002 §D2.4 already ruled against.

The three cells are pinned by exact `(key, mode, statedEffort, canonicalEffort)` in `mcp/extraction-contract.json`, so a **fourth** disagreement fails the gate while these three do not, and repairing them fails the gate too — forcing the pin to shrink rather than rot. Same shrink-only property as E7.

---

## Consequences

**Positive**

- "Parsed live" becomes checkable in one grep: no routing table, no model ID and no effort string may be a literal in `mcp/server.mjs`, because every one of them is a property of an object the evaluator returned. That invariant is as mechanical as ADR-0002's "every import specifier begins with `node:`".
- Evaluating the block instead of parsing it means `MODE`'s alias-then-membership resolution, `routeFor`'s `analyze` fallback, `WIDTH`'s mode×kind ternary and `optsFor`'s omit-vs-pin rule are correct by construction. There is no second implementation to keep in sync, so ADR-0003's `route_node` cannot disagree with a running template.
- Sharing `canonicalBlock()`'s walk means check 5 and the server resolve "the block" identically. A §M8 edit that breaks one breaks the other, loudly, in the same commit.
- Two verified defects in a law file are repaired, and §M5's `MODE` copy is **deleted rather than refreshed**, removing a drift site instead of resetting its clock. The `DRY_LIMIT` authority split found on the way is now written down where an implementer reads it.
- 1.98 ms per full extraction on a 48.5 KB document. Live-on-every-call needs no caching, no invalidation and no staleness window — which is what makes the citation hashes in ADR-0003 honest.

**Negative**

- **The vm is not a security boundary**, and the host-realm escape through a passed-in object (C5) is a real, measured foot-gun that a future maintainer will not expect. Mitigation: D4.3.1 makes `input` a serialized literal built inside the vm, and the contract states the provenance argument explicitly so nobody reads "sandboxed" as "safe against hostile input". If §M8 ever stops being a reviewed in-repo law file, this decision must be revisited, not patched.
- Positional location is brittle by design: renaming the `## M8.` heading breaks extraction. That is the intended trade against a content search that measurably matches 29 sites including one stale copy — and E1 turns the brittleness into a named error rather than a wrong answer.
- E7's allowlist and E8's pinned cells are hand-maintained state. Both are shrink-only and both fail loudly when the pinned text changes, so they cannot rot silently — but "the gate went red because someone fixed the bug" is a genuinely confusing first experience and the contract spells out the message.
- `advisory-copy-drift` means the server knowingly answers while a repo file says otherwise. Mitigation: the note carries both citations and the imperative fix, so the caller sees the conflict rather than inheriting it silently.
- Next bottleneck: three of the five tools now depend on §M6's **untagged** pseudo-code fence, returned `parsed:false`. `estimate_phase` therefore hands back text a caller must read. If that proves too weak, the fix is to make §M6's formula an evaluable `js` fence — a law-file change well outside this ADR.

## Alternatives Considered

- **Transcribe the table into `server.mjs` and refresh by hand** — rejected outright: it is the duplicated table the approved v1 line forbids, it adds an eleventh drift site with no gate on it, and `validate.mjs` check 5 would never see it (`:513-583`).
- **Hand-write a parser for the `ROUTES` object literal** (regex or a small JS-subset reader) — rejected: it would have to re-derive `MODE`'s two-step alias resolution (`:309-311`), `routeFor`'s fallback (`:351`), `WIDTH`'s nested ternary (`:352`) and `optsFor`'s omit-vs-pin rule (`:353-360`), any of which can be subtly wrong with nothing to detect it. `validate.mjs:373` already set the evaluate-don't-parse precedent for exactly this reason.
- **Locate the block by content search on `// Canonical ROUTES block`** — rejected on measurement: 29 matching sites, one of which (`template-contract.md:34`) carries the retired two-mode `MODE` and a `lite`-less `WIDTH` and is invisible to every gate.
- **Treat §M3 as authoritative and §M8 as the cross-check** — rejected: §M8 is what templates copy verbatim and what check 5 enforces (`validate.mjs:513`), so §M8 is what actually executes. A server answering from §M3 could route a node differently from the template running beside it.
- **Resolve disagreements by precedence at call time (answer from §M8, stay silent)** — rejected: it is the failure this whole conduct exists to prevent. The server is the only party that reads both files on every call; suppressing the conflict converts a detectable defect into a durable one and makes §M3 a trap for every human who reads it.
- **Fail every call while `model-routing.md` is red** — rejected: the drift predates this work, the tie-break is already law twice over, and a server that refuses to answer until an unrelated file is fixed violates ADR-0002 §D2.4's degrade-not-die rule.
- **Specify the §M5/§M6 repairs without applying them** (ADR-0002 §D2.6's precedent) — rejected here: the task explicitly rules on these lines, both gates are provably blind to them, applying leaves the probe suite green on a clean tree instead of shipping a permanent known-red carve-out for the very defect being ruled on, and ADR-0003 already flagged the §M5 line as a live hazard for this work. The repairs touch prose only; both gates re-ran unchanged.
- **Do nothing / defer** — rejected: ADR-0003's tool contracts are already written against these documents, and every later phase would encode "parsed live" differently. The §M5 defect in particular is a live hazard — an LLM reading the paragraph nearest `DRY_LIMIT` gets the retired two-mode vocabulary and writes a template that check 5 then rejects.
