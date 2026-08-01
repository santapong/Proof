# ADR-0005: The server never guesses — no silent default, byte-identical arithmetic

## Status

**Accepted**

Date: 2026-07-27 · Deciders: `loop-algo` (D5, phase 1 DECIDE, theloopskill-mcp conduct)

Governs `theloopskill-mcp` (`mcp/`) in full. Composes with, and does not amend, ADR-0001 (runtime), ADR-0002 (dependency seam and boot contract), ADR-0003 (tool contracts), ADR-0004 (extraction strategy). Where those ADRs ruled a specific case, this one states the general law they were instances of, proves it, and derives the cases nobody has ruled yet.

Machine-readable companion: `mcp/correctness-invariant.json`.

**Honesty labels used throughout, per `loop-algo` §2:** `MEASURED` (a runner ran, today, against this tree), `DERIVED-ONLY` (reasoning, no runner), `PROVED` (induction with stated precondition), `EVIDENCE` (sampling; not a proof). Every measurement in this file was taken on 2026-07-27 against `develop` @ `4dd461a` with D4's `execution-modes.md` repair applied.

---

## Context

### 1. The repo already contains both layers, and says so in its own words

`execution-modes.md` §M2:59 is the **parser layer**, and it forbids guessing in as many words:

> An **absent** `--mode` resolves to `balanced` **silently** — no prompt, no warning, no "did you mean". An **unrecognized** value is never guessed: name the three valid values and ask […] Guessing `--mode fast` means `balanced` is how a user discovers their run was cheapened after they paid for it.

§M8:306-392 is the **script layer**, and it does the thing §M2:59 names as the failure. Two fallback branches:

- `:311` — `const MODE = MODE_ALIAS[RAW_MODE] || (['lite','balanced','all-out'].indexOf(RAW_MODE) >= 0 ? RAW_MODE : 'balanced')`
- `:351` — `const routeFor = (kind) => (ROUTES[MODE] && ROUTES[MODE][kind]) || ROUTES[MODE].analyze`

This is not an accusation; it is the correct design **for a script**. H10 (`harness-policy.md:76`) gives a workflow script no filesystem, no module system and no way to prompt a human, so a script that refused an unrecognized mode could only die — and dying mid-DAG is worse than running the default. §M9.5:421 says exactly this out loud, and records that it already cost a breaking rename:

> a workflow that means something else by `mode` will silently mis-route every node in the run, because `ROUTES[MODE]` falls back to `balanced` for any unrecognized value rather than **failing loudly**.

The forgiveness is load-bearing where it lives. **The question this ADR answers is whether an MCP tool inherits it.** It does not, and the reason is structural rather than stylistic: a script's wrong route costs one run that a human is watching; a server's wrong route is handed to four routers wired to trust it (ADR-0003 §D3.8), and is handed to them with a citation attached, which is what converts a guess into evidence.

### 2. What the script layer actually does with bad input — MEASURED

`vm.runInContext` over the **real** §M8 block, located by ADR-0004's coordinate walk (heading `^##\s+M8\.`, first ` ```js ` fence → lines 306-392, 6278 bytes), `input` constructed inside the vm per ADR-0004 §D4.3. Probe: `scratchpad/d5probe/vmprobe.mjs`.

| `input.mode` | Resolved `MODE` | `routeFor('scout')` | `WIDTH('gating')` | Class |
|---|---|---|---|---|
| `balanced` / `lite` / `all-out` | itself | correct | 3 / 1 / 5 | exact |
| `optimize` / `full` | `balanced` / `all-out` | correct | 3 / 5 | declared alias (§M9.6) |
| `fast` | **`balanced`** | haiku-4-5 | 3 | **silent substitution** |
| `LITE` | **`balanced`** | haiku-4-5 | 3 | **silent substitution** |
| `All-Out` | **`balanced`** | haiku-4-5 | 3 | **silent substitution** |
| absent / `''` | `balanced` | haiku-4-5 | 3 | declared default (§M2:59) |
| `constructor` | *(the `Object` function)* | — | — | **`TypeError: Cannot read properties of undefined (reading 'analyze')`** |
| `toString` / `valueOf` / `__proto__` | *(prototype member)* | — | — | same `TypeError` |

Three findings, all new to this phase:

1. **`fast` → `balanced` is the exact scenario §M2:59 names**, running live in the block that §M2:59 sits eight sections above. The parser layer forbids it and the script layer performs it. A server that reuses the block without a guard performs it too.
2. **`LITE` and `All-Out` are a layer split, not a typo.** §M2:59 opens with "Both flags are case-insensitive." §M8:311 uses `indexOf(RAW_MODE)`, which is case-**sensitive**. The same line that forbids guessing also promises case-folding, and the block eight sections below implements neither. Case-folding is a parser-layer promise that the script layer does not implement, and nothing needs it to — the two files that parse flags (§M2:63) fold case before the value reaches a script. An MCP tool is a **third** entry point into §M8 that did not exist when that division was drawn, and it is the one entry point where the caller's raw string arrives unfolded.
3. **`MODE_ALIAS` is a plain object literal, so its prototype chain is in the key domain.** `MODE_ALIAS['constructor']` is truthy, `MODE` becomes a function, `ROUTES[MODE]` is `undefined`, and `:351`'s `|| ROUTES[MODE].analyze` dereferences it. Four measured inputs produce an **unnamed** `TypeError` with no source span in it. This is not a §M8 defect — no flag parser can emit `constructor`, and D5 does not rule on §M8, whose block is duplicated verbatim into 27 templates where any edit is a fleet-wide change. It is a statement about **who must validate**: under ADR-0001's hand-rolled zero-dependency server there is no SDK doing JSON-Schema enforcement, so the `enum` ADR-0003 §D3.6 advertises is documentation until the server enforces it in code.

### 3. The unruled hazard is the *kind*, not the mode

ADR-0003 §D3.5 gives `unknown_mode` a dedicated error code that "MUST name the three advertised values and MUST NOT guess (§M2:59)", and ADR-0004 §D4.5's `unknownModeInteraction` requires validating mode **before** evaluating. Both are right. Neither covers `:351`, which is the sharper of the two branches — MEASURED, same probe:

| `taskType` | mode | correct route | route after a typo (`gate`, `Gating`, `gatiing`) | delta |
|---|---|---|---|---|
| `gating` | `balanced` | `claude-opus-5`, `max`, width **3** | `null` (inherit), `high`, width **1** | model pin lost, effort `max`→`high`, width 3→1 |
| `gating` | `all-out` | `claude-opus-5`, `max`, width **5** | `claude-opus-5`, `xhigh`, width **3** | effort `max`→`xhigh`, width 5→3 |
| `implement` | `lite` | `claude-sonnet-5`, omit | `claude-sonnet-5`, `medium` | effort silently added |

A one-character typo in the node kind that §M3:87 describes as *"a false 'all clear' ships the defect"* silently loses its model pin and two thirds of its verifier width, and returns a plausible, fully-formed, **citable** route while doing it. There is no code for this today: ADR-0003's closed enum has no `unknown_task_kind`.

### 4. §M6 already promises determinism, and the promise is load-bearing

Two sentences, both authored before this server existed:

- §M6:177 — "**Estimation method — pure deterministic arithmetic over the authored DAG.** No sampling, no `Date.now()`, no `Math.random()`, no argless `new Date()`."
- Fleet-discipline note :437 — "Because nothing is sampled, the same DAG under the same mode yields **byte-identical numbers** on every run — which is exactly what makes an approved estimate diffable against actual spend."

That second clause is the whole reason `estimate_phase` can exist. §M6:237-241 stamps the approved figures into the script as `const ESTIMATE = { agents: 42, tokensLow: 380000, tokensHigh: 720000, mode: 'all-out' }` so the gate can diff approved-vs-actual against `journal.jsonl`. **A diff is only meaningful if re-running the estimator on the same DAG reproduces the approved numbers exactly.** One token of drift and the gate reports a delta that no human action caused.

### 5. The arithmetic is exact today by accident, not by construction — MEASURED

§M6:196 defines `tokens(n) = agents(n) × BAND[kind][mode] × SIZE[n.size]`, and §M6:225 defines `SIZE` as `compact ×0.4, standard ×1, long-form ×3`. **`0.4` is not representable in IEEE-754 binary64.**

It happens not to bite: all **19 distinct** endpoints in §M6's `BAND` table (:211-217) are divisible by 5, so `band × 0.4` lands exactly on the integer `2·band/5` for every published value — MEASURED, 0 non-integer results over the full table. Every float and integer path agrees today.

But §M6:223 mandates "Re-baseline both columns at every gate", :219 records that every row was already lifted ~2.5× on 2026-07-27, and :437 calls `BAND` and `SIZE` "the only tunable numbers in this file". The exactness therefore rests on a property of the constants that **nothing in the repo requires, documents, or checks**. The counterexample class is any band `b` with `5 ∤ b` — MEASURED: `12346 × 0.4 = 4938.400000000001`, against the exact rational `4938.4`.

And once subtotals leave the integers, the total depends on **summation order** — MEASURED, five such nodes, all `5! = 120` permutations:

| Path | Distinct totals over 120 orders |
|---|---|
| float subtotals, summed | **3** — `249606.80000000002`, `249606.8`, `249606.80000000005` |
| integers (round at the node), summed | **1** — `249607` |

Three answers to one question is a **disproof** of ":437 byte-identical" for the float path under a re-baselined table. It is latent rather than live, and it is exactly the kind of thing that ships because the day it breaks is the day someone edits a calibration constant for an unrelated reason.

### 6. The freshness/caching trade has a measured price

Re-reading both substrates per call — `execution-modes.md` (48,550 bytes) plus `boundary-audit.json` (70,859 bytes, parsed) — costs **0.729 ms per call**, MEASURED over 200 iterations (145.76 ms total, warm page cache). ADR-0004 measured the §M8 vm extraction at **1.98 ms**. Total under 3 ms of a tool call whose ceiling is a model turn.

---

## Decision

**We will hold `theloopskill-mcp` to a single correctness invariant, in two parts, and treat every tool as a parser-layer citizen rather than a script-layer one.**

### D5.1 — The invariant

> **I1 (Provenance).** Every field of every `ok:true` result is either (a) the content of a byte range of a named source file located by coordinate, or (b) the value of a pure total function applied to such ranges and to caller arguments that were validated against an enumeration itself read from a source range. **No field is ever a value the server selected because a lookup failed.**
>
> **I2 (Totality).** Every call terminates in exactly one of two outcomes: `ok:true`, with `citations[]` non-empty and every citation resolving; or `ok:false`, naming **the span it could not find** — the file, and the heading or JSON Pointer it looked under. There is no third outcome: no partial result, no result carrying a substituted default, and no unnamed throw.

Stated as one sentence for a reviewer: **every answer is derived from a located source span, or is an error naming the span it could not find.**

### D5.2 — Proof

`PROVED — I1 holds by structural induction over the answer-construction function, under the stated precondition.`

- **Precondition (the assumption the proof forces onto the implementation).** Every caller-supplied value that is used as a **key** into a source-derived table is checked for membership in that table's key set, read from the source, **before** any evaluation or lookup occurs. Under ADR-0001's hand-rolled server nothing supplies this for free; it is code, and D5.3 makes it a gate assertion.
- **Base case.** A located span. Its provenance is the locator (file, heading regex, fence ordinal, line range) plus the `sha256` ADR-0003 §D3.2 already requires over the LF-normalized range. Provenance holds by construction.
- **Inductive step.** Assume every input to a construction step satisfies I1. Each step is one of: (i) a projection or field read of a located value — provenance is inherited; (ii) a lookup `T[k]` where `T` derives from a located span and `k` was validated by the precondition — total on its domain, so the fallback arm is unreachable and provenance is inherited from `T`; (iii) arithmetic over located numerals, covered by D5.4. There is no fourth step shape, because the only construct that can introduce an unsourced value is a fallback arm, and (ii) makes every such arm unreachable.
- **Termination.** Validation is a finite membership test over a finite enumeration; evaluation is bounded by ADR-0004's `timeout: 1000`. Every path reaches `ok:true` or an `ok:false` in ADR-0004 §D4.5's closed code set.
- **Where the proof breaks if the precondition is dropped.** Precisely the eight measured rows in Context §2 and the three in §3. That is not a coincidence — it is the same reasoning read backwards, which is what makes the precondition worth writing down rather than assuming.

`MEASURED` corroboration, not proof: the eleven adversarial inputs in Context §2-3 are the shrunk counterexamples that the precondition must reject. `EVIDENCE — no further counterexample was sought by generation; the input domain here is a five-element enum and a ten-element enum, small enough to enumerate exhaustively, and D5.3.2 requires exactly that.`

### D5.3 — Consequences derived, as binding constraints

**D5.3.1 — Validate before evaluate. Enumerations come from the source, not from a literal.**
`mode` is checked against the accepted five (`lite|balanced|all-out|optimize|full`) and `taskType` against the ten keys of `ROUTES[MODE]` **before** §M8 is evaluated. Both key sets are read from the located block, never hardcoded — a hardcoded enum is itself a silent default about what the source says. Rejection is ADR-0003's in-band error envelope, and it **names the valid values**, per §M2:59.

**D5.3.2 — `unknown_task_kind` is required, and ADR-0003's closed enum needs one entry.**
Symmetric to `unknown_mode`: the message MUST enumerate the ten kinds and MUST NOT guess. `routeFor`'s `|| ROUTES[MODE].analyze` arm is then unreachable from the server, which is the point — it stays intact in the block for the 27 templates that need it. D5 does not edit `mcp/tool-contracts.json`; the required addition is recorded in `mcp/correctness-invariant.json` under `requiredAdditionsToD3Enum` and is an open question below.

**D5.3.3 — Doc-shape probes throw named errors; they never degrade to a fallback.**
ADR-0004's E1-E8 already fail closed. D5 states why, and adds the boundary: a probe failure is a **structural** error under §D4.5, it names the file and the heading or fence it could not find, and it is never converted into "the previous answer" or "the default block". Note the seam with ADR-0002's degrade-not-die: **the server does not die, the call does.** `initialize`, `tools/list` and `resources/list` still succeed; a missing document is answered in band, with the fix instruction, on the call that needed it.

**D5.3.4 — A cross-check mismatch propagates as an error and never resolves by precedence at call time.**
ADR-0004 §D4.5's semantic tier, restated as a consequence of I1: when §M3's table and §M8's block disagree, *both* readings are located spans and I1 cannot pick between them without inventing a preference. Returning either one as `ok:true` would be a silent default about which file is right. The authority ladder settles which **file to fix**; it does not license answering while the other file misinforms every human who reads it.

**D5.3.5 — No tool returns a partially-parsed table. Atomicity is per section.**
The unit of parse-success is one Markdown table under one heading. Either every row of that table parsed, and it is returned with `parsed:true`; or **none of it is**, and the section comes back as raw text with `parsed:false` plus a row in `unparsedSections` naming the reason — ADR-0003 §D3.6's `standards_shelf` shape. This is the reconciliation between "degrade rather than promise rows" and "no silent default", and it is not a compromise between them: **half a table is the worst possible answer**, because a caller cannot distinguish "this shelf has four standards" from "this shelf has nine and five rows failed a regex". Six of 21 shelves lack the grade vocabulary and two yield zero rows (ADR-0003), so this path is live, not theoretical.

**D5.3.6 — `estimate_phase` reads no clock and no randomness.**
`Date.now()`, argless `new Date()`, `Math.random()`, `process.hrtime`, `performance.now()`, environment variables, locale-dependent formatting (`toLocaleString`), and filesystem timestamps are all forbidden inside the estimator. §M6:177 already says the first four for scripts; D5 extends the list and binds it to the server. This is not defensive style — §M6:437's byte-identity promise is the only thing that makes the §M6:240 `ESTIMATE` block diffable against actual spend, and one clock read destroys it permanently.

**D5.3.7 — No caching, no watch mode, in v1. This is a decision, not an omission.**
Every call re-locates and re-reads. Freshness is then a **property of the mechanism** rather than an invariant somebody has to maintain: there is no cache key to get wrong, no invalidation to miss, and no window in which the server answers from a document the user has already edited. That last one matters more here than in a normal service, because the expected editing session *is* someone changing these very documents and asking the server what they now say. Measured price: 0.729 ms of I/O plus ADR-0004's 1.98 ms of extraction, against a model turn. Caching would buy ~2.7 ms and cost the one property the server is for. Revisit only if a measurement shows the read is material — and then cache on `(path, size, mtimeNs, sha256)`, never on path alone.

### D5.4 — Byte-identical arithmetic: the integer-domain rule

Four rules, together sufficient for exact reproducibility. `PROVED` where marked.

**A1 — Represent `SIZE` as an exact rational, never as a decimal literal.**
`compact = 2/5`, `standard = 1/1`, `long-form = 3/1`. The multiplier never appears as `0.4` in server code. §M6:225's prose stays as it is — `×0.4` is the right thing to say to a human — and D5 does not edit it.

**A2 — Round at the node, sum in integers.**
Per node: `subtotal = ⌊(2·agents·band·num + den) / (2·den)⌋`, all operands integers, which is round-half-up on the exact rational `agents·band·num/den`. Then sum the integer subtotals. Rounding happens at exactly **one** declared point with exactly **one** declared rule; a rounding rule that is declared and applied at a fixed point is not a silent default, whereas an implicit float truncation appearing wherever the last operation happened to land is.

**A3 — Order-independence.**
`PROVED — under A2, every subtotal is a non-negative integer, and every partial sum is a non-negative integer ≤ 2^53, hence exactly representable in binary64; binary64 addition of exactly-representable values whose exact sum is exactly representable is exact; exact integer addition is associative and commutative; therefore the total is independent of node iteration order.`
Precondition margin, MEASURED: the worst realistic node (25 agents × the 230k `planner on Fable` high band × `long-form` ×3) gives a max intermediate `2·num + den` of **34,500,001**, a factor of **2.6 × 10⁸** below 2^53. The `≤15 agents per workflow` guideline (§M6:254) keeps real DAGs well under this.
`MEASURED` corroboration: 1 distinct total across all 120 permutations of five nodes, against **3** for the float path.

**A4 — Two guards.**
(i) Assert `Number.isSafeInteger` on every subtotal and on the running total; a violation is `internal`, never a rounded answer. (ii) Assert `den | (agents·band·num)` is *not* required — A2's rounding makes it unnecessary — but the estimator reports `exact: true|false` per node so a caller can tell a rounded subtotal from an exact one. That flag is itself derived, not defaulted.

**Not ruled here.** §M6's `BAND` and `SIZE` values, which are calibration (:437). D5 rules how they are combined, never what they are.

### D5.5 — Gate assertions D5 adds

Nine, on top of ADR-0003's fifteen and ADR-0004's nine. Full text in `mcp/correctness-invariant.json` §`D5_5_gateAssertions`; in summary: exhaustive rejection of the eleven measured adversarial inputs with the correct code and a message naming the valid values; `unknown_task_kind` over all ten kinds plus four typo forms; no fallback route ever returned; the 120-permutation order-independence check; a scan of the estimator's reachable code for the eight forbidden non-determinism sources; per-section atomicity on `standards_shelf`; and a `5 ∤ band` canary that fails loudly if a re-baseline reintroduces the float hazard while the integer path is somehow bypassed.

---

## Consequences

**Positive**

- **The server is falsifiable.** I1 plus ADR-0003's `sha256` citations means a caller can verify any answer over the same connection: `resources/read` the cited file, recompute the hash, re-derive. "Check the server rather than trust it" becomes executable rather than aspirational.
- **A typo costs a sentence instead of a run.** The measured `gating`→`analyze` downgrade — model pin lost, width 3→1 — becomes an error naming the ten valid kinds, before four routers propagate it.
- **The approved-vs-actual gate keeps working.** A3 makes §M6:437's byte-identity a proved property of the estimator rather than an accident of today's calibration table, so the gate's deltas stay attributable to real spend.
- **Freshness needs no maintenance.** No cache means no invalidation bug is possible, which is worth more than 2.7 ms.
- **It composes rather than amends.** ADR-0003 §D3.5's `unknown_mode` and ADR-0004 §D4.5's tiers are instances; this ADR is the rule they instantiate, so nothing above is rewritten.

**Negative**

- **Validation is code someone must write, and ADR-0001 guarantees nothing writes it for you.** The hand-rolled server does not enforce its own advertised `enum`. Mitigation: D5.5's exhaustive rejection assertions, which enumerate a five-element and a ten-element domain — small enough that "exhaustive" is honest.
- **The server is stricter than the script layer, deliberately, and the asymmetry will surprise someone.** `--mode fast` runs (as `balanced`) but `route_node({mode:'fast'})` errors. That is the parser/script split working as §M2:59 designed it, but it needs to be in the tool descriptions or it reads as a server bug. Mitigation: ADR-0003 already requires each tool to state its fallback, and the fallback is today's instruction unchanged — read §M8.
- **A1/A2 make the estimator's code diverge from §M6's prose.** The prose says `×0.4`; the code says `2/5`. Mitigation: the divergence is *pinned* in `mcp/correctness-invariant.json` as an exact-rational encoding of the same value, with the assertion that `num/den === 0.4` at the published bands — MEASURED true for all 19 endpoints. A future re-baseline that breaks it fails the canary rather than silently drifting.
- **Where it breaks first:** a source document that is *validly parseable but semantically new* — an eleventh node kind added to `ROUTES`, or a fourth mode. I1 handles it correctly by construction (the enum is read from the source, so a new key is simply accepted), but every consumer router pinned to ten kinds will not be, and no gate here catches that.

## Alternatives Considered

- **Inherit the script layer's fallbacks (`MODE→balanced`, `kind→analyze`) for symmetry with what templates actually run.** Rejected on the measured blast radius: it answers a typo with a plausible, citable route, and ADR-0003 §D3.8 wires four routers to trust the answer. §M2:59 already rules against it for the parser layer and §M9.5:421 already records the cost when a name collided. Symmetry with §M8 is the wrong goal — the server is a different layer, and §M2/§M8 are the repo's own demonstration that the two layers get different rules.
- **Fall back, but disclose it in `notes[]` or `deprecations[]`.** The most tempting option, and the one that loses most instructively: it preserves `ok:true`, so a schema-driven consumer reads `result.route` and never reads `notes[]`. A disclosure the machine consumer structurally cannot see is a silent default with extra bytes. Deprecation notes are legitimate for the two **declared** aliases (`optimize`, `full`) precisely because those are not guesses — the source declares them at §M9.6:427.
- **Validate with a JSON-Schema library.** Rejected upstream by ADR-0001: a runtime dependency is dead on arrival after `/plugin install`, measured. The domains here are a five-element and a ten-element enum; a membership test is two lines.
- **Float arithmetic, rounded once at the end (`Math.round` of the total).** Rejected on the 120-permutation measurement: three distinct totals means the answer depends on node iteration order, and §M6:437's promise is unconditional. Sum-then-round happened to agree with round-then-sum on the probed case, which is worse than disagreeing — it is a bug that passes its first test.
- **Cache the parsed documents, invalidate on `mtime`.** Deferred, not rejected. It buys a measured 2.7 ms and costs the freshness-by-construction property during exactly the editing session the server exists to support. Revisit with a measurement, and key on `(path, size, mtimeNs, sha256)` — `mtime` alone has a one-second granularity on some filesystems, which is a silent default about whether a file changed.
- **Do nothing / leave the invariant implicit in ADR-0003 and ADR-0004.** Rejected because the two cases those ADRs ruled were the two someone happened to look at. The unruled `routeFor` branch is the more damaging of the pair, and it stayed unruled through three prior rulings — which is the argument for stating the law rather than accumulating instances.
