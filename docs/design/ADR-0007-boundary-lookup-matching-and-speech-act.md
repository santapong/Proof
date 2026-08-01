# ADR-0007: `boundary_lookup` ranks candidates and hands back the stored question — it never names an owner

## Status

**Accepted**

Date: 2026-07-27 · Deciders: D7 (loop-skill), Phase 1 DECIDE, theloopskill-mcp conduct

Sits with [ADR-0002](ADR-0002-dependency-seam-and-boot-contract.md), [ADR-0003](ADR-0003-tool-contracts-and-call-sites.md), [ADR-0004](ADR-0004-extraction-strategy-and-failure-semantics.md), [ADR-0005](ADR-0005-correctness-invariant-no-silent-default.md) and [ADR-0006](ADR-0006-width-shape-band-coverage-and-flag-selected-rows.md); the machine-readable half is [`mcp/boundary-match-contract.json`](../../mcp/boundary-match-contract.json). It refines ADR-0003 §D3.6's `boundary_lookup` entry, which declared a `query` input "matched case-insensitively" and stopped there.

---

## Context

### 1 · A tool that names an owner is a second selector, and the repo already has one

`docs/c4/README.md:33` is unambiguous about where skill selection happens:

> Claude Code matches the request against nineteen `description` fields. Nothing else is loaded and nothing else influences the choice — the descriptions *are* the routing table.

That selector runs **before any skill body is read**, and by ADR-0003 §D3.0 every MCP tool here is `authoringTimeOnly:true` — it is reachable only from a session that has already selected a skill, and never from a workflow script under H10. So `boundary_lookup` cannot be the selector. It can only be a second, later, *advisory* reading of the same evidence.

That would be harmless if the answer were cheap talk. It is not. `docs/design/README.md:7` gives `boundary-audit.json` this authority:

> **Outranks the build manifest.** Where a plan and this file disagree, this file wins.

and `:20` repeats it: "the audit wins over any plan or manifest." A tool that reads the outranking file and emits one line — `owner: loop-design` — is not reporting the file. It is **performing a ruling in the file's voice**, from a ranking the file never authorised. Searle's term for an utterance that brings about the state it describes is a *declaration*; that is the illocutionary class this tool must not be in.

The consumer that makes this concrete is `loop-v1`. `SKILL.md:31` (step 4):

> The boundary matrix decides ownership; a task with no owning skill is a decomposition smell.

and `:27` (step 3) runs the roster sweep over all 21 entries. So loop-v1 asks this question per task, at scale, and acts on the answer — including acting on **absence**. "No owning skill" is not an error path there; it is a diagnostic the planner is *listening for*.

### 2 · The substrate, measured on disk at head `4dd461a`

`docs/design/boundary-audit.json` — 744 lines, 70,859 bytes, LF-only, four top-level keys:

| Key | Shape | Measured |
|---|---|---|
| `matrix` | array | **21** rows, each `{skill, scope, useInsteadWhen[]}` — exactly three keys, no more |
| `overlaps` | array | **28** rows `{skillA, skillB, risk, severity, resolution}`; severity 8 high / 16 medium / 4 low |
| `descriptionRewrites` | array | **18** rows `{skill, currentDescription, newDescription, why}` |
| `verdict` | **string** | **4,394 characters on one physical line** (file line 742). Not an object. No fields. |

Derived facts, all measured:

- **76** `useInsteadWhen` edges across the 21 rows. Every target resolves to a matrix row (0 dangling).
- **54** edges have a reverse edge; **22** do not.
- **loop-skill** and **loop-frontend** have **in-degree 0** — no row in the file ever says "use loop-skill instead."
- Of `C(21,2) = 210` unordered pairs, **49** have at least one edge. **161 pairs have no stored discriminator at all.**
- All 28 rated overlaps have at least one edge, but only **19** have both; **9 are one-way**, including one `high` (index 25, `loop-frontend|loop-design`).
- **loop-v1 appears in zero overlap rows** while carrying 4 out-edges and 4 in-edges.
- `descriptionRewrites` covers 18 of 21. **loop-skill, loop-frontend and loop-v1 have no approved description text.** Of the 18 that do, **16 match the live `SKILL.md` frontmatter byte-for-byte** and **2 have drifted** — `loop-algo` (live 845 chars vs approved 753) and `loop-operate` (839 vs 699), both because a sentence was added to the live file and not back-ported.
- Line spans are mechanically recoverable by brace-depth scan: the `loop-design` matrix row is lines **111–132**. The excerpt is a *fragment* — it ends in `},` and does not `JSON.parse` standalone.

### 3 · What ADR-0003 left open

§D3.6 gave `boundary_lookup` a `query` string described as "matched case-insensitively against scope, useInsteadWhen conditions, overlap risk and resolution," a `limit` defaulting to 5, and a `matches[]` result with no order semantics, no evidence, no reverse edges and no way to say *nothing owns this*. D3's own §D3.10 left the algorithm unruled. That is the gap: **the repo has no written matching algorithm anywhere**, and an unwritten ranking published under an outranking file's authority is the failure mode this ADR exists to prevent.

### 4 · MEASURED — the naive field bag inverts the answer

`useInsteadWhen[i].condition` is prose describing **when NOT to use the row it is stored on**. Folding it into that row's own bag — which is what §D3.6's wording literally says — makes a row score highest on text that disclaims it.

Query: *"plan a whole project into phases with a task DAG and per-node model routing."* Correct answer `loop-orchestrate`. IDF-weighted coverage over all fields:

| Scorer | Top 5 |
|---|---|
| all fields (scope + description + useInsteadWhen) | **loop-engine 24.66** · loop-v1 17.65 · *loop-orchestrate 15.36* · loop-docs 4.83 · loop-ship 3.44 |
| own fields only (scope + description) | **loop-orchestrate 15.36** · loop-engine 14.92 · loop-docs 4.83 · loop-design 3.27 · loop-v1 2.48 |

`loop-engine` wins the naive scorer on this row, verbatim (`/matrix/0/useInsteadWhen/0`):

> "The unit of work is a whole project needing phase decomposition, a task DAG, and per-node model/effort routing before any script is written." → **use loop-orchestrate**

The highest-scoring evidence for `loop-engine` is a sentence that says *use loop-orchestrate*. Across a 20-query on-fleet set: all-fields top-1 **7/10** on the first cut, own-fields-only **9/10**. The signal is real and it points the wrong way.

### 5 · MEASURED — no score threshold separates "owned" from "unowned"

Twenty on-fleet queries (one per skill, `loop-ship` twice) against twelve deliberately off-fleet queries ("book me a flight to Berlin", "what is the capital of Peru", "plan my wedding seating chart"). Candidate floors, top candidate only:

| Statistic | min over on-fleet | max over off-fleet | separates? |
|---|---|---|---|
| normalised coverage `cov` | 0.183 | **1.571** | **NO** — off-fleet is 8.6× higher |
| absolute matched IDF mass | 4.059 | 2.914 | yes, but scale-varies with query length |
| distinct matched terms | 2 | 3 | **NO** |
| distinct matched terms with `df ≤ 5` | **2** | **1** | **YES** |

The normalised floor fails hardest exactly where it looks safest: *"reconcile the Q3 payroll spreadsheet"* scores **1.571** — the highest coverage in the whole experiment — because almost every query term is out of vocabulary, the denominator collapses, and one match on `the` fills it. Any rule of the form "score below X ⇒ unowned" is refuted by measurement.

### 6 · MEASURED — a discriminating-term count separates perfectly

Define a query term as **discriminating** when its document frequency over the 21 own-field bags satisfies `1 ≤ df ≤ ⌊N/4⌋` (= 5 at N=21). Require the top candidate to match at least **2** distinct discriminating terms.

| `dfMax` | off-fleet wrongly owned | on-fleet wrongly unowned |
|---|---|---|
| 4 | 0 / 12 | 0 / 20 |
| **5 = ⌊21/4⌋** | **0 / 12** | **0 / 20** |
| 6 | 0 / 12 | 0 / 20 |
| 7 | 2 / 12 | 0 / 20 |
| 10 | 2 / 12 | 0 / 20 |

`dfMax = 7` admits `this` (df 7), and the two failures are *"translate this paragraph into French"* → loop-design on `{this, into}` and *"summarise this legal contract"* → loop-integrate on `{this, contract}`. Requiring **3** discriminating terms instead of 2 costs 5/20 false "unowned". The predicate reads **document frequency only — never a score** — which is why it survives where the floor does not.

Note what this encodes: the audit's own premise is that the 21 scope lines are "mutually exclusive by construction" (`docs/design/README.md:12`). A term that appears in a quarter of the rows is, by that construction, not a boundary term. The threshold is a restatement of the file's own claim about itself, not a tuned constant, and it is expressed as `⌊N/4⌋` over the live matrix size so a 22nd skill moves it.

### 7 · MEASURED — the margin between #1 and #2 is not a correctness signal

| contested band | queries flagged | wrong-#1 cases caught |
|---|---|---|
| 10 % | 1 / 20 | 0 of 2 |
| 15 % | 1 / 20 | 0 of 2 |
| 25 % | 3 / 20 | 0 of 2 |
| 40 % | 8 / 20 | 2 of 2 |

A band tight enough to be meaningful catches none of the errors; a band wide enough to catch them flags 40 % of all queries. So the margin must be **reported as data and never used as a gate on whether evidence is returned**.

And the reason that is survivable is the single most important measurement in this ADR. On *"what is in this release and how risky is it"* the ranking is **wrong** — `loop-ship` 0.534, `loop-audit` 0.343. But the pair carries a reciprocal stored discriminator, and the proposition on `loop-ship`'s row (`/matrix/15/useInsteadWhen`) is:

> "The ask is what is in the release and how risky it is, not how it reaches production." → **use loop-audit**

The stored question is a near-verbatim restatement of the query. A caller who reads the returned question gets the right answer *from a wrong ranking*. That is the whole design in one observation: **the ranking is a retrieval device for the question; the question is the answer.**

### 8 · MEASURED — the arithmetic must be exact, and can be

ECMAScript does not require `Math.log` to be correctly rounded (it is implementation-approximated), so a float score is not portable across engines — and ADR-0005 §D5.4 already ruled that a determinism promise implemented in floats is a promise held by accident. But `df` ranges over `0…N`, so IDF is a **22-entry table**, not a function of the query. Computing `round(1000 · ln((2N+2)/(2df+1)))` once:

```
3784 2686 2175 1838 1587 1386 1219 1076 951 840 740 649 565 488 417 350 288 229 173 121 71 23
```

The closest any entry comes to a `.5` rounding boundary is **7.735 × 10⁻²**; a float ulp at these magnitudes is **6.66 × 10⁻¹³**. Eleven orders of magnitude of margin, so the table is bit-identical on any conformant engine. With TF saturation as the exact rational `11f/(5f+6)` and field weights as `3/5` and `2/5`, the whole comparison runs in `BigInt` rationals — largest value seen was an 8-digit numerator over a 4-digit denominator.

Result: the exact-integer ranking reproduces the float-log ranking **identically on all 21 rows for all 20 queries**, at 1.453 ms/call versus 1.458 ms/call. Determinism is free here.

Quality of the ruled scorer, measured: **top-1 18/20, top-3 19/20, recall@5 20/20, MRR 0.935**, with **0/12** off-fleet falsely owned and **0/20** on-fleet falsely unowned. Cost: 1.453 ms ranking + 1.478 ms to re-read and parse the 71 KB source per call, consistent with ADR-0005 §D5.3.7's no-caching ruling.

---

## Decision

We will make `boundary_lookup` a **ranked shortlist with its evidence and the stored question**, computed by a fully specified, exact-integer, source-derived score. It never emits an owner.

### D7.1 · The speech act

Every `boundary_lookup` answer is an **assertive** (a report of what `boundary-audit.json` says, at cited coordinates) plus a **directive** (a question the caller must answer). It is **never a declaration**. Three binding rules:

1. **No result field is named `owner`, `owningSkill`, `verdict`, `decision` or `answer`.** The ranked array is `candidates[]`. `verdict` is additionally reserved: it is the name of the 4,394-character prose string at `/verdict`, and reusing it for a computed field would let a caller believe the file ruled.
2. **`limit ≥ 2` whenever the outcome is `candidates`.** A one-element shortlist is a verdict wearing a list's clothes. If a caller passes `limit: 1` the server returns the top **2** and records a `notes[]` entry saying so.
3. Every answer carries the constant `authority` string stating that the ranking is the server's and the authority is the file's, and that a rank is not a ruling.

### D7.2 · The corpus is own-fields-only; `useInsteadWhen` is diverting evidence

Scored text per row is **`scope` + the approved `newDescription`** — nothing else. `useInsteadWhen` conditions, `overlaps.risk` and `overlaps.resolution` are **never** added to the row's own bag (§4). A query hit inside `matrix[i].useInsteadWhen[j].condition` is reported as `divertedBy[]` on row *i*, naming `otherSkill`, and is **not** added to `otherSkill`'s score either — an additive transfer would systematically reward high in-degree, and the two rows with in-degree 0 are `loop-skill` and `loop-frontend`.

### D7.3 · The score

For query `q` and row `r`, over the token set `T = distinct(tokenize(q))`:

- **Tokenisation** — `toLowerCase()`, `normalize('NFKD')`, replace `[^a-z0-9]+` with a space, split on whitespace, drop empties. Total, no locale, no clock, no stopword list.
- **IDF** — the 22-entry integer table `IDF[d] = round(1000 · ln((2N+2)/(2d+1)))`, `N` = live `matrix.length`, `d` = document frequency over the 21 own-field bags. `d = 0` (out of vocabulary) takes the **maximum** entry, not zero: an unknown term is evidence against every row, and scoring it zero is the silent default that produced §5's 1.571.
- **No stopword list exists**, by construction. A term in every row has `IDF[21] = 23` milli-nats against `IDF[1] = 2686` — a 117× ratio. Discriminating power is *measured from the corpus*, never declared.
- **TF saturation** — exact rational `11f/(5f+6)` (Robertson's `k₁ = 6/5`). Repeating a word does not buy proportional score.
- **Fields and renormalisation** — `scope` weight `3/5`, `description` weight `2/5`, **renormalised over the fields actually present**. For the 3 rows with no approved description, `scope` carries weight `1` and `fieldsScored` records `["scope"]`. There is **no length normalisation** (`b = 0`): measured, `b = 0.75` lifts the three description-less rows from mean rank 15.67 to 12.00 on a query none of them own — it pays a row for missing data.
- **Arithmetic** — `BigInt` rationals throughout the comparison path. No float, no `Math.log` at compare time. The per-query `1/qmass` normaliser is a positive constant across rows and is applied only to the *displayed* `score`, never to the ordering.
- **Order** — a total ordering by (score desc, `nDiscriminating` desc, **`matrix` index asc**). All three keys are total; the last is the source's own byte order, so ties are broken by the file and never by object-key or filesystem order.

### D7.4 · `unowned` is a discriminating-term predicate, not a floor

`outcome = "unowned"` **iff** the top-ranked row matches fewer than `2` distinct discriminating terms, where a term is discriminating iff `1 ≤ df ≤ ⌊N/4⌋`. Both parameters are functions of the live matrix size. **No score threshold appears anywhere in this predicate** — §5 measured that no such threshold exists.

An `unowned` answer is `ok:true`, not an error. It carries: the top 3 rows anyway (with their scores and zero-or-one discriminating terms, so the caller can see *how* nothing matched), the query's discriminating terms and the fact that fewer than 2 landed, and the constant `decompositionSmell` text pointing at `loop-v1/SKILL.md:31`. It is the answer loop-v1 step 4 is listening for, so it must be **expressible, cheap and unambiguous** — never `not_found`, never `isError:true`, never an empty array. An empty `candidates[]` is indistinguishable from a broken parse.

### D7.5 · Both directions of every edge, always

For each candidate the server returns:

- `useInsteadWhen[]` — the row's own outbound edges, **verbatim**, as stored, with pointer `/matrix/{i}/useInsteadWhen/{j}`.
- `pointedAtBy[]` — **synthesised by scanning all 21 rows** for edges targeting this skill, each carrying the pointer to *where it is actually stored* (`/matrix/{k}/useInsteadWhen/{m}`) so the citation is real and not invented.
- `reciprocity` — `{outDegree, inDegree, oneWayOut[], oneWayIn[]}`.

Rationale is the repo's own law, not a preference. `loop-skill/SKILL.md:47`: *"for every rated overlap, on **both** sides. A one-way pointer leaves the boundary decidable from one direction only."* `loop-skill/references/authoring.md:69` requires checking "every neighbour's **reciprocal** pointer." The file stores one-way rows; the tool must not inherit the asymmetry, because a caller who lands on `loop-design` and is never told `loop-frontend` diverts to it has been handed a boundary that is only half decidable — and that is 22 of 76 edges today.

### D7.6 · The separating question, or an honest null

For **every adjacent pair** in the returned shortlist — not only #1/#2, and never gated on a margin band (§7) — the server returns:

```
{ pair:[a,b], margin, propositions:[
    { storedOn:a, proposition:<verbatim condition>, ifTrue:b, ifFalse:a, pointer, citation },
    { storedOn:b, proposition:<verbatim condition>, ifTrue:a, ifFalse:b, pointer, citation } ],
  reciprocal, oneWay, ratedOverlap:{severity,pointer}|null, storedDiscriminator }
```

The question is the **stored condition verbatim**, presented as a decidable proposition with its consequence attached. The server **paraphrases nothing and invents nothing** — no model call, no rewriting a declarative into an interrogative beyond the fixed frame. Where both directions exist, both propositions are returned and the pair is `reciprocal:true`.

Where **no** edge exists in either direction, `storedDiscriminator:false` and `propositions:[]`, with a `notes[]` entry naming this as an audit gap against `loop-skill/SKILL.md:47`. This is not rare: **161 of 210 pairs** have no stored discriminator, and on the 20-query set the #1/#2 pair had **both directions on 9, one direction on 4, and none on 7**. Fabricating a question for those 7 would be the tool's only genuinely dishonest act available to it.

### D7.7 · One authority in the ranking; staleness is reported, never scored

The score reads `descriptionRewrites[].newDescription` — the **approved** text — and **never** the live `SKILL.md` frontmatter. Mixing the ruled text and the shipped text in one number would make the score a blend of two authorities with no way to see which moved.

The live frontmatter is still read, for exactly one purpose: ADR-0003's `descriptionIsStale`. That field is currently typed `boolean`, which cannot honestly describe the 3 rows with no approved text — `false` there would assert "the live text matches what was approved" when nothing was approved. **D7 requires it become `"current" | "drifted" | "unrecorded"`.** Measured today: 16 current, 2 drifted (`loop-algo`, `loop-operate`), 3 unrecorded (`loop-skill`, `loop-frontend`, `loop-v1`).

### D7.8 · Every answer carries the audit's own gaps

A required `auditIntegrity` block, computed live, never hardcoded: `matrixSize`, `edgeCount`, `reciprocalEdges`, `oneWayEdges`, `zeroInDegreeSkills[]`, `overlapCount`, `ratedOverlapsOneWayInMatrix[]`, `skillsWithNoApprovedDescription[]`, `skillsWithNoRatedOverlap[]`, `pairsWithNoStoredDiscriminator`. The file that outranks the build manifest is currently carrying 22 one-way edges, 9 one-way rated overlaps (one `high`), 2 skills nothing points at, 3 skills with no approved description and 1 skill (`loop-v1`) with no rated overlap at all — while `docs/design/README.md:19` says adding a skill means re-checking every overlap it touches. A tool that reads this file and reports none of that is laundering the debt into a confident-looking ranking.

### D7.9 · Exact-lookup mode is unchanged and separate

`skill:` alone is an exact key lookup — `not_found` (ADR-0003 §D3.5) when absent from the 21-row matrix, and `outcome:"exact"`. It never runs the scorer and never returns `unowned`; the absence of a *key* is a different fact from the absence of an *owner*, and collapsing them would make loop-v1's roster sweep unable to tell a typo from a decomposition smell.

---

## Consequences

**Positive**

- The tool cannot silently become the second selector, because it has no field in which to name a winner. The strongest thing it can say is "these five, in this order, and here is the question that separates the top two."
- The measured failure mode is *recoverable by the caller*: on the one wrong-#1 case with a stored discriminator, the returned proposition is a near-verbatim restatement of the query and points at the right skill (§7). Recall@5 is 20/20, and the default `limit` of 5 was already ADR-0003's.
- `unowned` is decided by a predicate with 0 errors in 32 measured queries, and it is a first-class `ok:true` answer, so loop-v1 step 4's decomposition smell becomes something a planner can branch on rather than infer from a low number.
- Zero hand-chosen vocabulary. No stopword list, no synonym table, no per-skill keyword field. Every weight is derived from document frequency over the file itself, and the two thresholds are `⌊N/4⌋` and `2` over the live matrix size.
- Bit-identical across engines and platforms (§8), at no measured cost, inheriting ADR-0005 §D5.4's integer discipline.
- The audit's own debt becomes visible on every call instead of on nobody's desk.

**Negative**

- **It is a lexical matcher and it will miss paraphrase.** Measured: *"why does this throw a null pointer on the second call"* ranks `loop-debug` **5th** — the query shares no discriminating term with an approved description written around "a bug, a failing test, an exception or stack trace, a crash." It is inside `limit: 5`, and `outcome` is still `candidates`, so the tool will confidently present a shortlist whose top entry is wrong. Mitigation is honesty, not machinery: the speech act never claims the top entry is the owner, and the fallback (read the file) stays in every answer. This is the ceiling of a no-model, no-embedding design and it is the price of determinism.
- The three description-less rows are scored on `scope` alone — 19, 24 and 43 tokens against a 124-token corpus average. Renormalisation prevents a *penalty*, but a 19-token corpus simply carries less surface to match. The real fix is three `descriptionRewrites` entries, which D7 does not rule on.
- `pointedAtBy` requires a full 21-row scan per candidate. At 21 rows this is 441 edge comparisons and disappears into the 1.45 ms; at 100 skills it is the first thing to index.
- `auditIntegrity` will report non-zero debt on every call until someone repairs the file, and there is a real risk it becomes wallpaper. It is deliberately a required field so that a repair commit visibly zeroes it.
- Callers now receive roughly 19 KB of structured answer for a five-candidate query, against a 71 KB file. The saving is real but not dramatic; the tool earns its place on the reverse edges, the separating questions and the integrity block — none of which exist in the file as stored — rather than on context saved.

## Alternatives Considered

- **Return one owning skill (the bare verdict).** Rejected as the central error: under `docs/design/README.md:7` it converts a ranking guess into a ruling in the outranking file's voice, and §7 measured the ranking wrong on 2 of 20 queries with no signal available to flag either.
- **Score all fields including `useInsteadWhen`, as ADR-0003 §D3.6's wording implies.** Rejected on measurement (§4): it ranks `loop-engine` first at 24.66 on a query whose best-matching evidence is `loop-engine`'s own "use loop-orchestrate instead" condition.
- **Add the diverted mass to `otherSkill`'s score.** Tempting and measurably worse: it widened the §4 margin from 2.9 % to 28 % but demoted `loop-skill` from rank 1 to 5 on its own query, because the bonus is an in-degree popularity term and `loop-skill` has in-degree 0.
- **A score floor for `unowned`.** Refuted outright (§5): off-fleet coverage tops out at 1.571 against an on-fleet floor of 0.183. No threshold exists.
- **Absolute matched IDF mass as the floor.** It does separate on this set (4.059 vs 2.914) but scales with query length, so a long off-fleet query accumulates mass and crosses it. The `df`-based predicate reads no score at all and is invariant to query length.
- **A contested/margin band gating whether evidence is returned.** Rejected (§7): a 15 % band catches 0 of 2 errors, a 40 % band flags 8 of 20 queries. The margin is reported; it gates nothing.
- **BM25 with standard `b = 0.75` length normalisation.** Rejected on a measured perverse incentive (§D7.3): it lifts the three rows whose approved description is *missing* from mean rank 15.67 to 12.00. A scorer that pays a row for absent data is a silent default in ADR-0005's sense.
- **Float `Math.log` scoring with a tie epsilon.** Workable — the smallest observed positive adjacent gap was 1.86 × 10⁻⁶, eleven orders above float noise — but the 22-entry integer table costs nothing (1.453 vs 1.458 ms), reproduces the float ordering on 20/20 queries across all 21 rows, and removes the argument entirely.
- **A pure rational IDF surrogate `(2N+2)/(2df+1)` with no log at all.** Portable but measurably worse: far more peaked, top-1 dropped 18/20 → 17/20 and the tail reordered on 18 of 20 queries.
- **Embeddings, or an LLM judging ownership.** Excluded by the task and correctly: both are non-deterministic across model versions, neither can cite a byte range, and ADR-0003 §D3.2 requires every field to carry a verifiable citation.
- **A hand-maintained keyword field per skill.** Rejected: it is a 22nd column nothing validates, it would drift exactly as the 2 descriptions and 9 overlaps already have, and it replaces a measurement with an opinion.
- **Do nothing — leave the algorithm unwritten and let the implementer choose.** Rejected: an unwritten ranking published under the authority of the file that outranks the build manifest is precisely the "verified by nobody" failure `docs/design/README.md:14` records as the reason the audit was committed in the first place.
