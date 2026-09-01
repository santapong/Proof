// Template: EXPERIMENT STUDY — arms pipeline through prepare → execute → re-derive, then an
// earned barrier for cross-arm synthesis, then an adversarial review against the raw artifacts.
// loop-experiment's references pre-wired: references/hypothesis.md (the falsifiable claim and the
// oracle that can fail), references/harness.md (independent ground truth, pinning, capture),
// references/evidence-gate.md (re-derivation, mutation, the confound sweep),
// references/reporting.md (traceable claims, null results), references/review.md (attack it).
//
// The rule this script exists to enforce (SKILL §5), and the reason every schema below carries a
// provenance field: a number is reported ONLY if a step that did not produce it re-derived it from
// the raw artifacts. `reDerived` is a required boolean, not an optional flourish — a figure that
// cannot be traced to a file is struck, never softened. The framework this vocabulary was ported
// from reviews the rendered PDF and never returns to the logs; that is the defect being designed out.
//
// Invoke with: Workflow({ script, args: { hypothesis: "...", arms: "...", artifactDir: "...", mode: "balanced" } })
// input.hypothesis  — the falsifiable claim under test (see references/hypothesis.md).
// input.arms        — free text describing the conditions being compared; EDIT the ARMS table below.
// input.artifactDir — durable path holding truth/ and runs/. When absent, agents must report
//                     reDerived=false everywhere rather than inventing a provenance.
// input.mode        — 'lite' | 'balanced' (default) | 'all-out'; parsed by loop-engine.

export const meta = {
  name: 'experiment-study', // EDIT ME
  description: 'Run each experimental arm through prepare, execute and re-derive, merge at an earned barrier for the cross-arm comparison, then attack the result against its raw artifacts', // EDIT ME
  phases: [
    { title: 'Execute', detail: 'per arm: pin the environment, capture ground truth by a path independent of the run, then execute and capture raw artifacts' },
    { title: 'Re-derive', detail: 'recompute every reported figure from the artifacts, by a step that did not produce them' },
    { title: 'Synthesize', detail: 'the cross-arm comparison and the confound sweep — the barrier earns itself here' },
    { title: 'Review', detail: 'adversarial read of report against raw artifacts; find the contradicting reading' },
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

// The block above is byte-identical to §M8 except for the one line §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage. `WIDTH` is kept — the review
// stage resolves its reviewer count from it. `PLANNER` and its `optsFor()` line stay: they are
// invariant core and simply inert here, since no node carries taskType 'planner'.

// Whether raw artifacts actually exist for this run. This single flag is what stops the script
// producing evidence theater: with no artifact directory, every agent is told to return
// reDerived=false and to describe the check it WOULD run, rather than asserting a provenance it
// never read (SKILL §5 check 1).
const ARTIFACT_DIR = (input && input.artifactDir) || ''
const HAS_ARTIFACTS = ARTIFACT_DIR !== ''

// EDIT ME: one row per experimental condition. Exactly one thing may differ between arms — if the
// arms also differ in workload, ordering or warm-up state, the study measures the mixture
// (references/hypothesis.md §Scoping the arms). Two arms is the minimum for a comparison.
const ARMS = [
  { key: 'baseline', angle: 'The control condition, with the mechanism under test absent or disabled. Capture ground truth for this arm by a path INDEPENDENT of the run being graded — a plain script, a direct query — so the graded run matches something it had no hand in producing.' },
  { key: 'treatment', angle: 'The condition with the mechanism under test active. Everything else — workload, fixtures, seeds, hardware — identical to baseline. Record which arm ran second and therefore inherited warm caches; that bias favours it and must be reported.' },
  // EDIT ME: add further arms only when each is a genuinely different condition. A third arm that
  // varies two things at once is not an arm, it is a second experiment sharing a directory.
]

// Per-arm result. `reDerived` and `sourceFile` are REQUIRED: they are the schema-level enforcement
// of SKILL §5 check 1 — a figure with no file behind it cannot be reported.
const ARM_SCHEMA = {
  type: 'object',
  properties: {
    arm: { type: 'string' },
    executed: { type: 'boolean' }, // false ⇒ the run did not actually happen; everything below is void
    executionEvidence: { type: 'string' }, // a FRESHLY GENERATED value proving work occurred — a wall-clock
    // duration or timestamp from this run. A documented constant proves nothing: it may have been recited.
    figures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, // what was measured
          value: { type: 'string' }, // as observed, with units
          n: { type: 'integer' }, // runs behind this figure — sits beside the number, never in a footnote
          reDerived: { type: 'boolean' }, // true ONLY if recomputed from raw artifacts by this step
          sourceFile: { type: 'string' }, // the artifact it came from, or "none" when reDerived=false
        },
        required: ['name', 'value', 'n', 'reDerived', 'sourceFile'],
      },
    },
    anomalies: { type: 'string' }, // retries, partial failures, manual intervention — the ugly parts
  },
  required: ['arm', 'executed', 'executionEvidence', 'figures', 'anomalies'],
}

// Cross-arm synthesis. This is the barrier's justification: `comparison` and `confounds` cannot be
// computed per-arm — they exist only by reading the whole set against itself (H2).
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    refutationCondition: { type: 'string' }, // quoted VERBATIM from the pre-registration, never paraphrased
    refuted: { type: 'boolean' }, // did the pre-registered condition trigger?
    comparison: { type: 'string' }, // the cross-arm result, with n stated
    shapeDivergence: { type: 'string' }, // did the arms do DIFFERENT amounts of work? then totals are not comparable
    confoundsRuledOut: { type: 'array', items: { type: 'string' } }, // each with the evidence that ruled it out
    confoundsLive: { type: 'array', items: { type: 'string' } }, // each with its direction of bias and cost to resolve
    struckFigures: { type: 'array', items: { type: 'string' } }, // reported nowhere: failed re-derivation (H12)
    verdict: { type: 'string', enum: ['refuted', 'not-refuted', 'inconclusive'] }, // inconclusive is a real outcome
  },
  required: ['refutationCondition', 'refuted', 'comparison', 'shapeDivergence', 'confoundsRuledOut', 'confoundsLive', 'struckFigures', 'verdict'],
}

// Adversarial review, defaulting to NOT upheld (H4). The reviewer reads runs/ and truth/, never the
// report alone — a reviewer without artifact access is doing copy-editing (references/review.md).
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    unsupportedFigures: { type: 'array', items: { type: 'string' } }, // numbers with no artifact backing, named
    alternativeReading: { type: 'string' }, // the interpretation contradicting the conclusion, or why none exists
    missedConfound: { type: 'string' }, // specific to THIS design, not from the catalogue; or "none found"
    scopeExceedsSample: { type: 'boolean' }, // does the prose imply more than n supports?
    overReading: { type: 'string' }, // what a reader will wrongly take from this
    upheld: { type: 'boolean' }, // false when any figure is unsupported or the scope exceeds the sample
    confidence: { type: 'number' }, // 0..1
  },
  required: ['unsupportedFigures', 'alternativeReading', 'missedConfound', 'scopeExceedsSample', 'overReading', 'upheld', 'confidence'],
}

// The provenance clause, pasted into every prompt that could otherwise assert a number it never read.
const PROVENANCE = HAS_ARTIFACTS
  ? `Raw artifacts ARE available under ${ARTIFACT_DIR}. Set reDerived=true ONLY for figures you recomputed ` +
    `from a file you actually opened, and name that file in sourceFile. Read the artifacts — do NOT report ` +
    `a value from memory, from project documentation, or from anything already in your context.`
  : `NO artifact directory was supplied. Set reDerived=false and sourceFile="none" on EVERY figure. ` +
    `Do NOT report a number as observed. Describe the check that WOULD settle it instead. A recited ` +
    `figure is worse than a missing one: it is indistinguishable from a measurement ` +
    `(references/evidence-gate.md §The recitation failure).`

// ─── Stages 1-3 (Prepare → Execute → Re-derive) ─────────────────────────────────────────────
// A pipeline, NOT a barrier: each arm flows through all three stages independently, so arm B can be
// executing while arm A is already re-deriving (H1). Nothing here needs another arm's output.
log(`study: ${ARMS.length} arms for "${input.hypothesis}" [mode=${MODE}, artifacts=${HAS_ARTIFACTS ? ARTIFACT_DIR : 'none'}]`)
const armResults = await pipeline(
  ARMS,
  (arm) =>
    agent(
      `Prepare and execute the "${arm.key}" arm of this study.\n\n` +
        `HYPOTHESIS: ${input.hypothesis}\n` +
        `THIS ARM: ${arm.angle}\n` +
        `ARMS OVERALL: ${input.arms || '(see the ARMS table in the script)'}\n\n` +
        `Pin versions, seeds, data digests and environment to a manifest. Capture ground truth by a path ` +
        `independent of the run being graded. Capture RAW artifacts — full stdout and stderr per step, exit ` +
        `codes separately, timings — to files, not summaries. Record retries, partial failures and any manual ` +
        `intervention in anomalies; an undisclosed re-run is not reproducible.\n\n` +
        `Set executed=false if the run did not actually happen. executionEvidence must be a value generated ` +
        `FRESHLY by this run.\n\n${PROVENANCE}`,
      optsFor({ taskType: 'implement', phase: 'Execute', schema: ARM_SCHEMA }, `execute:${arm.key}`),
    ),
  (armResult) =>
    agent(
      `Re-derive every figure in this arm's result from the raw artifacts. You did NOT produce these ` +
        `numbers; your job is to check them against the files.\n\n` +
        `ARM RESULT: ${JSON.stringify(armResult)}\n\n` +
        `For each figure: open the artifact, recompute the value, and set reDerived accordingly. A figure you ` +
        `cannot trace to a file gets reDerived=false and sourceFile="none" — it will be STRUCK from the report, ` +
        `not softened with a hedge. Also verify the arm actually executed: check executionEvidence is a value ` +
        `this run generated, and treat a suspiciously short duration or a value that appears in project ` +
        `documentation as evidence of recitation rather than execution.\n\n${PROVENANCE}`,
      optsFor({ taskType: 'verify', phase: 'Re-derive', schema: ARM_SCHEMA }, `rederive:${armResult.arm}`),
    ),
)

// ─── Stage 4 (Synthesize) ───────────────────────────────────────────────────────────────────
// BARRIER EARNED (H2): the cross-arm comparison and the shape-divergence check are genuine
// cross-item reduces — neither can be computed inside a per-arm stage, because each is a statement
// ABOUT the set. This is not a flatten/map convenience; it is the comparison the study exists for.
log(`synthesize: ${armResults.length} re-derived arms → cross-arm comparison and confound sweep`)
const synthesis = await agent(
  `Compare these arms and sweep for confounds.\n\n` +
    `HYPOTHESIS: ${input.hypothesis}\n` +
    `RE-DERIVED ARMS: ${JSON.stringify(armResults)}\n\n` +
    `Quote the pre-registered refutation condition VERBATIM and state whether it was met — paraphrasing is ` +
    `how a null result becomes a partial success. Report the null plainly if that is what happened.\n\n` +
    `Check shape divergence FIRST: if the arms did different amounts of work, their totals are not comparable ` +
    `and the comparison must say so. Then sweep the confound catalogue — ordering and warm-up, sample size, ` +
    `vendor self-report, selection, shared state — and put each into confoundsRuledOut (with the evidence) or ` +
    `confoundsLive (with its direction of bias and what would resolve it). Whatever ran second inherited warm ` +
    `caches; that bias favours it.\n\n` +
    `Every figure with reDerived=false goes into struckFigures and appears NOWHERE else. If the effect sits ` +
    `inside run-to-run variance, the verdict is "inconclusive" — not a percentage with a caveat.`,
  optsFor({ taskType: 'synthesize', phase: 'Synthesize', schema: SYNTHESIS_SCHEMA }, 'synthesize:cross-arm'),
)

// ─── Stage 5 (Review) ───────────────────────────────────────────────────────────────────────
// Perspective-diverse, not redundant (H4): each reviewer attacks a different surface. Width comes
// from WIDTH so the dial the user set actually changes the cost of this stage.
const REVIEW_ANGLES = [
  'Attack the MEASUREMENT: find a figure the artifacts do not support. Name the file you opened. Check whether ground truth was captured independently of the graded run, or whether the study is circular.',
  'Attack the STATISTICS: check n against the confidence the prose implies, and whether the effect sits inside run-to-run spread. A point estimate inside the noise should have been "inconclusive".',
  'Attack the CAUSAL STORY: find the reading of this data that supports the opposite conclusion, and name a confound specific to this design that the sweep missed.',
]
const reviewers = REVIEW_ANGLES.slice(0, Math.max(1, WIDTH('verify')))
log(`review: ${reviewers.length} adversarial reviewers against raw artifacts`)
const reviews = await parallel(
  reviewers.map((angle) => () =>
    agent(
      `Attack this study. You are judged on whether you FOUND a problem, not on whether you approved.\n\n` +
        `YOUR ANGLE: ${angle}\n\n` +
        `SYNTHESIS: ${JSON.stringify(synthesis)}\n` +
        `ARMS: ${JSON.stringify(armResults)}\n\n` +
        `Read the RAW ARTIFACTS alongside the report — never the report alone. It is internally consistent by ` +
        `construction, so consistency proves nothing. Set upheld=false if any figure is unsupported or the ` +
        `conclusion's scope exceeds the sample.\n\n${PROVENANCE}`,
      optsFor({ taskType: 'critic', phase: 'Review', schema: REVIEW_SCHEMA }, 'review'),
    ),
  ),
)

// A finding dies only on a majority of refutations — never a literal 2, which is silently wrong the
// moment width becomes 5 (references/review.md §Diversity beats redundancy).
const upheld = reviews.filter((r) => r && r.upheld).length
const held = upheld >= Math.ceil(reviews.length / 2)

return {
  hypothesis: input.hypothesis,
  verdict: synthesis.verdict,
  refuted: synthesis.refuted,
  reviewOutcome: held ? 'holds with stated limits' : 'does not hold',
  synthesis,
  arms: armResults,
  reviews,
  // Surfaced deliberately: these are the two lists a reader skips and a reviewer needs.
  struckFigures: synthesis.struckFigures,
  liveConfounds: synthesis.confoundsLive,
}
