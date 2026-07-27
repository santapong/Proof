// Template: REFACTOR SWEEP — scan fan-out → dedup/prioritize barrier → apply-and-verify.
// A specialization of the workflow skill's parallel fan-out pattern with loop-pattern's
// catalogs pre-wired: references/refactoring-catalog.md (smell → move),
// references/design-patterns.md (problem shape → pattern), references/framework-idioms.md.
//
// The hard constraint this script exists to enforce is BEHAVIOR PRESERVATION (SKILL §4):
// every candidate is applied against a green test suite and re-checked against the SAME
// tests, unchanged. An agent that cannot get a green run before or after REVERTS and flags.
//
// Invoke with: Workflow({ script, args: { target: "...", testCommand: "...", mode: "optimize" } })
// input.target      — the package/module/repo to sweep. Used in every finder prompt.
// input.testCommand — how to run the target's existing tests (SKILL §2; conventions owned by loop-test).
// input.mode        — 'optimize' (default) or 'full'; parsed by loop-engine, passed through as a real JSON value.

export const meta = {
  name: 'refactor-sweep', // EDIT ME
  description: 'Scan modules for code smells and pattern/idiom opportunities, dedup by location, then apply and verify one named treatment per surviving candidate', // EDIT ME
  phases: [
    { title: 'Scan', detail: 'one finder per module, each carrying a different lens' },
    { title: 'Apply', detail: 'one agent per surviving candidate: tests → one named treatment → same tests' },
    { title: 'Verify', detail: 'independent lenses try to refute behavior preservation' },
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
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : (kind === 'gating' ? 3 : 1))
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}

// The block above is byte-identical to §M8 except for the one line §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage. `WIDTH` is kept — the verify
// sub-stage below resolves its lens count from it. Every line that IS here is verbatim; drift on
// any of them is a defect (see scripts/validate.mjs), and §M8 is the single source of truth.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: one finder per file/module of the target. Diversity beats redundancy (harness
// policy H4): each finder reads a DIFFERENT module through a DIFFERENT lens, which beats N
// finders re-reading the same file from N angles. Drop rows that cannot apply (no framework
// in play → drop the idiom lens) and log the trim rather than running an empty finder.
const FINDERS = [
  { key: 'smells-core', scope: 'the core/domain modules', lens: 'Code smells from references/refactoring-catalog.md §1: Long Function, Large Class, Duplicated Code, Primitive Obsession, Data Clumps, Feature Envy. Name the smell exactly as the catalog names it (2e names).' },
  { key: 'smells-boundaries', scope: 'the modules at the application/IO boundary', lens: 'Change-preventer and coupler smells: Divergent Change, Shotgun Surgery, Message Chains, Middle Man, Insider Trading. Diagnose Divergent Change vs Shotgun Surgery by the catalog §1 test (one module many reasons, vs one reason many modules).' },
  { key: 'patterns', scope: 'the modules with the heaviest conditional logic', lens: 'Problem shapes from references/design-patterns.md §2 — Repeated Switches on a type code, creation coupling, incompatible interfaces. Nominate a pattern ONLY when the shape is already present in the code; speculative abstraction is itself the §4 anti-pattern.' },
  { key: 'solid', scope: 'the class/constructor wiring across the target', lens: 'SOLID violations from references/solid-and-style.md §1 — chiefly Open/Closed (repeated conditionals) and Dependency Inversion (classes constructing their own collaborators). Cite the smell AND the principle.' },
  { key: 'idioms', scope: 'the framework-facing code (React / Django / Spring, whichever applies)', lens: 'Framework-idiom violations and "fighting the framework" from references/framework-idioms.md, checked against the version the project is actually on. Cite the documented rule, not a preference.' },
  // EDIT ME: add one row per additional module, or swap `scope` for concrete paths.
]

// Finders return raw candidates — their final text is a return value, not prose (H3).
const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          smellOrOpportunityTag: { type: 'string' }, // the NAMED smell / SOLID violation / framework rule — SKILL §1 gate
          location: { type: 'string' }, // file:line or file:symbol — the dedup key
          suggestedSingleTreatment: { type: 'string' }, // exactly ONE named catalog move, pattern, or idiom fix
          rationale: { type: 'string' }, // the concrete cost the smell imposes today
        },
        required: ['smellOrOpportunityTag', 'location', 'suggestedSingleTreatment', 'rationale'],
      },
    },
  },
  required: ['candidates'],
}

// What an apply agent reports back. 'reverted-flagged' is a SUCCESSFUL outcome of this script:
// leaving a red diff behind is the one thing worse than not refactoring.
const APPLY_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['applied', 'reverted-flagged', 'skipped'] },
    preTestsGreen: { type: 'boolean' }, // safety net BEFORE the edit (SKILL §2) — false ⇒ do not edit
    postTestsGreen: { type: 'boolean' }, // the SAME tests, unchanged, after the edit
    diffSummary: { type: 'string' }, // what changed, hunk by hunk, for the verify lenses
    behaviorNote: { type: 'string' }, // any behavior difference observed — SKILL §4 hands these to loop-debug
  },
  required: ['status', 'preTestsGreen', 'postTestsGreen', 'diffSummary', 'behaviorNote'],
}

// Adversarial verdict on behavior preservation: default to refuted when unproven (H4).
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    preserved: { type: 'boolean' }, // true only if behavior preservation was re-derived from the diff
    confidence: { type: 'number' }, // 0..1
    reason: { type: 'string' },
  },
  required: ['preserved', 'confidence', 'reason'],
}

// Three DECLARED lenses for the verify node. Mode picks how many of them run (§M5); it never
// invents new ones — needing more is a decomposition change, made here, deliberately.
const VERIFY_LENSES = [
  { key: 'equivalence', prompt: 'Read the diff as an equivalence proof. For every changed hunk, is the new code observably identical for ALL inputs, including empty, null, boundary, and error paths — not just the tested ones? Refute if you find any input where they differ.' },
  { key: 'test-adequacy', prompt: 'Attack the safety net rather than the diff. Do the tests that passed actually EXERCISE the changed lines? A green run over code the tests never reach proves nothing. Refute if the coverage cannot detect a behavior change in this diff.' },
  { key: 'scope-creep', prompt: 'Check the diff contains ONLY the single named treatment. A behavior fix, an unrelated cleanup, a signature change, or a second refactoring smuggled in makes this unreviewable — and an unrequested behavior change belongs to loop-debug, not here (SKILL §4). Refute if the diff does more than it claims.' },
]

// Stage 1 (Scan). No barrier WITHIN this stage: each finder reads its own module and nothing
// it does depends on another finder's output (H1/H2 — a per-item stage stays a pipeline stage).
log(`scan: ${FINDERS.length} finders over ${input.target} [mode=${MODE}]`)
const scans = await parallel(
  FINDERS.map((f) => () =>
    agent(
      `Refactoring scan target: ${input.target}\nModule scope: ${f.scope}\n\n` +
        `${f.lens}\n\n` +
        `RULE (SKILL §1 — no smell, no refactor): every candidate MUST cite a named smell, a named ` +
        `SOLID violation, or a documented framework rule, and MUST state the concrete cost it imposes ` +
        `today. "Could be cleaner" is not a candidate. Suggest exactly ONE treatment per candidate — ` +
        `a location needing three moves is three candidates or, better, one sequenced treatment.\n` +
        `Do NOT edit anything. Return raw data conforming to the schema.`,
      optsFor({ taskType: 'analyze', phase: 'Scan', schema: CANDIDATES_SCHEMA }, `scan:${f.key}`),
    ),
  ),
)

// .filter(Boolean): a skipped or dead finder resolves to null (harness policy H5).
const raw = scans.filter(Boolean).flatMap((s) => s.candidates || [])

// ─── BARRIER (harness policy H2) ────────────────────────────────────────────────────────────
// Earned under H2's clause "Dedup/merge across the full result set before expensive downstream
// work", plus its zero-count early-exit. The same class or region routinely gets nominated for
// two DIFFERENT treatments by two different lenses — Extract Class from the smells finder and
// Replace Conditional with Polymorphism from the patterns finder, on the same code — and the
// apply stage below is expensive and behavior-risking, so it must run once per LOCATION, not
// once per nomination. This is the same cross-item reduce that loop-review's
// security-review.workflow.js performs on vulnerability findings; this template specializes it
// to refactor targets. It is NOT "I need to flatten/filter first", which H2 explicitly refuses.
const key = (c) => String(c.location)
const merged = new Map()
for (const c of raw) {
  const k = key(c)
  const prior = merged.get(k)
  if (!prior) {
    merged.set(k, c)
  } else {
    // Two lenses want the same location. Keep the first treatment as the one to apply and
    // record the loser — never silently discard a nomination (H6).
    log(`merge @ ${k}: keeping "${prior.suggestedSingleTreatment}" [${prior.smellOrOpportunityTag}], deferring "${c.suggestedSingleTreatment}" [${c.smellOrOpportunityTag}] to a later sweep`)
  }
}
const deduped = [...merged.values()]
log(`${raw.length} raw candidates from ${FINDERS.length} finders → ${deduped.length} after location dedup`)

// Early-exit: the other legitimate use of the barrier (H2). Nothing to apply.
if (deduped.length === 0) {
  log('scan surfaced no candidate carrying a named smell — nothing to refactor')
  return { applied: [], flagged: [], note: 'no candidates: no reachable smell in the scanned modules (SKILL §1)' }
}

// Cap to a reviewable batch. The batch size is derived from the repo's ≤15-agents-per-workflow
// guideline, which §M6 DECIDES wins over full mode's appetite: each surviving candidate costs
// 1 apply agent + WIDTH('verify') verify agents, on top of the finders already spent. Full mode
// therefore narrows the batch rather than exceeding the guideline — the rest go to a second run.
const AGENT_GUIDELINE = 15
const perCandidate = 1 + WIDTH('verify')
const MAX_APPLY = Math.max(1, Math.floor((AGENT_GUIDELINE - FINDERS.length) / perCandidate))
const batch = deduped.slice(0, MAX_APPLY)
log(`batch: applying ${batch.length}/${deduped.length} candidates (cap ${MAX_APPLY} = (${AGENT_GUIDELINE} − ${FINDERS.length} finders) / (1 apply + ${WIDTH('verify')} verify))`)
for (const c of deduped.slice(MAX_APPLY)) {
  log(`deferred (over batch cap) ${c.smellOrOpportunityTag} @ ${c.location} → ${c.suggestedSingleTreatment}`) // no silent caps (H6)
}

// ─── Stage 3 (Apply + verify) ───────────────────────────────────────────────────────────────
// isolation: 'worktree' is justified under H7 ONLY here: these agents genuinely mutate files
// concurrently and would otherwise clobber each other. The scan and verify agents are read-only
// and carry no isolation.
//
// KNOWN LIMITATION — do not read this stage as promising conflict-free application. Even after
// the location dedup, two agents editing different-but-ADJACENT regions of the SAME file produce
// a messy merge. The mitigation here is to fan out over FILES and apply a file's candidates
// SERIALLY inside one thunk: parallel across files, sequential within a file. That removes the
// same-file collision but not the cross-file one — a Move Function that relocates a symbol still
// touches a file another agent owns. Review the combined diff before trusting it, and prefer a
// second sweep over widening this batch.
const byFile = new Map()
for (const c of batch) {
  const file = String(c.location).split(':')[0]
  if (!byFile.has(file)) byFile.set(file, [])
  byFile.get(file).push(c)
}
log(`apply: ${batch.length} candidates across ${byFile.size} files — parallel across files, serial within a file`)

const perFile = await parallel(
  [...byFile.entries()].map(([file, items]) => async () => {
    const out = []
    for (const c of items) {
      const applied = await agent(
        `Apply exactly ONE refactoring. Do not do anything else.\n\n` +
          `Target file: ${file}\nLocation: ${c.location}\n` +
          `Smell / violation: ${c.smellOrOpportunityTag}\n` +
          `Treatment: ${c.suggestedSingleTreatment}\n` +
          `Why it is warranted: ${c.rationale}\n\n` +
          `Procedure (SKILL §2 and §4, mechanics per references/refactoring-catalog.md §2):\n` +
          `1. Run the target's existing tests FIRST: \`${input.testCommand || 'the project test command'}\`. ` +
          `Report preTestsGreen. If they are RED before you edit, STOP: set status='skipped', change nothing, ` +
          `and say so — a red suite going in is a loop-debug job, not a refactoring job.\n` +
          `2. Apply the named treatment in SMALL STEPS, re-running the tests after each step.\n` +
          `3. Re-run the SAME tests, unchanged. Editing a test to make it pass means you changed behavior.\n` +
          `4. If you cannot get a green run after the edit, REVERT your changes fully and set ` +
          `status='reverted-flagged'. Never leave a red diff behind.\n` +
          `5. If you observe a behavior difference the user did not ask for, that is a BUG: revert, ` +
          `set status='reverted-flagged', and describe it in behaviorNote for loop-debug (SKILL §4).\n` +
          `Do NOT fix unrelated defects, do NOT reformat untouched code, do NOT apply a second treatment.`,
        Object.assign(optsFor({ taskType: 'implement', phase: 'Apply', schema: APPLY_SCHEMA }, `apply:${c.location}`), { isolation: 'worktree' }),
      )
      if (!applied) {
        log(`apply agent died on ${c.location} — no edit assumed, candidate dropped (H5)`)
        continue
      }
      if (applied.status !== 'applied') {
        log(`${applied.status} @ ${c.location} [${c.smellOrOpportunityTag}] — pre=${applied.preTestsGreen} post=${applied.postTestsGreen}: ${applied.behaviorNote}`)
        out.push({ candidate: c, result: applied, verdicts: [] })
        continue
      }
      // Behavior preservation is proven PER CANDIDATE, never assumed globally — and never by the
      // agent that made the edit (H4: verification is adversarial). The lenses read the reported
      // diff rather than the tree, because the edit lives in the apply agent's worktree.
      const lenses = VERIFY_LENSES.slice(0, WIDTH('verify'))
      const verdicts = []
      for (const lens of lenses) {
        // Sequential inside the thunk: files already run in parallel, so this bounds concurrency
        // (H6) without a barrier. No cross-candidate dependency exists, so H2 is not engaged.
        const v = await agent(
          `You are a skeptical reviewer trying to REFUTE the claim that this refactoring preserved ` +
            `behavior. Do not trust the agent that made the edit.\n\n` +
            `Location: ${c.location}\nTreatment claimed: ${c.suggestedSingleTreatment}\n` +
            `Smell: ${c.smellOrOpportunityTag}\nTests reported: pre=${applied.preTestsGreen} post=${applied.postTestsGreen}\n` +
            `Diff as reported:\n${applied.diffSummary}\n\n` +
            `${lens.prompt}\n\n` +
            `Set preserved=true ONLY if you can re-derive behavior preservation yourself. If you are ` +
            `unsure, set preserved=false. Report confidence in preserved as 0..1.`,
          optsFor({ taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA }, `verify:${lens.key}:${c.location}`),
        )
        if (v) verdicts.push(v)
        else log(`verify lens ${lens.key} died on ${c.location} — counted as no vote (H5)`)
      }
      out.push({ candidate: c, result: applied, verdicts })
    }
    return out
  }),
)

// .filter(Boolean) before use: a dead file-thunk resolves to null (H5).
const results = perFile.filter(Boolean).flat()

// Majority refute kills the result at ⌈N/2⌉ refutes — never a literal 2, which is silently
// wrong the moment width becomes 3 or 5 (§M5).
const kept = []
const flagged = []
for (const r of results) {
  if (r.result.status !== 'applied') {
    flagged.push({ location: r.candidate.location, status: r.result.status, note: r.result.behaviorNote })
    continue
  }
  const refutes = r.verdicts.filter((v) => !v.preserved).length
  const threshold = Math.ceil(Math.max(r.verdicts.length, 1) / 2)
  if (r.verdicts.length === 0 || refutes >= threshold) {
    const why = r.verdicts.length === 0 ? 'no verify lens returned a vote' : r.verdicts.filter((v) => !v.preserved).map((v) => v.reason).join(' | ')
    log(`REFUTED @ ${r.candidate.location} (${refutes}/${r.verdicts.length} refutes ≥ ${threshold}): ${why} — revert this hunk before merging`)
    flagged.push({ location: r.candidate.location, status: 'refuted', note: why })
  } else {
    log(`kept @ ${r.candidate.location} [${r.candidate.smellOrOpportunityTag}] → ${r.candidate.suggestedSingleTreatment} (${refutes}/${r.verdicts.length} refutes)`)
    kept.push({ location: r.candidate.location, smell: r.candidate.smellOrOpportunityTag, treatment: r.candidate.suggestedSingleTreatment, diffSummary: r.result.diffSummary })
  }
}

log(`refactor sweep [mode=${MODE}]: ${kept.length} kept, ${flagged.length} flagged, ${deduped.length - batch.length} deferred over the batch cap`)

return { applied: kept, flagged, deferred: deduped.slice(MAX_APPLY).map((c) => ({ location: c.location, treatment: c.suggestedSingleTreatment })) }
