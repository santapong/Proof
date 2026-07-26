// Template: PRIOR-ART SEARCH — find existing frameworks/libraries/services/standards
// that already solve a need, evaluate them, and recommend reuse vs. build.
// Built on the workflow skill patterns: parallel discovery fan-out with a dedup barrier
// (harness policy H2), per-candidate evaluation (H1 pipeline / parallel), then a decisive
// build-vs-buy synthesis. Pairs with the loop-research skill for source-verified claims.
//
// Model/effort come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
// The Decide node is tagged `gating`, so it is pinned to claude-opus-5 at max effort in BOTH
// modes: its wrong answer picks the wrong dependency for the project, and the team lives with
// that for years (§M3 — error cost, not token cost, decides the gating row).
//
// Invoke with: Workflow({ script, args: { need: "...", constraints: "...", sources: [...], mode: "optimize" } })
// input.need        — the capability required, stated solution-neutrally (see SKILL.md step 1)
// input.constraints — hard constraints (language/runtime, license, deployment, scale)
// input.sources     — optional array of source-lenses to search; falls back to a default set
// input.mode        — 'optimize' (default) or 'full' (execution-modes.md §M2)

export const meta = {
  name: 'prior-art-search-template', // EDIT ME
  description: 'Search sources for existing solutions, evaluate each, and recommend reuse vs. adapt vs. build', // EDIT ME
  phases: [
    { title: 'Discover', detail: 'one searcher per source lens' },
    { title: 'Evaluate', detail: 'score each candidate against the need' },
    { title: 'Decide', detail: 'build-vs-buy recommendation' },
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
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// No DRY_LIMIT: this template has no loop stage. No plannerAgent: no node carries taskType
// 'planner'. No WIDTH: the only correctness-critical node is the Decide node at the end, and
// under §M5's GATING-DECISION carve-out a single decision node is width 1 in BOTH modes —
// replicating it produces N decisions with no defined reduce, and a vote over decisions is a
// decomposition change, not a mode dial. Its error cost is answered instead by the pinned
// claude-opus-5 / max routing the 'gating' route already guarantees in both modes (§M3).
// (§M8 — omit what you do not use, and say which and why.)

// EDIT ME: search the boring options first (see references/where-to-look.md). Each lens is a
// DIFFERENT place to look, so the sweep isn't a monoculture (harness policy H4).
const SOURCES = (input && input.sources) || [
  'the language standard library and the platform/runtime already in use',
  'ecosystem package registries (npm, PyPI, crates.io, Maven, Go modules, etc.)',
  'managed / cloud services that provide the capability',
  'relevant standards and specifications (IETF/W3C/ISO/OpenAPI, file formats, protocols)',
  'existing internal / monorepo code',
]

const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['stdlib', 'library', 'framework', 'service', 'standard', 'internal'] },
          url: { type: 'string' },
          whatItDoes: { type: 'string' },
        },
        required: ['name', 'kind', 'whatItDoes'],
      },
    },
  },
  required: ['candidates'],
}

const EVAL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    fit: { type: 'number' }, // 0..1 against the MUST-haves
    maturity: { type: 'string' },
    license: { type: 'string' },
    security: { type: 'string' },
    lockIn: { type: 'string' },
    tco: { type: 'string' },
    verdict: { type: 'string', enum: ['reuse', 'adapt', 'reject'] },
    notes: { type: 'string' },
  },
  required: ['name', 'fit', 'verdict'],
}

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    recommendation: { type: 'string', enum: ['reuse', 'adapt', 'build'] },
    pick: { type: 'string' },
    rationale: { type: 'string' },
    counterArgument: { type: 'string' },
    runnerUp: { type: 'string' },
  },
  required: ['recommendation', 'rationale'],
}

// Phase Discover: BARRIER — dedup needs every searcher's candidates at once (harness policy H2).
const sweeps = await parallel(
  SOURCES.map((src, i) => () =>
    agent(
      `Need (state solution-neutrally): ${input.need}\nConstraints: ${input.constraints || '(none given)'}\nSearch THIS source for existing solutions that already meet the need: ${src}. Use web search/fetch and any research tools available. Return real candidates as raw data — do not evaluate yet.`,
      optsFor({ taskType: 'scout', phase: 'Discover', schema: CANDIDATES_SCHEMA }, `discover:${i}`),
    ),
  ),
)

// .filter(Boolean): a dead searcher resolves to null (harness policy H5). Dedup by lowercased name.
const allCandidates = sweeps.filter(Boolean).flatMap((s) => s.candidates)
const candidates = [...new Map(allCandidates.map((c) => [c.name.toLowerCase(), c])).values()]
log(`discover [mode=${MODE}]: ${allCandidates.length} candidates -> ${candidates.length} after dedup`)

// Early-exit: nothing exists -> building is justified (SKILL.md step 4). This is the other
// legitimate use of the barrier.
if (candidates.length === 0) {
  return {
    recommendation: 'build',
    rationale: 'No existing solution found across the searched sources that meets the need.',
    candidates: 0,
  }
}

// Phase Evaluate: score each candidate against the need in parallel.
const evaluations = await parallel(
  candidates.map((c) => () =>
    agent(
      `Evaluate this candidate against the need honestly (fit to MUST-haves, maturity, license, security/supply-chain, lock-in, TCO). Do not reject over a nice-to-have — prefer adapt. Verify maturity/security claims against primary sources.\nNeed: ${input.need}\nConstraints: ${input.constraints || '(none given)'}\nCandidate: ${c.name} (${c.kind}) — ${c.whatItDoes} ${c.url || ''}`,
      optsFor({ taskType: 'analyze', phase: 'Evaluate', schema: EVAL_SCHEMA }, `evaluate:${c.name}`),
    ),
  ),
)

const scored = evaluations.filter(Boolean)
const viable = scored.filter((e) => e.verdict !== 'reject')
log(`evaluate: ${scored.length} scored, ${viable.length} viable (reuse/adapt)`)

// Phase Decide: ONE agent makes the decisive build-vs-buy call from the evaluations. This is a
// gating DECISION node, not a gating verify: it consumes evaluations that are already scored and
// emits a single recommendation. §M5's gating-decision carve-out puts it at width 1 in both
// modes; full mode does not widen it. A dead decision node is a no-verdict — the caller sees
// nulls below and must never read that as a recommendation.
const decision = await agent(
  `Make the build-vs-buy decision for the need: ${input.need}\nDefault to reuse; the ladder is reuse -> adapt -> build, and building must be earned (no viable candidate, core differentiation, unacceptable license/security/lock-in, or trivial-to-build). Pick decisively, name the strongest counter-argument, and give the runner-up.\nEvaluations (JSON): ${JSON.stringify(scored)}`,
  optsFor({ taskType: 'gating', phase: 'Decide', schema: DECISION_SCHEMA }, 'decide'),
)

return {
  recommendation: decision ? decision.recommendation : null,
  pick: decision ? decision.pick : null,
  rationale: decision ? decision.rationale : null,
  counterArgument: decision ? decision.counterArgument : null,
  runnerUp: decision ? decision.runnerUp : null,
  candidatesConsidered: candidates.length,
  viable: viable.length,
}
