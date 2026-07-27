// Template: LOOP-UNTIL-DRY — unknown-size discovery ("find ALL the X").
// Keeps spawning finder rounds until DRY_LIMIT consecutive rounds surface nothing
// new (loop policy L1), with a hard round cap as backstop (L4).
// Model/effort, verifier width and DRY_LIMIT come from the canonical ROUTES block —
// source of truth: ../references/execution-modes.md §M8. Never inline a bare model:/effort:.
//
// Invoke with: Workflow({ script, args: { task: "...", mode: "optimize" } })
// input.task — one-line description used in agent prompts
// input.mode — 'optimize' (default) or 'full' (execution-modes.md §M2)

export const meta = {
  name: 'loop-until-dry-template', // EDIT ME
  description: 'Discovery loop: find until K consecutive dry rounds, judging each fresh item', // EDIT ME
  phases: [
    { title: 'Find', detail: 'diverse finder rounds' },
    { title: 'Judge', detail: 'diverse-lens majority vote per fresh item' },
  ],
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
const DRY_LIMIT = MODE === 'all-out' ? 3 : MODE === 'lite' ? 1 : 2
// §M8 omission note: DRY_LIMIT is declared here rather than inside the canonical block so the
// block stays byte-identical across all 25 templates; loop policy L1's K is mode-conditional (§M5).

// The full-mode pre-flight (§M6) approved these figures before anything spawned; echo them into
// the transcript so the gate's approved-vs-actual diff against journal.jsonl has both sides.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.
if (MODE === 'full') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// DRY_LIMIT above is the mode-conditional dry-round threshold K: 1 in lite, 2 in balanced, 3 in all-out
// (loop policy L1; execution-modes.md §M5). MAX_ROUNDS and ANGLES below are deliberately
// NOT mode-conditional — widening the angle set is a decomposition change, not a mode
// change (§M5), and the round cap is a safety backstop, not a spend dial.
const MAX_ROUNDS = 10 // hard backstop (loop policy L4)

// EDIT ME: finder angles — rounds vary, agents don't remember (loop policy L8)
const ANGLES = [
  'start from the entry points',
  'start from the data model',
  'start from the edge cases and error paths',
]

// EDIT ME: the judge node's DECLARED lenses. Mode picks how many of them run (§M5); it
// never invents new ones. Declare at least 5 if this node is ever routed as gating.
const JUDGE_LENSES = ['correctness', 'reproducibility', 'impact']

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
        required: ['title', 'detail', 'location'],
      },
    },
  },
  required: ['items'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real'],
}

// EDIT ME: node kinds so routeFor() can resolve each stage (§M3).
const FIND_NODE = { taskType: 'analyze', phase: 'Find', schema: ITEMS_SCHEMA }
const JUDGE_NODE = { taskType: 'judge', phase: 'Judge', schema: VERDICT_SCHEMA }

// Verifier width is mode-resolved (§M5), capped by the declared lens set.
const width = Math.min(WIDTH('judge'), JUDGE_LENSES.length)
if (width < WIDTH('judge')) {
  log(`judge width capped at ${width}: only ${JUDGE_LENSES.length} lenses declared (§M5)`) // no silent caps (H6)
}
const activeLenses = JUDGE_LENSES.slice(0, width)

const key = (b) => `${b.location}::${b.title}`
const seen = new Set() // dedup vs everything SEEN, not confirmed (loop policy L3)
const confirmed = []
let dry = 0

for (let round = 0; round < MAX_ROUNDS && dry < DRY_LIMIT; round++) {
  const angle = ANGLES[round % ANGLES.length]
  // BARRIER: this round's dedup and dry-counter test need ALL of the round's finders
  // at once — a genuine cross-item reduce, so the barrier is earned (harness policy H2).
  const sweeps = await parallel(
    ANGLES.map((a, i) => () =>
      agent(
        // EDIT ME: the discovery prompt
        `Task: ${input.task}\nFind items, approach: ${a}. Round ${round + 1}. Return raw data.`,
        optsFor(FIND_NODE, `find:r${round + 1}:${i}`),
      ),
    ),
  )

  const found = sweeps.filter(Boolean).flatMap((s) => s.items)
  const fresh = found.filter((b) => !seen.has(key(b)))
  log(
    `round ${round + 1} [mode=${MODE}] (${angle}): ${found.length} found, ` +
      `${fresh.length} fresh, dry=${dry}/${DRY_LIMIT}`,
  )

  if (!fresh.length) {
    dry++
    continue
  }
  dry = 0
  fresh.forEach((b) => seen.add(key(b))) // add BEFORE judging (loop policy L3)

  // Diverse-lens majority vote per fresh item (harness policy H4), width from mode (§M5).
  const judged = await parallel(
    fresh.map((b) => () =>
      parallel(
        activeLenses.map((lens) => () =>
          agent(
            `Judge via the ${lens} lens — is this real and worth reporting? Default real=false if uncertain.\nItem: ${b.title} at ${b.location} — ${b.detail}`,
            optsFor(JUDGE_NODE, `judge:${lens}:${b.title}`),
          ),
        ),
      ).then((votes) => {
        const live = votes.filter(Boolean)
        // Majority at ceil(N/2) — correct at width 1, 3 and 5, unlike a literal 2 (§M5).
        return { item: b, real: live.filter((v) => v.real).length >= Math.ceil(live.length / 2) && live.length > 0 }
      }),
    ),
  )

  confirmed.push(...judged.filter(Boolean).filter((j) => j.real).map((j) => j.item))
  log(`round ${round + 1} [mode=${MODE}]: ${confirmed.length} confirmed so far`)
}

log(`done [mode=${MODE}, K=${DRY_LIMIT}, width=${width}]: ${seen.size} seen, ${confirmed.length} confirmed`)
return { confirmed, totalSeen: seen.size, mode: MODE, estimate: ESTIMATE }
