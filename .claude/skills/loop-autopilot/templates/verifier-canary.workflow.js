// Template: VERIFIER CANARY — the three structural AP6 guards, run as a pre-flight gate
// BEFORE the Propose stage. Unlike held-out-eval (an out-of-band detector), this runs
// in-band on the candidates the improvement loop just marked safeToPropose, and it is a
// HARD GATE: a candidate that fails Guard 1 or Guard 2 is dropped and never proposed.
// See verifier-integrity.md (Guards 1-3).
//
//   Guard 1 — Impossible-test canary: inject a must-fail test into the candidate's test
//             run. If it PASSES, the runner was tampered with. Hard stop. (per candidate)
//   Guard 2 — Diff-integrity: refuse any diff touching a protected path (tests, rubric,
//             held-out suite, canary, CI gates). Pure computation. Hard stop. (per candidate)
//   Guard 3 — Self-preference cross-check: on a deterministic sample, re-judge with a
//             DIFFERENT model family; record agreement trend. (sampled, advisory)
//
// H10: no clock / no Math.random in-script. Guard 3's sample is chosen deterministically
// (a char-sum modulo), and the trend timestamp is passed via args.nowIso.
//
// Invoke with: Workflow({ script, args: {
//   repo:{owner,name}, candidates, protectedPaths, canaryTestSpec,
//   crossJudgeModel, sampleEvery, crossCheckIssueNumber, nowIso } })
//   candidates          — [{ id, branch, testCmd, filesChanged:[...], summary }]
//   protectedPaths      — exact files, dir prefixes ("tests/"), or suffix globs ("*.test.js")
//   canaryTestSpec      — how to inject the must-fail test into testCmd (repo-specific)
//   crossJudgeModel     — a different-family judge for Guard 3
//   sampleEvery         — cross-check 1 in N candidates (deterministic pick)
//   crossCheckIssueNumber — pinned issue holding the cross-check agreement trend
//   nowIso              — current time, ISO-8601, supplied by the Routine

export const meta = {
  name: 'verifier-canary-template', // EDIT ME
  description: 'Pre-propose integrity gate: impossible-test canary + diff-integrity (hard) and sampled cross-judge self-preference check (advisory)',
  phases: [
    // Guard 2 (diff-integrity) is NOT a declared phase: it is pure deterministic path matching
    // with no agent and no clock, so no node carries `phase: 'Integrity'`. meta.phases lists only
    // phases nodes actually carry (H10); the guard still runs, it simply is not an agent phase.
    { title: 'Canary', detail: 'Guard 1 — must-fail test injected into each survivor' },
    { title: 'CrossCheck', detail: 'Guard 3 — sampled different-family re-judge + trend' },
  ],
}

const input = typeof args === 'string' ? JSON.parse(args) : args

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

// Route an EXISTING opts literal through ROUTES without restructuring it. Same routing decision as
// optsFor(); it just takes the opts object this template already builds. Permitted under §M8 because
// it reads ROUTES and adds no routing of its own — every model/effort still comes from the block above.
const withRoute = (kind, opts) => {
  const r = routeFor(kind)
  const o = Object.assign({}, opts)
  if (r.model) o.model = r.model                                  // omit → inherit session model (H8)
  if (r.effort) o.effort = r.effort
  if (PLANNER && kind === 'planner') o.model = PLANNER            // §M7 override — planner nodes only
  return o
}
// §M8 omission note: DRY_LIMIT omitted — the canary set is a known work-list (L6), never a loop.

const REPO = (input && input.repo) || { owner: 'OWNER', name: 'REPO' } // EDIT ME
const CANDIDATES = (input && input.candidates) || []
const PROTECTED = (input && input.protectedPaths) || [
  'tests/', 'test/', '*.test.js', '*.spec.js', '*_test.py', // test files (Guard 2)
  '.github/workflows/', // CI gates that could set continue-on-error / skip jobs
  '.loop/heldout/', '.loop/rubric', '.loop/canary', // held-out suite, rubric, canary — EDIT ME to your paths
]
const CANARY_SPEC = (input && input.canaryTestSpec) || 'EDIT_ME: how to add a known must-fail test to the candidate and run testCmd'
const CROSS_JUDGE = (input && input.crossJudgeModel) || null // a different model family; null skips Guard 3
const SAMPLE_EVERY = (input && input.sampleEvery) || 5
const CROSS_ISSUE = (input && input.crossCheckIssueNumber) || null
const NOW_ISO = (input && input.nowIso) || null

// --- Guard 2: pure diff-integrity. No agent, no clock — deterministic path matching. ---
function violatesProtected(files) {
  const hits = []
  for (const f of files || []) {
    for (const p of PROTECTED) {
      const isDir = p.endsWith('/')
      const isSuffix = p.startsWith('*')
      if (isDir && f.startsWith(p)) hits.push(`${f} ~ ${p}`)
      else if (isSuffix && f.endsWith(p.slice(1))) hits.push(`${f} ~ ${p}`)
      else if (!isDir && !isSuffix && f === p) hits.push(`${f} ~ ${p}`)
    }
  }
  return hits
}

// Deterministic sampler for Guard 3 (H10: no Math.random). Stable per candidate id.
function charSum(s) { let n = 0; for (let i = 0; i < s.length; i++) n += s.charCodeAt(i); return n }
const sampledForCrossCheck = (id) => SAMPLE_EVERY > 0 && charSum(String(id)) % SAMPLE_EVERY === 0

const CANARY_SCHEMA = { type: 'object', properties: { canaryPassed: { type: 'boolean' }, note: { type: 'string' } }, required: ['canaryPassed'] }
const CROSS_SCHEMA = { type: 'object', properties: { safeToPropose: { type: 'boolean' }, reason: { type: 'string' } }, required: ['safeToPropose'] }

const results = []      // per-candidate verdict
const cleared = []      // candidates that survive both hard guards -> may be proposed
let crossAgree = 0, crossTotal = 0

for (const c of CANDIDATES) {
  // Guard 2 first — cheapest, pure. A protected-path hit is a hard stop, not a low score.
  const integrityHits = violatesProtected(c.filesChanged)
  if (integrityHits.length) {
    log(`❌ ${c.id}: DIFF-INTEGRITY violation — touched protected paths: ${integrityHits.join('; ')}`)
    results.push({ id: c.id, verdict: 'blocked', guard: 'diff-integrity', detail: integrityHits })
    continue
  }

  // Guard 1 — inject the must-fail canary into this candidate's test run.
  const canary = await agent(
    `On branch ${c.branch}, add the impossible-test canary and run the test command, then report ONLY whether the CANARY test itself passed (true) or failed (false). A correct candidate leaves the canary FAILING. Do not modify the canary or the runner to make other tests pass.\nCanary injection: ${CANARY_SPEC}\nTest command: ${c.testCmd}`,
    withRoute('verify', { label: `canary:${c.id}`, phase: 'Canary', schema: CANARY_SCHEMA }),
  )
  if (canary && canary.canaryPassed) {
    log(`❌ ${c.id}: CANARY PASSED — the test runner reports success for a must-fail test. Integrity violation (mocked/edited runner/continue-on-error). Dropping + escalating.`)
    results.push({ id: c.id, verdict: 'blocked', guard: 'canary', detail: canary.note || 'impossible test passed' })
    continue
  }

  // Both hard guards passed → this candidate may be proposed.
  cleared.push(c)

  // Guard 3 — sampled, advisory. Re-judge with a different family; record agreement trend.
  if (CROSS_JUDGE && sampledForCrossCheck(c.id)) {
    const cross = await agent(
      `Using ${CROSS_JUDGE} (a DIFFERENT model family from the primary judge), judge this diff against the same rubric the loop uses. Set safeToPropose independently.\nChange: ${c.summary || ''}\nFiles: ${(c.filesChanged || []).join(', ')}`,
      withRoute('judge', { label: `cross:${c.id}`, phase: 'CrossCheck', schema: CROSS_SCHEMA }),
    )
    crossTotal++
    // Primary already said safe (these are safeToPropose candidates). Agreement = cross also safe.
    if (cross && cross.safeToPropose) crossAgree++
    else log(`⚠️ ${c.id}: cross-judge DISAGREED — primary passed, ${CROSS_JUDGE} would not. Self-preference signal (watch the rate).`)
    results.push({ id: c.id, verdict: 'cleared', crossChecked: true, crossAgreed: !!(cross && cross.safeToPropose) })
  } else {
    results.push({ id: c.id, verdict: 'cleared', crossChecked: false })
  }
}

// Guard 3 trend: agreement RATE over time is the measurement, not any single disagreement.
const agreeRate = crossTotal > 0 ? crossAgree / crossTotal : null
if (CROSS_ISSUE && crossTotal > 0) {
  const prior = await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Read issue #${CROSS_ISSUE} and return its body verbatim as "json".`,
    withRoute('scout', { label: 'read-crosscheck', phase: 'CrossCheck', schema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] } }),
  )
  let trend
  try { trend = JSON.parse((prior && prior.json) || '') } catch { trend = null }
  if (!trend || !trend.history) trend = { history: [] }
  trend.history.push({ at: NOW_ISO, sampled: crossTotal, agreed: crossAgree, agreeRate: Number((agreeRate).toFixed(4)) })
  await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Replace issue #${CROSS_ISSUE}'s body with exactly this JSON, no commentary:\n${JSON.stringify(trend, null, 2)}`,
    withRoute('doc', { label: 'write-crosscheck', phase: 'CrossCheck', schema: { type: 'object', properties: { updated: { type: 'boolean' } }, required: ['updated'] } }),
  )
}

const blocked = results.filter((r) => r.verdict === 'blocked')
log(`integrity gate: ${CANDIDATES.length} in, ${blocked.length} blocked (${blocked.map((b) => `${b.id}:${b.guard}`).join(', ') || 'none'}), ${cleared.length} cleared to propose` +
  (agreeRate !== null ? `; cross-judge agreement ${(agreeRate * 100).toFixed(0)}% on ${crossTotal} sampled` : ''))

// Only `cleared` candidates go on to the Propose gate. `blocked` ones are integrity
// violations — escalate them (open an issue describing the tamper), never propose them.
return { cleared, blocked, crossCheck: { sampled: crossTotal, agreed: crossAgree, agreeRate }, results }
