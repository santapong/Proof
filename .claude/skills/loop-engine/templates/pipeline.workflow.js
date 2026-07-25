// Template: PIPELINE — known items flowing through independent stages.
// Default choice per harness policy H1. No barrier between stages: item A can be
// in Verify while item B is still in Analyze.
// Model/effort come from the canonical ROUTES block — source of truth:
// ../references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { items: [...], task: "...", mode: "optimize" } })
// input.items — the work-list (discover it BEFORE authoring; see loop policy L6)
// input.task  — one-line description used in agent prompts
// input.mode  — 'optimize' (default) or 'full' (execution-modes.md §M2)

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
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  return opts
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
        agent(
          // Adversarial framing per harness policy H4.
          `Try to refute this finding from "${item}". Default to isReal=false if uncertain.\nFinding: ${f.title} — ${f.detail}`,
          optsFor(VERIFY_NODE, `verify:${f.title}`),
        ).then((v) => ({ ...f, item, verdict: v })),
      ),
    ),
)

// Dead agents/items resolve to null — harness policy H5.
const confirmed = results
  .filter(Boolean)
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict && f.verdict.isReal)

log(`[mode=${MODE}] ${confirmed.length} confirmed findings across ${input.items.length} items`)
return { confirmed, mode: MODE }
