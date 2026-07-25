// Template: BUG DIAGNOSIS — parallel hypothesis testing to localize a root cause.
// Built on the workflow skill patterns: an optional hypothesis-generation agent, then a
// parallel fan-out with a BARRIER (harness policy H2 — the pick step needs every
// hypothesis verdict at once), and a final synthesis over the confirmed hypotheses.
//
// The engine is ELIMINATION, not confirmation: each investigator is told to try to
// ELIMINATE its hypothesis, and a hypothesis that survives only because no one tried to
// kill it is not confirmed (harness policy H4 — verification is adversarial). This mirrors
// the reproduce -> localize -> root-cause -> fix method the loop-debug skill drives.
//
// Model/effort come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { symptom, context, hypotheses, mode: "optimize" } })
// input.symptom    — the bug: observed vs expected behaviour, error/stack trace
// input.context    — reproduction steps + evidence already gathered (logs, diffs, env)
// input.hypotheses — optional array of { id, statement, test }; if omitted, an agent
//                    generates them from the symptom + context
// input.mode       — 'optimize' (default) or 'full' (execution-modes.md §M2). Full mode runs
//                    WIDTH('verify') investigators per hypothesis instead of one.

export const meta = {
  name: 'bug-diagnosis-template', // EDIT ME
  description: 'Generate candidate root-cause hypotheses, test each in parallel to eliminate or confirm it, then synthesize a minimal fix', // EDIT ME
  phases: [
    { title: 'Hypothesize', detail: 'enumerate candidate root causes' }, // EDIT ME: mirror framework phase names
    { title: 'Investigate', detail: 'one investigator per hypothesis, eliminate or confirm' },
    { title: 'Synthesize', detail: 'root cause + minimal fix + regression test' },
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
// No DRY_LIMIT: this template has no loop-until-dry stage (§M8 — omit what you do not use).

// EDIT ME: how many hypotheses to generate when the caller supplies none.
const HYPOTHESIS_COUNT = 5

// EDIT ME: the declared elimination lenses. Each is a DIFFERENT WAY to kill a hypothesis, not a
// different layer to blame — the hypotheses already span layers (H4: diversity beats redundancy).
// Mode picks how MANY of these run (WIDTH('verify') — 1 in optimize, 3 in full); it never invents
// new ones. A node that needs width 5 needs two more lenses declared here, deliberately (§M5).
const INVESTIGATE_LENSES = [
  { key: 'read-the-code', prompt: 'Eliminate it by READING: walk the implicated code path statically and check whether the stated mechanism can even occur — the guard that already exists, the branch that is unreachable, the type that makes the value impossible.' },
  { key: 'instrument-the-repro', prompt: 'Eliminate it by OBSERVING: run the reproduction with targeted instrumentation and check whether the intermediate state the hypothesis predicts actually appears. A predicted value that never materializes kills the hypothesis.' },
  { key: 'history-and-bisect', prompt: 'Eliminate it by HISTORY: use git log/blame/bisect on the implicated region. If the code the hypothesis blames predates the first failing revision unchanged, the hypothesis is refuted unless a caller or input changed around it.' },
]

const HYPOTHESES_SCHEMA = {
  type: 'object',
  properties: {
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          statement: { type: 'string' }, // a falsifiable claim about the root cause
          test: { type: 'string' }, // the cheapest observation that would eliminate it
        },
        required: ['id', 'statement', 'test'],
      },
    },
  },
  required: ['hypotheses'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    verdict: { type: 'string', enum: ['confirmed', 'eliminated', 'inconclusive'] },
    evidence: { type: 'string' }, // the concrete observation (code, log, trace) behind the verdict
    rootCause: { type: 'string' }, // filled only when confirmed
  },
  required: ['id', 'verdict', 'evidence'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    rootCause: { type: 'string' },
    fix: { type: 'string' }, // the MINIMAL change that addresses the root cause, not the symptom
    regressionTest: { type: 'string' }, // a test that fails before the fix and passes after
  },
  required: ['rootCause', 'fix', 'regressionTest'],
}

// Phase Hypothesize: use the caller's list if given, else generate a diverse set.
// Diversity matters (harness policy H4) — hypotheses that all blame the same layer test nothing.
let hypotheses = input && Array.isArray(input.hypotheses) ? input.hypotheses : null
if (!hypotheses) {
  const gen = await agent(
    `A bug is reported. Enumerate ${HYPOTHESIS_COUNT} DISTINCT, falsifiable root-cause hypotheses spanning different layers (input/validation, state/data, control flow, dependency/config, environment/timing). For each, give the cheapest observation that would ELIMINATE it. Do not investigate yet — just enumerate.\nSymptom: ${input.symptom}\nContext (repro + evidence): ${input.context}`,
    optsFor({ taskType: 'analyze', phase: 'Hypothesize', schema: HYPOTHESES_SCHEMA }, 'hypothesize'),
  )
  hypotheses = (gen && gen.hypotheses) || []
}
log(`hypothesize: ${hypotheses.length} candidate root causes to test [mode=${MODE}]`)

if (hypotheses.length === 0) {
  return { rootCause: null, fix: null, note: 'no hypotheses to test — refine the symptom/context', confirmed: 0, eliminated: 0 }
}

// Phase Investigate: BARRIER — the pick step below needs every verdict at once (harness policy H2).
// Each investigator is framed to ELIMINATE its hypothesis; it may only return "confirmed" with
// direct evidence, and defaults to "inconclusive" when it can neither kill nor prove it (H4).
// Width is mode-resolved (§M5): one investigator per hypothesis in optimize, three diverse
// elimination lenses in full. The job list is hypotheses × lenses, flattened into one fan-out.
const lenses = INVESTIGATE_LENSES.slice(0, WIDTH('verify'))
const jobs = hypotheses.flatMap((h) => lenses.map((lens) => ({ h, lens })))
log(`investigate: ${hypotheses.length} hypotheses × ${lenses.length} lens(es) = ${jobs.length} investigator(s)`)
const results = await parallel(
  jobs.map((j) => () =>
    agent(
      `Investigate ONE root-cause hypothesis for this bug by trying to ELIMINATE it against the codebase. Read the relevant code and reproduce/trace as needed. Return "eliminated" if evidence contradicts it, "confirmed" ONLY with a direct causal observation, else "inconclusive". Do not confirm on a hunch.\nSymptom: ${input.symptom}\nContext: ${input.context}\nHypothesis ${j.h.id}: ${j.h.statement}\nEliminating test: ${j.h.test}\nUse this elimination lens: ${j.lens.prompt}`,
      optsFor({ taskType: 'verify', phase: 'Investigate', schema: VERDICT_SCHEMA }, `investigate:${j.lens.key}:${j.h.id}`),
    ).then((v) => (v ? { ...v, id: j.h.id, lens: j.lens.key } : null)),
  ),
)

// .filter(Boolean): a skipped/dead investigator resolves to null (harness policy H5). Pick in plain JS.
const votes = results.filter(Boolean)
if (votes.length < jobs.length) {
  log(`${jobs.length - votes.length} investigator(s) returned no verdict — counted as abstentions, not as eliminations (H5)`)
}

// Tally per hypothesis. Majority kills (or confirms) at ⌈N/2⌉ votes — never a literal 2, which is
// silently wrong the moment width becomes 3 or 5 (execution-modes.md §M5). An abstention is not a
// vote either way, so a hypothesis with no returned verdict stays inconclusive rather than dying.
const tallied = hypotheses.map((h) => {
  const mine = votes.filter((v) => v.id === h.id)
  const threshold = Math.ceil(Math.max(mine.length, 1) / 2)
  const elim = mine.filter((v) => v.verdict === 'eliminated')
  const conf = mine.filter((v) => v.verdict === 'confirmed')
  const verdict =
    mine.length === 0 ? 'inconclusive' : elim.length >= threshold ? 'eliminated' : conf.length >= threshold ? 'confirmed' : 'inconclusive'
  log(`  ${h.id}: ${verdict} — ${conf.length} confirm / ${elim.length} eliminate of ${mine.length} vote(s), threshold ${threshold}`)
  return {
    id: h.id,
    statement: h.statement,
    verdict,
    votes: mine.length,
    evidence: (verdict === 'eliminated' ? elim : conf).map((v) => `[${v.lens}] ${v.evidence}`).join(' | ') || mine.map((v) => `[${v.lens}] ${v.evidence}`).join(' | '),
    rootCause: (conf.find((v) => v.rootCause) || {}).rootCause || '',
  }
})

const confirmed = tallied.filter((v) => v.verdict === 'confirmed')
const eliminated = tallied.filter((v) => v.verdict === 'eliminated')
const inconclusive = tallied.filter((v) => v.verdict === 'inconclusive')
log(`investigate [mode=${MODE}]: ${confirmed.length} confirmed, ${eliminated.length} eliminated, ${inconclusive.length} inconclusive`)

if (confirmed.length === 0) {
  // Nothing survived as a confirmed cause — report the eliminations so the next round narrows.
  return {
    rootCause: null,
    fix: null,
    note: 'no hypothesis confirmed; broaden hypotheses or gather more evidence',
    confirmed: 0,
    eliminated: eliminated.length,
    inconclusive: inconclusive.map((v) => ({ id: v.id, evidence: v.evidence })),
  }
}

// Phase Synthesize: one agent states the root cause and the MINIMAL fix from confirmed evidence only.
const synthesis = await agent(
  `The following hypotheses were CONFIRMED with evidence for this bug. State the single root cause, propose the MINIMAL fix that addresses the cause (not the symptom), and write a regression test that fails before the fix and passes after.\nSymptom: ${input.symptom}\nContext: ${input.context}\nConfirmed (JSON): ${JSON.stringify(confirmed)}`,
  optsFor({ taskType: 'synthesize', phase: 'Synthesize', schema: FIX_SCHEMA }, 'synthesize'),
)

return {
  rootCause: synthesis ? synthesis.rootCause : null,
  fix: synthesis ? synthesis.fix : null,
  regressionTest: synthesis ? synthesis.regressionTest : null,
  confirmed: confirmed.length,
  eliminated: eliminated.length,
  inconclusive: inconclusive.length,
}
