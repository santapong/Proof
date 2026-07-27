// Template: LOOP-UNTIL-BUDGET — scale depth to the user's token target ("+500k").
// Runs rounds while headroom remains. The budget.total && guard is MANDATORY:
// without a target, budget.remaining() is Infinity and an unguarded loop runs
// straight into the 1000-agent backstop (loop policy L2).
//
// --budget × --mode all-out: in all-out mode the ceiling is PRE-APPROVED at the pre-flight
// (../references/execution-modes.md §M6), which refuses to start when the estimate's
// high end exceeds the budget — rather than discovering it mid-run via H6's throw.
// That is deliberately stricter than H6. In balanced mode the runtime guard below is
// the only ceiling, and H6's mid-run throw still applies.
// Model/effort come from the canonical ROUTES block — source of truth:
// ../references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { task: "...", mode: "optimize" } })
// input.task — one-line description used in agent prompts
// input.mode — 'optimize' (default) or 'full' (execution-modes.md §M2)

export const meta = {
  name: 'loop-until-budget-template', // EDIT ME
  description: 'Budget-scaled discovery: keep running rounds while token headroom remains', // EDIT ME
  phases: [{ title: 'Find', detail: 'one round per budget window' }],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// ---------------------------------------------------------------------------
// EDIT ME — the figures the user APPROVED at the full-mode pre-flight
// (../references/execution-modes.md §M6). The orchestrating session computes them at
// authoring time and stamps them here as a PURE LITERAL, because a script may not read a
// clock, roll dice, or prompt a human (harness policy H10).
// Leave the zeros under --mode balanced: no pre-flight fires and nothing was approved.
// They are echoed into the return value so the gate can diff approved-vs-actual against
// <transcriptDir>/journal.jsonl instead of taking the estimate on faith — loop-engine/SKILL.md
// step 7 and loop-orchestrate/SKILL.md both require that diff, and this literal is its left side.
// ---------------------------------------------------------------------------
const ESTIMATE = { agents: 0, tokensLow: 0, tokensHigh: 0, mode: 'optimize' }

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
const RAW_MODE = (input && input.mode) || 'balanced'
const MODE_ALIAS = { optimize: 'balanced', full: 'all-out' }          // v1.1 names — still accepted (§M9.6)
const MODE = MODE_ALIAS[RAW_MODE] || (['lite', 'balanced', 'all-out'].indexOf(RAW_MODE) >= 0 ? RAW_MODE : 'balanced')
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = {
  lite: {
    scout:      { model: 'claude-haiku-4-5', effort: null },   // Haiku has no effort dial — omit, never 'low'
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: null },
    analyze:    { model: 'claude-sonnet-5',  effort: 'medium' },
    synthesize: { model: 'claude-sonnet-5',  effort: 'medium' },
    verify:     { model: 'claude-sonnet-5',  effort: 'medium' },
    judge:      { model: 'claude-sonnet-5',  effort: 'medium' },
    critic:     { model: 'claude-sonnet-5',  effort: 'medium' },
    gating:     { model: 'claude-opus-5',    effort: 'high' }, // pinned in EVERY mode — error cost
    planner:    { model: 'claude-opus-5',    effort: 'high' }, // pinned in EVERY mode — gates the run
  },
  balanced: {
    scout:      { model: 'claude-haiku-4-5', effort: null },
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: 'high' },
    analyze:    { model: null,               effort: 'high' }, // null model = omit, inherit session (H8)
    synthesize: { model: null,               effort: 'high' },
    verify:     { model: null,               effort: 'high' },
    judge:      { model: null,               effort: 'high' },
    critic:     { model: null,               effort: 'high' },
    gating:     { model: 'claude-opus-5',    effort: 'max' },
    planner:    { model: 'claude-opus-5',    effort: 'xhigh' },
  },
  'all-out': {
    scout:      { model: 'claude-opus-5', effort: 'xhigh' },
    doc:        { model: 'claude-opus-5', effort: 'xhigh' },
    implement:  { model: 'claude-opus-5', effort: 'xhigh' },
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
const WIDTH = (kind) => (MODE === 'all-out' ? (kind === 'gating' ? 5 : 3) : MODE === 'lite' ? 1 : (kind === 'gating' ? 3 : 1))
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// No WIDTH: this template has no verify/judge/critic stage — each round is a single analyze
// node and the reduce is plain-JS dedup, not an adversarial vote (§M8 — omit what you do not
// use). No DRY_LIMIT either: this loop terminates on the budget floor (L2), not on a dry count.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// The full-mode pre-flight (§M6) approved these figures before anything spawned; echo them into
// the transcript so the gate's approved-vs-actual diff against journal.jsonl has both sides.
if (MODE === 'full') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// EDIT ME: cost of one full round plus verification headroom (loop policy L2)
const FLOOR = 50_000
const MAX_ROUNDS = 20 // hard backstop (loop policy L4)

const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          location: { type: 'string' },
        },
        required: ['title', 'detail'],
      },
    },
  },
  required: ['items'],
}

// EDIT ME: node kind so routeFor() can resolve the stage (§M3).
const FIND_NODE = { taskType: 'analyze', phase: 'Find', schema: ITEMS_SCHEMA }

const key = (b) => `${b.location}::${b.title}`
const seen = new Set()
const results = []
let round = 0

if (!budget.total) {
  // No token target set: do ONE bounded round instead of looping (loop policy L2).
  log('no budget target set — running a single round')
}

do {
  round++
  const sweep = await agent(
    // EDIT ME: vary the prompt by round — agents don't remember prior rounds (loop policy L8)
    `Task: ${input.task}\nRound ${round}: find items not yet covered. Return raw data.`,
    optsFor(FIND_NODE, `find:r${round}`),
  )

  const fresh = (sweep ? sweep.items : []).filter((b) => !seen.has(key(b)))
  fresh.forEach((b) => seen.add(key(b)))
  results.push(...fresh)

  log(
    `round ${round} [mode=${MODE}]: +${fresh.length} fresh (${results.length} total), ` +
      (budget.total ? `${Math.round(budget.remaining() / 1000)}k tokens remaining` : 'no budget target'),
  )
} while (budget.total && budget.remaining() > FLOOR && round < MAX_ROUNDS)

log(`done after ${round} round(s) [mode=${MODE}]: ${results.length} items`)
return { items: results, rounds: round, mode: MODE, estimate: ESTIMATE }
