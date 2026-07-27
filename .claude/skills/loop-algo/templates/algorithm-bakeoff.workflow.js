// Template: ALGORITHM BAKEOFF — candidate fan-out → earned barrier → adversarial stress-test → synthesis.
// A specialization of the workflow skill's parallel fan-out pattern with loop-algo's references
// pre-wired: references/complexity-and-structures.md (derive the bound),
// references/correctness.md (state the invariant), references/concurrency.md (memory ordering
// and the scalability ceiling), references/randomized-structures.md (exact error bounds),
// references/benchmarking.md (the benchmark that would validate the cost claim).
//
// The two rules this script exists to enforce (SKILL §2), and the reason every schema below has
// a boolean in it:
//   1. every cost claim is labeled MEASURED or DERIVED-ONLY, and a claim with no runner behind it
//      says so instead of carrying a fabricated number;
//   2. "no counterexample in N cases" is EVIDENCE, never a proof — invariantStatus is a
//      three-valued enum for exactly that reason, not a boolean.
//
// Invoke with: Workflow({ script, args: { mechanism: "...", constraints: "...", runner: "...", mode: "optimize" } })
// input.mechanism   — what is being chosen (e.g. "the eviction policy for the session cache").
// input.constraints — the budget and workload: n, read:write ratio, latency/memory ceiling, concurrency.
// input.runner      — the benchmark runner ACTUALLY available (e.g. "JMH 1.37" / "pytest-benchmark 5.2.3"),
//                     or "none" / omitted. When absent, agents must return measured=false everywhere.
// input.mode        — 'optimize' (default) or 'full'; parsed by loop-engine, passed through as a real JSON value.

export const meta = {
  name: 'algorithm-bakeoff', // EDIT ME
  description: 'Generate competing mechanisms in parallel, merge them at an earned barrier, stress-test each invariant and benchmark claim adversarially, then pick a winner with every cost claim labeled measured or derived-only', // EDIT ME
  phases: [
    { title: 'Generate', detail: 'one agent per candidate mechanism: bound, invariant, and the benchmark that would validate it' },
    { title: 'Stress', detail: 'skeptics hunt a counterexample to the invariant and attack the benchmark methodology' },
    { title: 'Decide', detail: 'rank the survivors and label every cost claim measured vs derived-only' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = {
  optimize: {
    scout:      { model: 'claude-haiku-4-5', effort: null },   // Haiku has no effort dial — omit, never 'low'
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: 'high' },
    analyze:    { model: null,               effort: 'high' }, // null model = omit, inherit session (H8)
    synthesize: { model: null,               effort: 'high' },
    verify:     { model: null,               effort: 'high' },
    judge:      { model: null,               effort: 'high' },
    critic:     { model: null,               effort: 'high' },
    gating:     { model: 'claude-opus-5',    effort: 'max' },  // pinned even in optimize
    planner:    { model: 'claude-opus-5',    effort: 'xhigh' },// pinned even in optimize
  },
  full: {
    scout:      { model: 'claude-opus-5', effort: 'high' },
    doc:        { model: 'claude-opus-5', effort: 'high' },
    implement:  { model: 'claude-opus-5', effort: 'high' },
    analyze:    { model: 'claude-opus-5', effort: 'xhigh' },
    synthesize: { model: 'claude-opus-5', effort: 'xhigh' },
    verify:     { model: 'claude-opus-5', effort: 'xhigh' },
    judge:      { model: 'claude-opus-5', effort: 'xhigh' },
    critic:     { model: 'claude-opus-5', effort: 'xhigh' },
    gating:     { model: 'claude-opus-5', effort: 'max' },
    planner:    { model: 'claude-opus-5', effort: 'max' },
  },
}
const routeFor = (kind) => (ROUTES[MODE] && ROUTES[MODE][kind]) || ROUTES[MODE].analyze
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : (kind === 'gating' ? 3 : 1))
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}

// The block above is byte-identical to §M8 except for the one line §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage. `WIDTH` is kept — the stress
// stage resolves its skeptic count from it. Every line that IS here is verbatim; drift on any of
// them is a defect (see scripts/validate.mjs), and §M8 is the single source of truth.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// Whether a benchmark runner actually exists for this run. This single flag is what stops the
// script producing benchmark theater: with no runner, every agent is told to return
// measured=false and to describe the experiment instead of inventing its result (SKILL §2 rule 1).
const RUNNER = (input && input.runner) || 'none'
const HAS_RUNNER = RUNNER !== 'none' && RUNNER !== ''

// EDIT ME: one row per genuinely competing mechanism. Diversity beats redundancy (harness policy
// H4): each row must be a DIFFERENT mechanism, not the same structure described twice. Two rows
// is the minimum for a bake-off; below that, do the analysis inline (SKILL §9 size gate).
const CANDIDATES = [
  { key: 'hash-index', angle: 'A hash-based structure. Cover open addressing vs chaining and the load-factor trade-off (references/complexity-and-structures.md §4), and state the worst case under adversarial or degenerate keys, not just the expected case.' },
  { key: 'ordered-tree', angle: 'A balanced ordered structure (red-black/AVL or a B-tree). Justify the fanout against cache-line or page size, and state the cost in NODE VISITS, not only in Θ(log n) — the constant is the whole comparison here.' },
  { key: 'lsm-write-optimized', angle: 'A write-optimized structure (LSM-tree or append-only log with an index). State the compaction strategy assumed, and quantify read and write amplification — an LSM claim without them is incomplete.' },
  { key: 'approximate', angle: 'An approximate structure (Bloom / cuckoo filter, HyperLogLog, Count-Min) per references/randomized-structures.md. Carry the EXACT error formula and state the error bound and its confidence level in the same sentence as the space saving.' },
  // EDIT ME: for a concurrency bake-off, swap these for rungs of the references/concurrency.md §1
  // ladder — coarse lock / fine-grained lock / lock-free CAS-retry / wait-free — and require each
  // row to name its linearization point and the exact memory ordering it depends on.
]

// Candidates return raw analysis — their final text is a return value, not prose (H3).
// `measured` is a REQUIRED per-claim boolean: it is the schema-level enforcement of SKILL §2 rule 1.
const CANDIDATE_SCHEMA = {
  type: 'object',
  properties: {
    approach: { type: 'string' }, // the concrete mechanism, named specifically
    viable: { type: 'boolean' }, // false ⇒ this candidate cannot meet the stated constraints at all
    costClaims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operation: { type: 'string' }, // e.g. "point lookup", "insert", "range scan"
          bound: { type: 'string' }, // e.g. "Theta(log n)", "O(1)"
          boundCase: { type: 'string', enum: ['worst', 'average', 'amortized'] }, // never left implicit
          measured: { type: 'boolean' }, // true ONLY if a runner actually executed
          evidence: { type: 'string' }, // the derivation, or the runner + sample count if measured
        },
        required: ['operation', 'bound', 'boundCase', 'measured', 'evidence'],
      },
    },
    invariant: { type: 'string' }, // the predicate that must hold, stated as a checkable sentence
    invariantStatus: { type: 'string', enum: ['proved', 'evidence', 'not-proven'] }, // SKILL §2 rule 2
    correctnessArgument: { type: 'string' }, // initialization / maintenance / termination, or why not
    orderingDependency: { type: 'string' }, // exact memory ordering or lock discipline relied on; "n/a" if single-threaded
    proposedBenchmark: { type: 'string' }, // runner, warmup, forks, iterations, dataset, what it would settle
    spaceProfile: { type: 'string' }, // bytes/element or total, with the assumption behind it
  },
  required: ['approach', 'viable', 'costClaims', 'invariant', 'invariantStatus', 'correctnessArgument', 'orderingDependency', 'proposedBenchmark', 'spaceProfile'],
}

// Adversarial verdict: re-derive independently and default to NOT proven (H4).
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    invariantHolds: { type: 'boolean' }, // false when a counterexample exists OR could not be re-derived
    counterexample: { type: 'string' }, // a CONCRETE input/interleaving, or "none constructed"
    costReDerived: { type: 'boolean' }, // did the skeptic independently reach the same bound and case?
    costObjection: { type: 'string' }, // where the derivation breaks, or "none"
    benchmarkSound: { type: 'boolean' }, // is the PROPOSED methodology capable of settling the claim?
    methodologyObjection: { type: 'string' }, // warmup, sample size, dead-code elimination, wrong scope
    confidence: { type: 'number' }, // 0..1 in the above
  },
  required: ['invariantHolds', 'counterexample', 'costReDerived', 'costObjection', 'benchmarkSound', 'methodologyObjection', 'confidence'],
}

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    winner: { type: 'string' },
    costProfile: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          label: { type: 'string', enum: ['MEASURED', 'DERIVED-ONLY'] }, // SKILL §2 rule 1, enforced by schema
        },
        required: ['claim', 'label'],
      },
    },
    runnerUp: { type: 'string' },
    whyItLost: { type: 'string' }, // a comparison across the set, which is why the barrier is earned
    unprovenClaims: { type: 'array', items: { type: 'string' } }, // survived nothing: name them (H12)
    nextMeasurement: { type: 'string' }, // the experiment that would settle what is still derived-only
  },
  required: ['winner', 'costProfile', 'runnerUp', 'whyItLost', 'unprovenClaims', 'nextMeasurement'],
}

// The measurement-honesty clause, pasted into every prompt that could otherwise invent a number.
const HONESTY = HAS_RUNNER
  ? `A benchmark runner IS available: ${RUNNER}. Set measured=true ONLY for claims you actually executed and can report a sample count and spread for. Everything else stays measured=false.`
  : `NO benchmark runner is available in this environment. Set measured=false on EVERY cost claim. ` +
    `Do NOT invent a wall-clock figure, an ops/sec number, or an "Nx faster" ratio — describe the experiment ` +
    `that would settle it instead. A fabricated measurement is worse than no measurement ` +
    `(references/benchmarking.md §5).`

// ─── Stage 1 (Generate) ─────────────────────────────────────────────────────────────────────
// No barrier WITHIN this stage: each agent analyzes its own candidate and depends on no other
// agent's output (H1/H2 — a per-item stage stays a pipeline stage).
log(`generate: ${CANDIDATES.length} candidate mechanisms for "${input.mechanism}" [mode=${MODE}, runner=${RUNNER}]`)
const proposals = await parallel(
  CANDIDATES.map((c) => () =>
    agent(
      `Mechanism under design: ${input.mechanism}\n` +
        `Constraints (workload, size, budget, concurrency): ${input.constraints || 'as stated by the caller'}\n\n` +
        `Your candidate: ${c.angle}\n\n` +
        `Produce, as structured data:\n` +
        `1. COST. Derive the bound for each operation that matters under the stated workload. State the ` +
        `CASE explicitly on every one — worst / average / amortized — and never conflate them ` +
        `(references/complexity-and-structures.md §1). An average-case bound without its input ` +
        `distribution is not a bound. Include space.\n` +
        `2. INVARIANT. State the predicate that must hold, as a sentence a reviewer can attack, and give ` +
        `the initialization / maintenance / termination argument (references/correctness.md §1). Set ` +
        `invariantStatus='proved' ONLY for a real inductive argument; 'evidence' for property-test-style ` +
        `support; 'not-proven' otherwise. "No counterexample" is EVIDENCE, never a proof.\n` +
        `3. ORDERING. If more than one thread touches this, name the EXACT memory ordering or lock ` +
        `discipline the correctness argument depends on (references/concurrency.md §4). "It's atomic" is ` +
        `not an argument. Write "n/a" if single-threaded.\n` +
        `4. BENCHMARK. Propose the concrete experiment that would validate your cost claim: runner, ` +
        `warmup, forks/rounds, iteration count, dataset shape, and what result would falsify you ` +
        `(references/benchmarking.md §2-§4).\n\n` +
        `${HONESTY}\n\n` +
        `Set viable=false if this candidate cannot meet the stated constraints at all — that is a useful ` +
        `result, not a failure. Do NOT edit any files. Return raw data conforming to the schema.`,
      optsFor({ taskType: 'analyze', phase: 'Generate', schema: CANDIDATE_SCHEMA }, `generate:${c.key}`),
    ).then((r) => (r ? { key: c.key, ...r } : null)),
  ),
)

// .filter(Boolean): a dead or skipped agent resolves to null (harness policy H5).
const returned = proposals.filter(Boolean)
const candidates = returned.filter((p) => p.viable)
for (const p of returned.filter((p) => !p.viable)) {
  log(`non-viable ${p.key}: ${p.approach} — cannot meet the stated constraints`) // no silent drops (H6)
}
if (returned.length < CANDIDATES.length) {
  log(`${CANDIDATES.length - returned.length} candidate agent(s) returned nothing — counted as no proposal (H5)`)
}

// ─── BARRIER (harness policy H2) ────────────────────────────────────────────────────────────
// Earned, and worth stating precisely rather than by reflex. The Decide stage's prompt must hold
// EVERY candidate's complexity and benchmark result AT ONCE, because the judgment it makes is a
// comparison across the full set and not a per-item verdict: "candidate A's Theta(log n) beats
// candidate B's O(1)-amortized-but-3x-the-constant" is a sentence you cannot write while holding
// one candidate. That is H2's sanctioned "stage N's prompt references the other findings for
// comparison" case, and it is the same cross-item reduce loop-review's security-review.workflow.js
// performs on findings. It is NOT "I need to flatten/filter first", which H2 explicitly refuses.
//
// The barrier pays for itself twice: it is also the early-exit. With zero viable candidates there
// is nothing to test, and with exactly one there is no bake-off to run — ranking a set of size one
// is an agent spent on nothing.
log(`barrier: ${candidates.length}/${CANDIDATES.length} viable candidates merged for comparison`)
if (candidates.length === 0) {
  return { winner: null, note: 'no viable candidate met the stated constraints — revisit the constraints or the candidate set (SKILL §9)' }
}
const SOLO = candidates.length === 1
if (SOLO) {
  log(`only one viable candidate (${candidates[0].key}) — no bake-off to run; stress-testing it and returning without a comparative synthesis`)
}

// Cap the stress stage against the repo's <=15-agents-per-workflow guideline, which
// execution-modes.md §M6 DECIDES wins over full mode's appetite. Cost so far is
// CANDIDATES.length generation agents; each survivor costs WIDTH('verify') skeptics, plus one
// synthesis agent. Full mode therefore narrows the batch rather than exceeding the guideline.
const AGENT_GUIDELINE = 15
const MAX_STRESS = Math.max(1, Math.floor((AGENT_GUIDELINE - CANDIDATES.length - 1) / WIDTH('verify')))
const underTest = candidates.slice(0, MAX_STRESS)
for (const c of candidates.slice(MAX_STRESS)) {
  log(`deferred (over agent guideline) ${c.key}: ${c.approach} — re-run with a narrower candidate set to stress-test it`) // no silent caps (H6)
}

// Three DECLARED stress lenses. Mode picks how many of them run (§M5); it never invents new ones.
// ORDER MATTERS: the list is sliced to WIDTH, and in optimize mode only lens[0] runs — so lens[0]
// carries both mandates. Every lens also gets the counterexample AND methodology mandate in the
// shared prompt below, so narrowing the width narrows the angles, never the obligations.
const STRESS_LENSES = [
  { key: 'counterexample', prompt: 'Attack the INVARIANT directly. Construct a concrete input, sequence, or thread interleaving that violates it — empty, single-element, all-equal, already-sorted, duplicate-heavy, size straddling a resize boundary, adversarial keys, concurrent readers during a mutation. A shrunk concrete case is a disproof; "seems fine" is not a result.' },
  { key: 'cost-model', prompt: 'Re-derive the COST from scratch without reading the proposal\'s derivation, then compare. Check the bound CASE has not drifted (an amortized bound quoted where a worst case was required is the classic failure), check the constant factors and cache behavior the asymptotics discard, and check the claim still holds at the n the constraints actually state.' },
  { key: 'hidden-assumption', prompt: 'Hunt the unstated assumption. Which precondition does the argument silently rely on — sortedness, key distribution, bounded value size, a single writer, a specific memory ordering, an allocator, a GC? Then ask what happens when it is false in production. For a concurrent proposal, check the linearization point actually lies inside its own operation interval.' },
]

// ─── Stage 2 (Stress) ───────────────────────────────────────────────────────────────────────
// One skeptic per (candidate x lens), fanned out flat so the runtime bounds concurrency once.
const lenses = STRESS_LENSES.slice(0, WIDTH('verify'))
log(`stress: ${underTest.length} candidates x ${lenses.length} lens(es) = ${underTest.length * lenses.length} skeptics [mode=${MODE}]`)
const jobs = []
for (const c of underTest) {
  for (const lens of lenses) jobs.push({ c, lens })
}
const verdicts = await parallel(
  jobs.map((j) => () =>
    agent(
      `You are a skeptic trying to REFUTE a proposed mechanism. Do not trust the proposal; re-derive ` +
        `everything yourself.\n\n` +
        `Mechanism under design: ${input.mechanism}\nConstraints: ${input.constraints || 'as stated by the caller'}\n\n` +
        `Candidate: ${j.c.approach}\n` +
        `Claimed invariant: ${j.c.invariant} [status: ${j.c.invariantStatus}]\n` +
        `Correctness argument: ${j.c.correctnessArgument}\n` +
        `Ordering dependency: ${j.c.orderingDependency}\n` +
        `Cost claims: ${JSON.stringify(j.c.costClaims)}\n` +
        `Space: ${j.c.spaceProfile}\n` +
        `Proposed benchmark: ${j.c.proposedBenchmark}\n\n` +
        `Your lens: ${j.lens.prompt}\n\n` +
        `TWO MANDATES, both required regardless of your lens:\n` +
        `(a) Try to construct a CONCRETE counterexample to the invariant. Set invariantHolds=true ONLY ` +
        `if you independently re-derived that it holds; if you are unsure, set it false. Note that ` +
        `invariantStatus='evidence' means no counterexample was FOUND, which is not a proof — do not ` +
        `treat it as one (references/correctness.md §5).\n` +
        `(b) Attack the BENCHMARK METHODOLOGY itself rather than trusting any reported number. Check ` +
        `warmup exclusion, fork/round count, sample size and reported spread, dead-code elimination, ` +
        `coordinated omission, and whether the benchmark's scope even transfers to the real workload ` +
        `(references/benchmarking.md §1 and §6). A methodology that cannot settle the claim makes the ` +
        `number meaningless however carefully it was produced. Set benchmarkSound=false and say why.\n\n` +
        `Also set costReDerived=true only if your independent derivation reached the SAME bound AND the ` +
        `same case. Default every boolean to the pessimistic value when you cannot re-derive the claim ` +
        `yourself. Report confidence 0..1.`,
      optsFor({ taskType: 'verify', phase: 'Stress', schema: VERDICT_SCHEMA }, `stress:${j.lens.key}:${j.c.key}`),
    ).then((v) => (v ? { key: j.c.key, lens: j.lens.key, ...v } : null)),
  ),
)

// .filter(Boolean) before use: a dead skeptic resolves to null (H5).
const votes = verdicts.filter(Boolean)
if (votes.length < jobs.length) {
  log(`${jobs.length - votes.length} skeptic(s) returned no vote — counted as abstentions, not as passes (H5)`)
}

// Tally per candidate. Majority refute kills a claim at ceil(N/2) refutes — never a literal 2,
// which is silently wrong the moment width becomes 3 or 5 (execution-modes.md §M5).
const report = underTest.map((c) => {
  const mine = votes.filter((v) => v.key === c.key)
  const threshold = Math.ceil(Math.max(mine.length, 1) / 2)
  const invariantRefutes = mine.filter((v) => !v.invariantHolds).length
  const costRefutes = mine.filter((v) => !v.costReDerived).length
  const methodRefutes = mine.filter((v) => !v.benchmarkSound).length
  const survived = mine.length > 0 && invariantRefutes < threshold && methodRefutes < threshold
  const objections = mine
    .filter((v) => !v.invariantHolds || !v.costReDerived || !v.benchmarkSound)
    .map((v) => `[${v.lens}] ${v.counterexample !== 'none constructed' ? 'counterexample: ' + v.counterexample + '; ' : ''}${v.costObjection !== 'none' ? 'cost: ' + v.costObjection + '; ' : ''}${!v.benchmarkSound ? 'method: ' + v.methodologyObjection : ''}`)
  // Any claim the candidate itself flagged measured=false stays DERIVED-ONLY through synthesis.
  const anyMeasured = (c.costClaims || []).some((cc) => cc.measured)
  log(
    `${c.key}: ${survived ? 'SURVIVED' : 'NOT PROVEN'} — invariant refutes ${invariantRefutes}/${mine.length} ` +
      `(threshold ${threshold}), cost re-derivation failures ${costRefutes}/${mine.length}, ` +
      `methodology objections ${methodRefutes}/${mine.length}, measured claims: ${anyMeasured ? 'some' : 'NONE'}`,
  )
  for (const o of objections) log(`  objection ${c.key} ${o}`) // never truncate an objection silently (H6)
  return { key: c.key, approach: c.approach, invariant: c.invariant, invariantStatus: c.invariantStatus, costClaims: c.costClaims, spaceProfile: c.spaceProfile, proposedBenchmark: c.proposedBenchmark, survived, invariantRefutes, costRefutes, methodRefutes, votes: mine.length, objections }
})

// Early exit from the BAKEOFF, not from the validation: with one candidate there is nothing to
// rank, so the comparative synthesis agent would be spent producing a single-row table.
if (SOLO) {
  return { winner: report[0].survived ? report[0].key : null, soleCandidate: report[0], note: 'single viable candidate — stress-tested but not ranked; no bake-off was possible' }
}

// ─── Stage 3 (Decide) ───────────────────────────────────────────────────────────────────────
// One synthesis agent, holding the full merged set — the barrier's whole purpose.
const decision = await agent(
  `Pick the winning mechanism for: ${input.mechanism}\n` +
    `Constraints: ${input.constraints || 'as stated by the caller'}\n` +
    `Benchmark runner available this run: ${RUNNER}\n\n` +
    `Every candidate, with its stress-test result:\n${JSON.stringify(report)}\n\n` +
    `Rank them AGAINST EACH OTHER — that comparison is why you were given the whole set. Weight the ` +
    `cost claims by the stated workload mix, and compare constants and cache behavior, not only ` +
    `asymptotics: an O(1)-amortized candidate with a 3x constant can lose to a Theta(log n) one at the ` +
    `n these constraints state (references/complexity-and-structures.md §5).\n\n` +
    `Required in your answer:\n` +
    `1. WINNER, with its cost profile as a list where EVERY entry is labeled MEASURED or DERIVED-ONLY. ` +
    `Label MEASURED only where a runner actually executed and a sample count and spread exist. If no ` +
    `runner ran, every label is DERIVED-ONLY and you say so plainly — never present a Big-O bound as if ` +
    `it were a wall-clock number, and never invent one (references/benchmarking.md §5).\n` +
    `2. RUNNER-UP and precisely why it lost, in terms of the workload — not a generic preference.\n` +
    `3. UNPROVEN CLAIMS: name every candidate (winner included) whose invariant or benchmark claim did ` +
    `NOT survive stress-testing, and say what remains unproven. A candidate that survived because no ` +
    `skeptic could construct a counterexample has EVIDENCE, not a proof — say which it has. Do not ` +
    `quietly omit a failure to make the recommendation look cleaner; an omission here is the completeness ` +
    `failure this stage exists to prevent.\n` +
    `4. NEXT MEASUREMENT: the single experiment that would convert the most load-bearing DERIVED-ONLY ` +
    `claim into a MEASURED one — runner, warmup, forks/rounds, iterations, dataset, and the result that ` +
    `would falsify the recommendation.`,
  optsFor({ taskType: 'synthesize', phase: 'Decide', schema: DECISION_SCHEMA }, 'decide:winner'),
)

if (!decision) {
  // H5: the synthesis agent died. Return the merged evidence rather than nothing — the stress
  // results are the expensive part and are still usable by a human.
  log('synthesis agent returned nothing — returning the stress-tested candidate set unranked (H5)')
  return { winner: null, candidates: report, note: 'synthesis failed; candidates are stress-tested but unranked' }
}

const derivedOnly = (decision.costProfile || []).filter((c) => c.label === 'DERIVED-ONLY').length
log(`bakeoff [mode=${MODE}]: winner ${decision.winner}, runner-up ${decision.runnerUp}, ` +
  `${derivedOnly}/${(decision.costProfile || []).length} cost claims DERIVED-ONLY, ` +
  `${(decision.unprovenClaims || []).length} unproven claim(s) flagged`)
for (const u of decision.unprovenClaims || []) log(`unproven: ${u}`)

return { winner: decision.winner, costProfile: decision.costProfile, runnerUp: decision.runnerUp, whyItLost: decision.whyItLost, unprovenClaims: decision.unprovenClaims, nextMeasurement: decision.nextMeasurement, candidates: report }
