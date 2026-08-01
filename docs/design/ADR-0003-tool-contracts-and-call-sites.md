# ADR-0003: Publish five cited-answer tools behind one envelope, advertise three mode names, and make every call site work with the server absent

## Status

**Accepted**

Date: 2026-07-27 · Deciders: loop-design (D3, phase 1 DECIDE of the theloopskill-mcp conduct)

Machine-readable contract: [`mcp/tool-contracts.json`](../../mcp/tool-contracts.json) — normative. This file is the reasoning; that file is what an implementation and a gate are checked against.

Prior rulings this phase: [ADR-0001](../../mcp/ADR-0001-runtime-and-dependency.md) (zero-dependency hand-rolled stdio server, protocol pins) and [ADR-0002](ADR-0002-dependency-seam-and-boot-contract.md) (dependency seam at `spawn`, boot-failure contract, degrade-not-die). D3 consumes both and contradicts neither.

## Context

### 1. What the five tools actually read, and how much of it is checkable

The approved v1 line puts five tools over four source substrates:

| Tool | Source | Size at head `4dd461a` |
|---|---|---|
| `route_node` | `execution-modes.md` §M3 (:77), §M5 (:126), §M8 (:303) | 439-line Markdown |
| `estimate_phase` | `execution-modes.md` §M6 (:164), BAND (:209), SIZE (:225) | same file |
| `boundary_lookup` | `docs/design/boundary-audit.json` | `matrix` 21, `overlaps` 28, `descriptionRewrites` 18 |
| `standards_shelf` | `.claude/skills/*/references/standards.md` | 21 files |
| `run_gate` | `scripts/validate.mjs`, `scripts/smoke.mjs` | exit codes + printed summaries |

Only two of those five substrates are structured. `boundary-audit.json` is JSON. The gates emit a fixed line format. The other three are prose that a human maintains, and the amount of structure varies far more than a designer would assume from reading one example — which is the finding that shaped three of the rulings below.

### 2. The prose in the source docs is already provably stale, and no gate catches it

`execution-modes.md:156` says:

> `MODE` is defined by the canonical `ROUTES` block in §M8 (`const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'`), and this line is **byte-identical to the one there**

It is not. §M8 has defined mode across three lines since v1.2:

```js
const RAW_MODE = (input && input.mode) || 'balanced'                          // :309
const MODE_ALIAS = { optimize: 'balanced', full: 'all-out' }                  // :310
const MODE = MODE_ALIAS[RAW_MODE] || (['lite','balanced','all-out'].indexOf(RAW_MODE) >= 0 ? RAW_MODE : 'balanced')  // :311
```

No gate sees this. `validate.mjs` check 5 extracts the canonical block via `canonicalBlock()` (`scripts/validate.mjs:446-470`) and diffs it against every **template**; it never diffs `execution-modes.md`'s own surrounding prose against the block that file contains. `smoke.mjs` executes templates, not documentation.

This is the load-bearing fact behind the citation requirement. A tool that answered from the nearest paragraph would return a two-mode vocabulary that was retired two minor versions ago, confidently and with no failing gate anywhere. **The only defence available is that the caller can check.**

### 3. The 21 standards shelves are not uniformly structured — measured, not assumed

Counted at head `4dd461a`:

| Property | Count |
|---|---|
| Shelves total | 21 |
| Shelves with **zero** Markdown table rows | **2** — `loop-incident` (115 lines), `loop-operate` (127 lines) |
| Shelves carrying the exact three-grade vocabulary `Authoritative — yes` | **15 of 21** |
| Shelves lacking it | `loop-algo`, `loop-frontend`, `loop-integrate`, `loop-ship`, `loop-skill`, `loop-v1` |
| Shelves with a confirmation log | **21 of 21** |
| Smallest shelf | `loop-v1` — 17 lines, 6 table rows, 1 `##` heading |

A table-row parser returns **nothing at all** for the two largest prose shelves. A grade filter silently excludes six skills. Both failures look exactly like "this skill has no standards," which is the worst possible way to be wrong on a shelf whose entire purpose is that a citation is real.

### 4. Not connected is the default state

`.claude/skills/loop-harness/references/mcp.md:55`: *"Project `.mcp.json` servers require a workspace-trust approval the first time a repo is opened (a security default, since a server can run code)."* And there is no `.mcp.json` in the repo at all today, and no `permissions` block in `.claude/settings.json`. So the sequence for any fresh checkout is: file present, server absent, until a human approves. Designing the routers as though connected is normal inverts the actual distribution.

### 5. Nothing inside a running workflow script can call any of this

H10 (`harness-policy.md:76-81`) ends with *"No filesystem or Node.js API access inside scripts."* The repo's only enumeration of the ambient surface is `scripts/smoke.mjs:79`:

```js
const fn = new AsyncFunction('agent','parallel','pipeline','log','phase','budget','args','console', src)
```

Two honest caveats. That is a **stub** of the Workflow runtime, so it is evidence of what templates consume, not a published spec of what the runtime provides. And the identifier `workflow` — named in the brief that commissioned this ruling — appears nowhere in the repo as a callable global; `grep` finds only "the Workflow tool" as prose. Neither caveat touches the conclusion: H10 removes the filesystem and the module system, so there is no transport an MCP client could use, whatever the exact global list turns out to be.

There is a pleasant corollary. §M6 already places the pre-flight *"in the orchestrating session, after the phase's script is authored and before the Workflow tool is called"* and says explicitly *"That placement is not incidental; it is the **H10 answer**"* (`execution-modes.md:166-168`). `estimate_phase` is therefore H10-aligned by construction rather than by concession — it lives exactly where the doctrine already put the arithmetic.

### 6. The mode vocabulary is mid-deprecation, and the repo already solved this once

§M9.6 (`:427-429`): the aliases *"still resolve"* so that *"no existing invocation, persisted script or Routine breaks"*, and they *"will be removed in the next major"* — *"a compatibility shim, not a second vocabulary."*

The repo already runs the split this ADR needs. §M2's published grammar (`:54`) advertises `--mode <lite|balanced|all-out>` and never mentions the aliases; §M8's `MODE_ALIAS` (`:310`) accepts them at runtime. Advertise three, accept five. There is nothing to invent.

## Decision

### D3.1 — One envelope, wrapped so that failure still conforms

Every `tools/call` on every tool returns the same envelope: `{ ok, tool, authoringTimeOnly, serverVersion, sourceRoot, result?, error?, citations[], deprecations[], notes[] }`, with `isError === !ok`. `result` is present iff `ok`; `error` is present iff `!ok`.

The wrapper exists so an `isError: true` result **still validates against the `outputSchema` the tool advertises**. Returning a bare error object is the common way a server's declared output schema becomes a lie under exactly the conditions a caller most needs it to hold.

Both `structuredContent` and `content[0] = {type:'text', text: JSON.stringify(...)}` are always returned. `outputSchema`/`structuredContent` exist from protocol `2025-06-18` — which is what ADR-0001 advertises — and a `2024-11-05` client silently ignores `structuredContent`, so the text block is the compatibility floor rather than duplication.

### D3.2 — Every answer cites file, section, line range and a hash

Required, `minItems: 1`, **on both branches** — an error cites where the server *looked*. Each citation carries `file` (repo-relative POSIX), `section` (the verbatim enclosing ATX heading for Markdown; an RFC 6901 pointer for JSON), `startLine`/`endLine`, `sha256` of the LF-normalized cited lines, an optional capped `excerpt`, and a `resourceUri`.

Two things make this a check rather than a claim:

- **Round-trip, gate-asserted.** For every citation on every golden query the gate re-reads `file[startLine..endLine]`, recomputes the hash, and asserts equality.
- **Over the wire.** `citation.resourceUri` resolves through this same server's `resources/read`, so the caller can fetch the cited file and recompute the hash **without leaving the connection**. Tools and resources are two views of one substrate, and that is the mechanism that makes "check the server rather than trust it" executable rather than aspirational.

`node:crypto` covers SHA-256, so this costs no dependency (ADR-0001).

### D3.3 — Advertise `lite|balanced|all-out`; accept `optimize|full`; canonicalize; never advertise

- Published `inputSchema` enum: **exactly the three**.
- The handler validates against **five** and canonicalizes via §M8's own `MODE_ALIAS`.
- Output carries the canonical value as `result.mode`. **The alias is never echoed as a value** — it appears only inside `deprecations[]`, with the `§M9.6` citation and `removedIn: "next major"`.
- A value outside the five is `unknown_mode`, and the message **names the three and does not guess** (§M2:59 — *"An unrecognized value is never guessed"*). `--mode fast` must not quietly become `balanced`.

The reason not to publish the aliases is generative, not cosmetic: a client that builds calls from the advertised schema would start *emitting* `optimize`, which is precisely how a shim acquires new callers and stops being removable in the major that was supposed to remove it.

### D3.4 — Four read-only, `run_gate` not

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
|---|---|---|---|---|
| `route_node`, `boundary_lookup`, `estimate_phase`, `standards_shelf` | **true** | false | true | false |
| `run_gate` | **false** | false | true | false |

`run_gate` is not read-only because it calls `child_process.spawn`; annotating a process-spawning tool as read-only is the lie that makes annotations worthless. It is **not destructive** because neither gate writes inside the repo — `validate.mjs`'s only write is a `mkdtemp` under `os.tmpdir()` that its own `finally` removes. It is **idempotent** and **closed-world**: neither gate touches the network.

That last property is why `scripts/render-diagrams.mjs` is **not** offered as a third gate. It fetches its renderer via `npx` (`render-diagrams.mjs:7-8`) and needs a Chromium binary — it would flip `openWorldHint` to true and put a network fetch behind an allow-listed tool.

### D3.5 — One error envelope, and the 422/400 seam drawn at the protocol boundary

`{ code, message, fix, details[]?, fallback? }`. House style is `api-design.md:99-113` (one shape everywhere, machine-readable `code`, human `message`, per-field `details`), with two deliberate deltas: `request_id` is dropped, because JSON-RPC already carries a correlating `id` and a second identifier that correlates with nothing is cargo; and `fix` is added to match the imperative-fix grammar ADR-0002 §D2.4 pinned for boot failures, so a user reads the same shape on stderr and in band.

The seam:

- **`-32602` JSON-RPC** for *shape* violations the schema rejects — unknown property under `additionalProperties:false`, wrong type, missing required. This is `api-design.md`'s 400.
- **`isError` envelope** for everything *semantic* — shape-valid input the server cannot answer. This is the 422.

Codes are a closed set: `invalid_argument`, `unknown_mode`, `not_found`, `source_missing`, `source_unparseable`, `gate_unavailable`, `internal`. `source_unparseable` reuses `canonicalBlock()`'s five exact failure strings (`validate.mjs:446-470`) so the gate and the server describe the same breakage in the same words.

And the one that matters most in practice, gate-asserted: **a failing gate is not a failing tool.** `run_gate` on a red tree returns `ok:true`, `isError:false`, `verdict:'FAIL'`. Conflating them makes a red gate indistinguishable from a broken server — and the smoke gate is red on `develop` today.

### D3.6 — Tool-specific rulings worth stating in prose

**`route_node` carries a constant `templateRule` and it is gate-asserted.** The hazard is concrete and specific: a caller receives `{"model":"claude-haiku-4-5","effort":null}` and writes it into the template, where check 5 fails any bare `model:`/`effort:` literal outside the ROUTES block (`CONTRIBUTING.md:77`). So every answer carries fixed text saying: do not transcribe these values, carry §M8 verbatim, let `optsFor()` compute them at run time, prove it with `node scripts/validate.mjs`. `includeCanonicalBlock` returns the block live-parsed by the same algorithm the gate uses, with its hash — but the verification of a paste remains `validate.mjs`, never the tool.

**`estimate_phase` cannot ask, and says so.** It returns `confirmationPrompt` (§M6's exact sentence, with the §M7 Fable substitution when `planner: 'fable'`, because the clause *"every node pinned to claude-opus-5"* is false on that run and it is the screen where consent is given) plus `requiresHumanConfirmation: true`. Elicitation is deferred by ADR-0001 and §M6 puts the question in the orchestrating session anyway. It also parses the BAND revision date live (`:219`, currently `Revision 2026-07-27`) rather than hardcoding it, so a stale calibration is visible in the answer, and carries a constant `calibrationWarning` that BAND and SIZE are calibration, not physics.

**`run_gate` has no command parameter.** `gate` is a closed enum of `validate|smoke|both`. Permissions are granted per tool name (`permissions.md:51` — `mcp__<server>__<tool>`, with wildcards reserved for deny/ask), so an allow-listed `run_gate` that accepted a caller-supplied command would be an allow-listed shell wearing a gate's name. It also carries a **required** `baseline` block read live from `mcp/runtime-pin.json`, because `smoke.mjs` is red on `develop` for a pre-existing reason and without this every caller rediscovers that failure and misattributes it to their own change.

**`standards_shelf` degrades to raw text and says which sections it could not parse.** Given §3's measurements: parse Markdown table rows where they exist; otherwise return the `##` section's raw text with `parsed: false`; never infer a row out of prose. `unparsedSections` is a **required** output field, because omitting it converts a parser limitation into an apparent absence of standards. And a constant `authorityNote` states the tool reports *what the shelf says and when the shelf last checked*, never what is true today.

### D3.7 — Resources are the verification channel, scoped to what the tools parse

`theloopskill://<repo-relative-posix-path>`, covering the 21 `SKILL.md`s, 105 references, 39 templates, 3 frameworks and 4 `docs/design/` files — **172 resources**. A `file://` URI would hardcode a machine-specific absolute path into every citation, making two checkouts disagree about the identity of the same file; `sourceRoot` on the envelope carries the absolute path once.

Excluded: `scripts/`, `.claude-plugin/`, `.claude/settings.json`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`, `docs/c4/`, `docs/plans/`. The rule is that the resource surface is exactly what the tools parse plus the tree they parse it from — anything wider is unaudited reach for no benefit, and a settings file is where a token eventually lands.

Read-only, no `subscribe`, no `listChanged`, capability declared as `resources: {}`. Path traversal refused after `realpath`; a URI outside the enumerated surface refused even when it resolves inside the root.

### D3.8 — Every call site has a fallback, and the fallback is the instruction that is there today

| Tool | Call site | Fallback | Real degradation |
|---|---|---|---|
| `route_node` | `loop-engine/SKILL.md` step 2 (:32-36); `loop-orchestrate/SKILL.md` (:43) | Read §M3 (:77), §M5 (:126); copy §M8 (:303) | None of substance |
| `estimate_phase` | `loop-engine/SKILL.md`:82-86; `loop-orchestrate/SKILL.md`:134-138 | Do §M6's arithmetic by hand from BAND (:209) and SIZE (:225) | Largest real benefit — hand arithmetic is the error-prone part — but still accuracy, never capability |
| `boundary_lookup` | `loop-skill/SKILL.md` step 3 (:40); `loop-v1/SKILL.md` step 3 (:20) | Read `docs/design/boundary-audit.json` | Real for `loop-v1`'s 21-entry roster sweep: correct but expensive in context |
| `run_gate` | `loop-skill/SKILL.md` step 6 (:70-78) | Run `node scripts/validate.mjs` | Essentially none |
| `standards_shelf` | `loop-skill/SKILL.md` step 4 (:54-60) | Read `references/standards.md` | None — and given §3, often *better* than the tool |

Four binding constraints on the router edits:

1. **Additive and conditional.** "If `theloopskill-mcp` is connected, X; otherwise Y" — where Y is today's instruction, unchanged.
2. **Never mandatory.** No step may be reachable only through a tool.
3. **Never phrased as authority.** Not *"ask `route_node` what the routing is"* but *"`route_node` answers this from §M3/§M8 and cites the lines; `execution-modes.md` remains the source of truth."* The server is a reader of the law, never a second copy of it — which is the same argument §M8:399 makes about why the block is duplicated by rule.
4. **The fallback text is duplicated into the error envelope's `fallback` field**, so a caller that reaches the server and fails is told the same thing as a caller that never reached it.

The four consumer routers are **`loop-engine`, `loop-orchestrate`, `loop-skill`, `loop-v1`** — derived, not previously ruled: they are the only four skills whose steps already read these five documents (§M2:63 makes engine and orchestrate the only flag parsers and pre-flight runners; `loop-skill` owns boundary registration, the shelf and the gate at its steps 3, 4 and 6; `loop-v1`:20 walks the boundary audit).

### D3.9 — What the golden-query gate must assert

On top of ADR-0001's requirement that the gate drive the server through the real SDK `Client` + `StdioClientTransport`: envelope conformance on **both** branches; `isError === !ok`; `authoringTimeOnly === true` everywhere; citation round-trip by hash; citation-over-the-wire via `resources/read`; the string `optimize` **absent** from the entire serialized `tools/list` payload; `mode:'optimize'` → `ok:true`, `result.mode === 'balanced'`, exactly one deprecation; `mode:'fast'` → `unknown_mode` naming three values; the annotation table byte-for-byte; a red gate returning `ok:true`; degrade-not-die with `execution-modes.md` removed from a scratch tree; `templateRule` present and exact; `estimate_phase` byte-identical across two identical calls; and traversal refusals on `theloopskill://../../etc/passwd` and `theloopskill://scripts/validate.mjs`. Full list in `mcp/tool-contracts.json` §D3.9.

## Consequences

**Positive**

- The citation requirement makes the §2 staleness class *survivable*: a tool answer that quotes retired prose carries the line number that exposes it, and the gate's round-trip assertion means a citation cannot drift from what the file says without turning red.
- Resources and tools verify each other over one connection. The caller never has to trust the server's summary of a file it can fetch and hash itself.
- One envelope means one client-side handler for five tools, and an `isError` result that still conforms to the advertised `outputSchema` — so schema-driven clients keep working in the failure path.
- The mode ruling lets §M9.6's removal actually happen: no published artifact will have taught a new caller to send `optimize`.
- Every router edit is a no-op when the server is absent, which is the common case. Nothing in the plugin becomes reachable only through MCP.
- Declaring `run_gate` honestly (`readOnlyHint:false`) keeps the other four credible. A client that auto-approves read-only tools gets exactly the four that read.

**Negative**

- **`standards_shelf` under-delivers and the contract admits it.** Two of 21 shelves yield no rows and six lack the grade vocabulary; the honest output is raw text plus `unparsedSections`. Mitigation: the tool reports what it could not parse rather than looking empty. The real fix is normalizing the shelves, which is a separate change to 21 law files and out of scope here.
- **Citations cost work per answer.** Every answer needs line tracking and a hash over the cited range — for `boundary_lookup` that means locating the smallest enclosing JSON object's line span in raw text alongside `JSON.parse`. That is the single largest piece of implementation work D3 creates, and it is deliberate: without it the tools are an unverifiable paraphrase of files the caller already has.
- **The envelope's `if/then` conditionals are draft 2020-12** and most clients will not enforce them. The server's own guarantee is what is normative; the schema is documentation with teeth only at the gate.
- **Next bottleneck: `execution-modes.md` is one file behind two tools.** `route_node` and `estimate_phase` both re-read all 439 lines on every call, with caching deferred by ADR-0001. Fine at this size; the first thing to revisit if a tool is called in a loop.
- **`run_gate` is the weakest of the five.** Its fallback is one Bash command. It earns its place on the parsed verdict and the baseline comparison only, and if a v1 tool has to be cut, this is it.

## Alternatives Considered

- **Advertise all five mode names** — rejected outright. It is the one thing §M9.6 says not to do, and a published enum is generative: schema-driven clients would begin emitting `optimize`, giving the shim new callers in the release that was meant to remove it.
- **A bare error object instead of a wrapped envelope** — simpler to read, but an `isError` result would then violate the tool's own `outputSchema` exactly when a client most needs the schema to hold. The wrapper costs one nesting level and buys total conformance.
- **Return everything as JSON-RPC errors for failures** — rejected: a model-driven caller can repair a semantic failure it can read, and JSON-RPC errors frequently surface as opaque transport faults. Keeping semantics in band is what makes `fix:` actionable, and it is what ADR-0001 already pinned.
- **`run_gate` with a free-form `command` parameter** — rejected on the permission model. Tools are allow-listed by name (`permissions.md:51`), so this is an allow-listed shell. The closed enum costs a small amount of generality and removes the entire class.
- **Expose the whole repo as resources** — rejected: a resource surface wider than the tool surface is unaudited reach for no benefit, and it would put `.claude/settings.json` behind a read tool.
- **`file://` resource URIs** — functionally fine, but they bake a machine-specific absolute path into every citation, so two checkouts disagree about the identity of the same file. `sourceRoot` carries the absolute path once instead.
- **Make `route_node` emit a paste-ready ROUTES block as its primary answer** — rejected as a category error. §M8 is the single source of truth and `validate.mjs` check 5 is what proves a paste; a tool that positioned itself as the block's supplier would become a second copy of the law, which is the exact failure the duplication rule exists to prevent (`execution-modes.md:399`).
- **Skip citations, return plain answers** — rejected by §2. The prose these tools read is already wrong in at least one place no gate catches. Without a citation the caller has no way to tell a correct answer from a confidently stale one, and the whole server becomes a thing you have to trust.
- **Do nothing / defer the contract to implementation time** — rejected: four routers and a gate all depend on these shapes, and ADR-0001 already observed it is far cheaper to fix the interface before four call sites point at it.
