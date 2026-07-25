// Template: RELEASE READINESS GATE — checker-per-gate-dimension → barrier → adversarial verify → decision.
// The go/no-go procedure from SKILL §3 and references/release-gates.md §1, run as a workflow when the
// release is too wide to check inline: a multi-service release, a migration-carrying release, or one
// loop-audit rated high risk.
//
// Invoke with: Workflow({ script, args: { release: "...", artifactDigest: "...", gateAt: "2026-07-25T09:00:00Z" } })
// input.release        — what is shipping (a version, a PR range, a release branch). Used in every checker prompt.
// input.artifactDigest — the ONE artifact under evaluation. The supply-chain gate is digest-scoped by construction.
// input.strategy       — the rollout strategy already chosen per release-gates.md §2 (rolling|blue-green|canary|recreate).
// input.gateAt         — ISO timestamp of this gate run, supplied by the caller. H10 forbids reading a clock.
// input.auditRating    — loop-audit's risk rating for this change set, if one exists. Consumed, never re-derived.

export const meta = {
  name: 'release-readiness-gate', // EDIT ME
  description: 'Check every release-gate dimension in parallel, merge into one release picture, adversarially re-derive thin-evidence passes, then render go / no-go / go-with-conditions', // EDIT ME
  phases: [
    { title: 'Check', detail: 'one checker per gate dimension, each returning a verdict with evidence strength' },
    { title: 'Verify', detail: 'adversarial re-derivation of gates that passed on asserted rather than demonstrated evidence' },
    { title: 'Decide', detail: 'synthesize go / no-go / go-with-conditions and name the blocking gate' },
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

// The six gate dimensions from release-gates.md §1. `blocking: true` means a fail here vetoes the
// release outright regardless of the other five — that veto is what makes the barrier below earned.
// EDIT ME: drop a dimension that cannot apply (no schema change → drop `migration`) and log the trim
// rather than running an empty checker; add house dimensions (compliance sign-off, capacity review).
const GATES = [
  {
    key: 'ci',
    blocking: true,
    prompt: 'CI / test status. Did the FULL suite pass on this exact artifact digest, not on a rebuild of the same commit? Evidence is a CI run id bound to the digest; a green branch badge is not evidence. Report the run id you found, or state that none binds to this digest.',
  },
  {
    key: 'migration',
    blocking: true,
    prompt: 'Migration expand-step state. Either this release carries no schema change, or the expand step is ALREADY DEPLOYED in an earlier release and the sequencing holds. If this release carries a CONTRACT step, it additionally needs telemetry showing zero reads of the old shape across a full business cycle, and no rollback target inside the retention window that would reintroduce a reader. A code search showing no references is supporting evidence only, never sufficient.',
  },
  {
    key: 'flags',
    blocking: true,
    prompt: 'Feature-flag wiring. Do the flags this change depends on exist in every environment, default to the SAFE value, and have flip, ramp and kill each been exercised against this build? Evidence is a recorded toggle of each lever, not a screenshot of the flag console. Name any lever that has not been exercised.',
  },
  {
    key: 'rollback',
    blocking: true,
    prompt: 'Rollback-path evidence. Has the revert mechanism for the chosen rollout strategy been exercised, with a DATE and a MEASURED elapsed time, within the last 90 days and at production scale? Does the expand-contract stage still permit a rollback at all? An untested rollback is a FAILED gate, not a passed one — do not accept a claim that a rollback would work.',
  },
  {
    key: 'supply-chain',
    blocking: true,
    prompt: 'Supply-chain attestation on THIS artifact digest. (1) Is a SLSA provenance attestation present, carried in an in-toto envelope, with its subject digest matching the artifact byte for byte, from the expected builder identity, at or above the declared build-level floor? (2) Does an SBOM exist for this digest, and does its diff against the previous release introduce any component with a known advisory at or above the blocking severity? (3) Does the signature verify against an allow-listed identity with a transparency-log inclusion proof? Report each of the three separately.',
  },
  {
    key: 'slo-headroom',
    blocking: false,
    prompt: 'SLO / error-budget headroom. Is there enough unspent error budget on the affected paths to absorb a bad rung? A service already burning its budget has no room to run an experiment on users. This dimension does not hard-fail, but an exhausted budget caps the verdict at go-with-conditions and requires a named accepter.',
  },
]

// Checker verdict. `evidenceStrength` is the field the Verify stage keys off: a pass backed only by
// an assertion is exactly the pass most likely to be wrong, and the one worth spending agents on.
const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' }, // does this dimension clear its bar as specified
    evidence: { type: 'string' }, // the concrete artifact/record/telemetry relied on, or what is missing
    evidenceStrength: { type: 'string', enum: ['artifact', 'observed', 'asserted', 'absent'] },
    detail: { type: 'string' }, // what was checked and what was found
    condition: { type: 'string' }, // a condition that would make a marginal pass safe, or "" if none
  },
  required: ['pass', 'evidence', 'evidenceStrength', 'detail', 'condition'],
}

// Adversarial re-derivation. Same H4 posture as security-review.workflow.js's refute stage: the
// skeptic must PROVE the gate holds, and defaults to holds=false whenever it cannot.
const REFUTE_SCHEMA = {
  type: 'object',
  properties: {
    holds: { type: 'boolean' }, // true ONLY if the skeptic independently re-derived concrete evidence
    reason: { type: 'string' }, // what was proven, or why the claimed evidence does not support the pass
  },
  required: ['holds', 'reason'],
}

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['go', 'no-go', 'go-with-conditions'] },
    blockingGates: { type: 'array', items: { type: 'string' } }, // gate keys that blocked, [] on a clean go
    conditions: { type: 'array', items: { type: 'string' } }, // what must hold for a go-with-conditions
    changeFailureRisk: { type: 'string' }, // the DORA note: would shipping anyway count as a change failure
    rationale: { type: 'string' },
  },
  required: ['verdict', 'blockingGates', 'conditions', 'changeFailureRisk', 'rationale'],
}

const CONTEXT =
  `Release: ${input.release}\n` +
  `Artifact digest: ${input.artifactDigest || 'NOT SUPPLIED — treat the supply-chain dimension as absent'}\n` +
  `Rollout strategy: ${input.strategy || 'not yet chosen'}\n` +
  `loop-audit risk rating: ${input.auditRating || 'none supplied'}\n` +
  `Gate run at: ${input.gateAt || 'timestamp not supplied by caller'}\n`

// BARRIER (harness policy H2): the go/no-go verdict is a genuine AND across independently-checked
// dimensions — a single hard-fail from any one lens (no rollback evidence) vetoes the release
// regardless of how clean the other five look, so the Decide node needs every checker's result at
// once before it can render a verdict. The barrier also buys the early exit: an unambiguous hard-fail
// (tests red) short-circuits straight to no-go and skips spending agents in Verify re-deriving
// borderline gates that no longer matter.
const raw = await parallel(
  GATES.map((g) => () =>
    agent(
      `${CONTEXT}\nYou are checking ONE dimension of a release-readiness gate. Do not evaluate the ` +
        `other dimensions and do not soften a verdict because the release looks fine overall.\n\n` +
        `${g.prompt}\n\n` +
        `A dimension you cannot evaluate is a FAIL, not a skip. Set evidenceStrength to 'artifact' ` +
        `when you read a concrete durable record, 'observed' when you saw the system's own telemetry, ` +
        `'asserted' when a human or a doc merely claims it, and 'absent' when there is nothing at all. ` +
        `Return raw data conforming to the schema.`,
      optsFor({ taskType: 'analyze', phase: 'Check', schema: CHECK_SCHEMA }, `check:${g.key}`),
    ).then((v) => ({ ...g, verdict: v })),
  ),
)

// .filter(Boolean): a dead checker resolves to null (harness policy H5). A dimension whose checker
// died is NOT a pass — it is recorded as a missing dimension so the decision can treat it as a fail.
const checked = raw.filter(Boolean)
const missing = GATES.filter((g) => !checked.some((c) => c.key === g.key)).map((g) => g.key)
if (missing.length > 0) {
  log(`checker did not return for: ${missing.join(', ')} — treated as unevaluated, which is a fail`) // never a silent drop (H6)
}

const failed = checked.filter((c) => !c.verdict.pass)
const hardFails = failed.filter((c) => c.blocking).map((c) => c.key)
log(
  `mode=${MODE} · ${checked.length}/${GATES.length} dimensions checked · ` +
    `${checked.length - failed.length} pass · hard fails: ${hardFails.length > 0 ? hardFails.join(', ') : 'none'}`,
)

// Thin-evidence passes are the only gates worth re-deriving: a pass resting on someone's assertion.
// A fail needs no adversary (it already blocks) and an artifact-backed pass has nothing to refute.
const thin = checked.filter((c) => c.verdict.pass && c.verdict.evidenceStrength === 'asserted')

let refuted = []
if (hardFails.length > 0 || missing.length > 0) {
  // Early exit (the barrier's second legitimate use, H2): the release is already blocked, so spending
  // agents on borderline gates cannot change the verdict.
  for (const c of thin) {
    log(`skipped verify:${c.key} — release already blocked by ${[...hardFails, ...missing].join(', ')}`)
  }
} else if (thin.length === 0) {
  log('no thin-evidence passes to re-derive — every passing dimension was backed by an artifact or telemetry')
} else {
  const lenses = WIDTH('verify')
  log(`re-deriving ${thin.length} thin-evidence pass(es) at width ${lenses} (mode=${MODE})`)
  // Fan out lenses × candidates. Diversity comes from the lens index, not from a random seed (H10).
  const jobs = []
  for (const c of thin) {
    for (let i = 0; i < lenses; i++) {
      jobs.push(() =>
        agent(
          `${CONTEXT}\nYou are a skeptic trying to REFUTE a release gate that was marked PASS on ` +
            `asserted — not demonstrated — evidence.\n\n` +
            `Gate: ${c.key}\nClaimed evidence: ${c.verdict.evidence}\nChecker's detail: ${c.verdict.detail}\n\n` +
            `Lens ${i + 1} of ${lenses}: ${['re-derive the evidence from the system itself and ignore what the checker reported', 'assume the claimed evidence is stale or describes a different artifact, and look for the version or date that proves it', 'assume the check was run against the wrong scope — a different environment, branch, or digest — and look for the mismatch'][i % 3]}.\n\n` +
            `Set holds=true ONLY if you can independently point at concrete evidence that this gate ` +
            `genuinely clears its bar. If the evidence is a claim, is undated, cannot be located, or ` +
            `you are unsure — set holds=false. Unproven means it does not hold.`,
          optsFor({ taskType: 'critic', phase: 'Verify', schema: REFUTE_SCHEMA }, `refute:${c.key}#${i + 1}`),
        ).then((v) => ({ key: c.key, lens: i + 1, verdict: v })),
      )
    }
  }
  const votes = (await parallel(jobs)).filter(Boolean)
  // Majority refute kills the pass at ceil(N/2) refutes — 1 of 1, 2 of 3, 3 of 5 (execution-modes §M5).
  const kill = Math.ceil(lenses / 2)
  for (const c of thin) {
    const mine = votes.filter((v) => v.key === c.key)
    const against = mine.filter((v) => !v.verdict.holds)
    if (mine.length === 0) {
      log(`refute:${c.key} — no lens returned; the thin pass stands unverified and is reported as such`)
      refuted.push({ key: c.key, refutes: 0, of: 0, reasons: ['no verifier returned'] })
    } else if (against.length >= kill) {
      log(`refuted ${c.key}: ${against.length}/${mine.length} lenses could not re-derive the evidence`)
      refuted.push({ key: c.key, refutes: against.length, of: mine.length, reasons: against.map((v) => v.verdict.reason) })
    } else {
      log(`upheld ${c.key}: ${mine.length - against.length}/${mine.length} lenses re-derived the evidence`)
    }
  }
}

// The refuted set demotes its gates to fails before the decision sees them.
const refutedKeys = refuted.map((r) => r.key)
const effectiveFails = [
  ...failed.map((c) => ({ key: c.key, blocking: c.blocking, why: c.verdict.evidence })),
  ...missing.map((k) => ({ key: k, blocking: true, why: 'dimension was never evaluated' })),
  ...refuted.map((r) => ({
    key: r.key,
    blocking: (GATES.find((g) => g.key === r.key) || {}).blocking === true,
    why: `passed on asserted evidence, refuted ${r.refutes}/${r.of}: ${r.reasons.join(' | ')}`,
  })),
]

const decision = await agent(
  `${CONTEXT}\nRender the go/no-go call for this release.\n\n` +
    `Dimension results:\n` +
    checked
      .map((c) => `- ${c.key} [${c.blocking ? 'blocking' : 'advisory'}]: ${c.verdict.pass ? 'PASS' : 'FAIL'} ` +
        `(evidence: ${c.verdict.evidenceStrength}) — ${c.verdict.detail}` +
        (c.verdict.condition ? ` | condition offered: ${c.verdict.condition}` : '') +
        (refutedKeys.indexOf(c.key) >= 0 ? ' | DEMOTED: refuted on re-derivation' : ''))
      .join('\n') +
    (missing.length > 0 ? `\n- UNEVALUATED (treat as fail): ${missing.join(', ')}` : '') +
    `\n\nRules you must apply, not re-litigate:\n` +
    `1. The verdict is an AND. Any blocking dimension that failed — including one demoted by the ` +
    `verify stage or never evaluated — makes this a no-go, no matter how clean the others are.\n` +
    `2. 'go-with-conditions' is only available when every blocking dimension passed and the ` +
    `outstanding issue is advisory, with a stated condition and a named accepter.\n` +
    `3. Name every blocking gate in blockingGates. A no-go with an empty blockingGates is invalid.\n` +
    `4. For changeFailureRisk, state plainly whether shipping anyway would be likely to produce a ` +
    `change failure in the DORA sense — a deployment reaching production that then needs remediation ` +
    `— and which dimension drives that judgment. A release stopped here never counts as a change ` +
    `failure; one that ships and is then reverted does.`,
  optsFor({ taskType: 'gating', phase: 'Decide', schema: DECISION_SCHEMA }, 'decide:go-no-go'),
)

if (!decision) {
  // The decision node is the only unreplicated agent in the run; a dead one is a no-verdict, and a
  // missing verdict must never read as a go.
  log('decision node returned nothing — defaulting to no-go, which is the safe direction')
  return {
    gateAt: input.gateAt || null,
    artifactDigest: input.artifactDigest || null,
    verdict: 'no-go',
    blockingGates: effectiveFails.filter((f) => f.blocking).map((f) => f.key),
    dimensions: checked.map((c) => ({ key: c.key, pass: c.verdict.pass, evidenceStrength: c.verdict.evidenceStrength })),
    note: 'no synthesized decision was produced',
  }
}

log(`verdict=${decision.verdict}${decision.blockingGates.length > 0 ? ` blocked by: ${decision.blockingGates.join(', ')}` : ''}`)

// The returned record is what release-gates.md §5 sign-off records and what dora.md joins its
// per-release fields to. Timestamps come from args — this script never reads a clock (H10).
return {
  gateAt: input.gateAt || null,
  release: input.release,
  artifactDigest: input.artifactDigest || null,
  strategy: input.strategy || null,
  mode: MODE,
  verdict: decision.verdict,
  blockingGates: decision.blockingGates,
  conditions: decision.conditions,
  changeFailureRisk: decision.changeFailureRisk,
  rationale: decision.rationale,
  dimensions: checked.map((c) => ({
    key: c.key,
    blocking: c.blocking,
    pass: c.verdict.pass,
    evidenceStrength: c.verdict.evidenceStrength,
    evidence: c.verdict.evidence,
    demoted: refutedKeys.indexOf(c.key) >= 0,
  })),
  unevaluated: missing,
  refuted,
}
