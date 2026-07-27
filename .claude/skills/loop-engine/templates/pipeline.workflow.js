// Template: PIPELINE — known items flowing through independent stages.
// Default choice per harness policy H1. No barrier between stages: item A can be
// in Verify while item B is still in Analyze.
// Model/effort and verifier width come from the canonical ROUTES block — source of truth:
// ../references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { items: [...], task: "...", mode: "optimize" } })
// input.items  — the work-list (discover it BEFORE authoring; see loop policy L6)
// input.task   — one-line description used in agent prompts
// input.mode   — 'optimize' (default) or 'full' (execution-modes.md §M2)
// input.planner— 'opus' (default) | 'fable' — planner-node override only (§M7); this template
//                declares no planner node, so the flag is inert here and passes through harmlessly

export const meta = {
  name: 'pipeline-template', // EDIT ME: kebab-case name for this run
  description: 'Analyze each item, then verify each finding, with no barrier between stages', // EDIT ME
  phases: [
    { title: 'Analyze', detail: 'one agent per item' }, // EDIT ME: mirror framework phase names
    { title: 'Verify', detail: 'adversarial check per result' },
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
// No DRY_LIMIT: this template has no loop stage (§M8 — omit what you do not use). WIDTH is kept:
// stage 2 IS an adversarial verify, and §M5 forbids all-out mode ever running a single skeptic.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// The full-mode pre-flight (§M6) approved these figures before anything spawned; echo them into
// the transcript so the gate's approved-vs-actual diff against journal.jsonl has both sides.
if (MODE === 'full') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// EDIT ME: schema for what the Analyze stage returns (harness policy H3)
const ANALYSIS_SCHEMA = {
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
        required: ['title', 'detail'],
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

// EDIT ME: each stage declares its node kind so routeFor() can resolve it (§M3).
// The default stages are judgment work: analyze, then adversarial verify.
const ANALYZE_NODE = { taskType: 'analyze', phase: 'Analyze', schema: ANALYSIS_SCHEMA }
const VERIFY_NODE = { taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA }

// EDIT ME: the verify node's DECLARED lenses. Mode picks how MANY of them run (§M5); it never
// invents new ones. Five are declared so a gating verify can reach width 5 without inventing a
// lens at run time — needing a sixth is a decomposition change, made here, deliberately.
const VERIFY_LENSES = [
  'correctness: is the stated mechanism actually what the code does?',
  'evidence: can the finding be reproduced from what is written down, or is it asserted?',
  'reachability: is the implicated path actually reachable in this configuration?',
  'duplication: does another finding already cover this at the same location?',
  'impact: if it is real, does it change any outcome that matters here?',
]

// Verifier width is mode-resolved (§M5): 1 in balanced, 3 in full, 5 on a gating node. Capped by
// the declared lens set, and any cap is logged — no silent narrowing (H6).
const width = Math.min(WIDTH(VERIFY_NODE.taskType), VERIFY_LENSES.length)
if (width < WIDTH(VERIFY_NODE.taskType)) {
  log(`verifier width capped at ${width}: only ${VERIFY_LENSES.length} lenses declared (§M5)`)
}
const activeLenses = VERIFY_LENSES.slice(0, width)
log(`[mode=${MODE}] verify width ${width}; a finding dies on ${Math.ceil(width / 2)} refute(s)`)

const results = await pipeline(
  input.items,
  // Stage 1: analyze each item. opts.phase (not global phase()) — harness policy H9.
  (item) =>
    agent(
      // EDIT ME: the per-item analysis prompt
      `Task: ${input.task}\nAnalyze this item and return findings as raw data: ${JSON.stringify(item)}`,
      optsFor(ANALYZE_NODE, `analyze:${item}`),
    ),
  // Stage 2: verify each finding as soon as ITS analysis completes (no barrier).
  // Stage callbacks receive (prevResult, originalItem, index).
  (analysis, item) =>
    parallel(
      analysis.findings.map((f) => () =>
        // Inner fan-out, not a barrier: the skeptics for ONE finding, voted immediately. No
        // cross-item dependency exists, so H2's earned-barrier test is not engaged.
        parallel(
          activeLenses.map((lens) => () =>
            agent(
              // Adversarial framing per harness policy H4.
              `Try to refute this finding from "${item}" through the ${lens} lens. Default to isReal=false if uncertain.\nFinding: ${f.title} — ${f.detail}`,
              optsFor(VERIFY_NODE, `verify:${lens.split(':')[0]}:${f.title}`),
            ),
          ),
        ).then((votes) => {
          // Dead verifiers resolve to null — filter before counting (harness policy H5).
          const live = votes.filter(Boolean)
          const refutes = live.filter((v) => !v.isReal).length
          if (live.length < activeLenses.length) {
            log(`verify:${f.title} — ${activeLenses.length - live.length}/${activeLenses.length} lens(es) died; judging on ${live.length}`)
          }
          // Majority refute kills the finding at ceil(N/2) — 1 of 1, 2 of 3, 3 of 5 (§M5).
          // Never a literal 2: a literal is silently wrong the moment width becomes 5.
          return {
            ...f,
            item,
            votes: live.length,
            refutes,
            isReal: live.length > 0 && refutes < Math.ceil(live.length / 2),
          }
        }),
      ),
    ),
)

// Dead agents/items resolve to null — harness policy H5.
const confirmed = results
  .filter(Boolean)
  .flat()
  .filter(Boolean)
  .filter((f) => f.isReal)

log(`[mode=${MODE}] ${confirmed.length} confirmed findings across ${input.items.length} items at width ${width}`)
return { confirmed, mode: MODE, estimate: ESTIMATE }
