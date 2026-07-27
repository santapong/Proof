// Template: RESEARCH — multi-source research with adversarial fact-checking and cited synthesis.
// Built on the workflow skill patterns: parallel search fan-out with a dedup barrier
// (harness policy H2), a read -> verify pipeline per source (H1, no barrier), and a
// final synthesis over verified claims.
//
// Model/effort come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { question: "...", angles: [...], mode: "optimize" } })
// input.question — the research question (scope it BEFORE authoring; see the skill, step 1)
// input.angles   — optional array of distinct search angles; falls back to a default set
// input.mode     — 'optimize' (default) or 'full' (execution-modes.md §M2). All-out mode fact-checks
//                  every claim through WIDTH('verify') diverse lenses instead of one.

export const meta = {
  name: 'research-template', // EDIT ME
  description: 'Fan out searches, deep-read sources, adversarially verify each claim, synthesize a cited report', // EDIT ME
  phases: [
    { title: 'Search', detail: 'one searcher per angle' },
    { title: 'Read', detail: 'deep-read + claim extraction per source' },
    { title: 'Verify', detail: 'adversarial fact-check per claim' },
    { title: 'Synthesize', detail: 'cited report from verified claims' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
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
// No DRY_LIMIT: this template has no loop-until-dry stage (§M8 — omit what you do not use).
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: multi-modal sweep — each angle searches a DIFFERENT way (harness policy H4).
const ANGLES = (input && input.angles) || [
  'primary and authoritative sources: official docs, standards, source data, filings',
  'recent developments and news (note dates)',
  'critical, sceptical, or contrarian takes and known failure modes',
  'quantitative data: benchmarks, studies, datasets with methodology',
]

// EDIT ME: the declared fact-check lenses. Each attacks a claim a DIFFERENT way (H4). Mode picks
// how MANY run (WIDTH('verify') — 1 in balanced, 3 in full); it never invents new ones, so a node
// that needs width 5 needs two more lenses declared here, deliberately (§M5).
const FACT_CHECK_LENSES = [
  { key: 'contradiction', prompt: 'Hunt for a source that CONTRADICTS the claim outright, or that states a materially different number, scope, or condition. One credible contradiction is enough to set supported=false.' },
  { key: 'provenance', prompt: 'Attack the provenance instead of the substance: is the cited source primary, or is it repeating someone else? Is it dated, and is the date inside the window the claim needs? A circular chain of secondary sources is not corroboration.' },
  { key: 'independence', prompt: 'Attack the corroboration: are the supporting sources actually INDEPENDENT of each other, or do they all trace back to one press release, one dataset, or one author? Non-independent agreement is one source wearing several hats.' },
]

const SOURCES_SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['url', 'title'],
      },
    },
  },
  required: ['sources'],
}

const CLAIMS_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'string' },
          sourceUrl: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['claim', 'sourceUrl'],
      },
    },
  },
  required: ['claims'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    supported: { type: 'boolean' },
    confidence: { type: 'number' },
    note: { type: 'string' },
  },
  required: ['supported', 'confidence'],
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    report: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'report'],
}

// Phase Search: BARRIER — dedup needs every searcher's results at once (harness policy H2).
const sweeps = await parallel(
  ANGLES.map((a, i) => () =>
    agent(
      `Research question: ${input.question}\nFind high-quality sources via this angle: ${a}. Use web search/fetch and any research MCP tools available. Return candidate sources as raw data — do not deep-read yet.`,
      optsFor({ taskType: 'scout', phase: 'Search', schema: SOURCES_SCHEMA }, `search:${i}`),
    ),
  ),
)

// .filter(Boolean): a dead searcher resolves to null (harness policy H5). Dedup by URL in plain JS.
const allSources = sweeps.filter(Boolean).flatMap((s) => s.sources)
const sources = [...new Map(allSources.map((s) => [s.url, s])).values()]
log(`search [mode=${MODE}]: ${allSources.length} candidate sources -> ${sources.length} after dedup`)

if (sources.length === 0) {
  return { answer: 'No sources found for the question.', report: '', verifiedClaims: 0, sources: 0 }
}

// Phase Read -> Verify: pipeline per source (no barrier). Each source's claims are verified
// as soon as that source is read; source A can be in Verify while source B is still being read.
const perSource = await pipeline(
  sources,
  (src) =>
    agent(
      `Read this source for the question "${input.question}" and extract its concrete claims with evidence. Fetch the page. Source: ${src.title} — ${src.url}. Return raw data; drop low-quality/undated/circular sources by returning no claims.`,
      optsFor({ taskType: 'analyze', phase: 'Read', schema: CLAIMS_SCHEMA }, `read:${src.url}`),
    ).then((r) => ({ src, claims: (r && r.claims) || [] })),
  (read) =>
    parallel(
      read.claims.map((c) => async () => {
        // Width is mode-resolved (§M5): one skeptic per claim in balanced, three diverse lenses
        // in full. Sequential INSIDE the thunk: claims already run in parallel, so this bounds
        // concurrency (H6) without adding a barrier — no cross-claim dependency exists, so H2
        // is not engaged.
        const lenses = FACT_CHECK_LENSES.slice(0, WIDTH('verify'))
        const verdicts = []
        for (const lens of lenses) {
          const v = await agent(
            `Try to REFUTE this claim, don't confirm it. Check it against other independent sources and the primary source; look for contradiction or a recency problem. Default supported=false, confidence low, if you cannot stand it up.\nClaim: ${c.claim}\nStated evidence: ${c.evidence || '(none given)'}\nFrom: ${c.sourceUrl}\n\n${lens.prompt}`,
            optsFor({ taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA }, `verify:${lens.key}:${c.claim.slice(0, 40)}`),
          )
          if (v) verdicts.push({ ...v, lens: lens.key })
          else log(`fact-check lens ${lens.key} died on "${c.claim.slice(0, 60)}" — counted as an abstention, never as support (H5)`)
        }
        return { ...c, verdicts }
      }),
    ),
)

// EDIT ME: tune the confidence floor a claim must clear to be cited.
const CONFIDENCE_FLOOR = 0.7

// Majority refute kills a claim at ⌈N/2⌉ refutes — never a literal 2, which is silently wrong the
// moment width becomes 3 or 5 (execution-modes.md §M5). Confidence is the MINIMUM across the
// lenses that ran: one shaky corroboration must not hide behind two confident ones.
const checked = perSource.filter(Boolean).flat().filter(Boolean)
const survived = (c) => {
  if (!c.verdicts || c.verdicts.length === 0) return false
  const threshold = Math.ceil(c.verdicts.length / 2)
  const refutes = c.verdicts.filter((v) => !v.supported).length
  const confidence = Math.min(...c.verdicts.map((v) => (typeof v.confidence === 'number' ? v.confidence : 0)))
  return refutes < threshold && confidence >= CONFIDENCE_FLOOR
}
const verified = checked.filter(survived)
log(`verify [mode=${MODE}]: ${verified.length}/${checked.length} claims survived adversarial checking at ⌈N/2⌉ refutes, confidence ≥ ${CONFIDENCE_FLOOR}`)
// Log everything dropped, never truncate silently (harness policy H6).
for (const c of checked.filter((x) => !survived(x))) {
  log(`dropped claim "${c.claim.slice(0, 60)}" — verdicts: ${(c.verdicts || []).map((v) => `${v.lens}=${v.supported ? 'supported' : 'refuted'}@${v.confidence}`).join(', ') || 'none returned'}`)
}

if (verified.length === 0) {
  return { answer: 'No claims survived verification; the question needs better sources.', report: '', verifiedClaims: 0, sources: sources.length }
}

// Phase Synthesize: one agent writes the cited report from verified claims only.
const synthesis = await agent(
  `Write a cited report answering: ${input.question}\nUse ONLY these verified claims and cite each inline with its sourceUrl. Lead with a direct answer, then a section per sub-question. Surface any disagreement between sources. Do not add unsourced assertions.\nVerified claims (JSON): ${JSON.stringify(verified)}`,
  optsFor({ taskType: 'synthesize', phase: 'Synthesize', schema: REPORT_SCHEMA }, 'synthesize'),
)

return {
  answer: synthesis ? synthesis.answer : null,
  report: synthesis ? synthesis.report : null,
  openQuestions: synthesis ? synthesis.openQuestions || [] : [],
  verifiedClaims: verified.length,
  sources: sources.length,
}
