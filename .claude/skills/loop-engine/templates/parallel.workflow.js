// Template: PARALLEL FAN-OUT + BARRIER — independent finders whose results must be
// merged/deduped across the whole set before the next (expensive) stage.
// The barrier is earned here per harness policy H2: dedup needs ALL finder output at once.
// Model/effort and verifier width come from the canonical ROUTES block — source of truth:
// ../references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { task: "...", mode: "optimize" } })
// input.task — one-line description used in agent prompts
// input.mode — 'optimize' (default) or 'full' (execution-modes.md §M2)

export const meta = {
  name: 'parallel-template', // EDIT ME
  description: 'Multi-lens fan-out, dedup across all results, then verify survivors', // EDIT ME
  phases: [
    { title: 'Find', detail: 'one finder per lens' }, // EDIT ME: mirror framework phase names
    { title: 'Verify', detail: 'adversarial check per deduped finding' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see CONTRIBUTING's ROUTES grep).
const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'
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
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : 1)
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  return opts
}

// EDIT ME: multi-modal sweep — each finder searches a DIFFERENT way (harness policy H4).
const LENSES = [
  { key: 'correctness', prompt: 'Search for correctness problems' },
  { key: 'security', prompt: 'Search for security problems' },
  { key: 'performance', prompt: 'Search for performance problems' },
]

// EDIT ME: the verify node's DECLARED lenses. Mode picks how many of them run (§M5);
// it never invents new ones. Declare at least 5 if this node can ever be gating.
const VERIFY_LENSES = ['correctness', 'security', 'performance', 'reproducibility', 'impact']

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          location: { type: 'string' },
        },
        required: ['title', 'detail', 'location'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['isReal', 'reason'],
}

// EDIT ME: node kinds so routeFor() can resolve each stage (§M3).
const FIND_NODE = { taskType: 'analyze', phase: 'Find', schema: FINDINGS_SCHEMA }
const VERIFY_NODE = { taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA }

// BARRIER: wait for all finders, because dedup needs the full result set.
const sweeps = await parallel(
  LENSES.map((lens) => () =>
    agent(
      `Task: ${input.task}\n${lens.prompt}. Return findings as raw data.`,
      optsFor(FIND_NODE, `find:${lens.key}`),
    ),
  ),
)

// .filter(Boolean): a skipped/dead finder resolves to null (harness policy H5).
const all = sweeps.filter(Boolean).flatMap((s) => s.findings)

// Dedup in plain JS — never spend an agent on it (loop policy L3).
const key = (f) => `${f.location}::${f.title}`
const deduped = [...new Map(all.map((f) => [key(f), f])).values()]
log(`[mode=${MODE}] ${all.length} raw findings → ${deduped.length} after dedup`) // no silent caps (H6)

// Early-exit is the other legitimate use of the barrier.
if (deduped.length === 0) {
  return { confirmed: [], mode: MODE, note: 'no findings from any lens' }
}

// Verifier width is mode-resolved (§M5): 1 in optimize, 3 in full, 5 on a gating node.
// Capped by the declared lens set — widening the set is a decomposition change, not a mode change.
const width = Math.min(WIDTH('verify'), VERIFY_LENSES.length)
if (width < WIDTH('verify')) {
  log(`verifier width capped at ${width}: only ${VERIFY_LENSES.length} lenses declared (§M5)`) // no silent caps (H6)
}
const activeLenses = VERIFY_LENSES.slice(0, width)

const verified = await parallel(
  deduped.map((f) => () =>
    // Inner fan-out, not a barrier: the skeptics for ONE finding, voted immediately.
    parallel(
      activeLenses.map((lens) => () =>
        agent(
          `Try to refute this finding through the ${lens} lens. Default to isReal=false if uncertain.\nFinding: ${f.title} at ${f.location} — ${f.detail}`,
          optsFor(VERIFY_NODE, `verify:${lens}:${f.title}`),
        ),
      ),
    ).then((votes) => {
      const live = votes.filter(Boolean)
      const refutes = live.filter((v) => !v.isReal).length
      // Majority refute kills the finding at ceil(N/2) — correct at width 1, 3 and 5 (§M5).
      return { ...f, votes: live.length, refutes, isReal: refutes < Math.ceil(live.length / 2) }
    }),
  ),
)

const confirmed = verified.filter(Boolean).filter((f) => f.isReal)
log(`[mode=${MODE}] ${confirmed.length}/${deduped.length} findings survived ${width}-lens verification`)
return { confirmed, mode: MODE }
