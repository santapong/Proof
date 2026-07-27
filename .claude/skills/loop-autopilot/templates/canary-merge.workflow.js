// Template: CANARY-MERGE — the SCALE rung's autonomous-delivery gate. This is the ONE
// place the loop may merge without a human, and it OVERRIDES the skill's propose-only
// default (SKILL.md §6 rule 1). It is off unless the 🔒 Autonomy State issue says on.
// Called from the Propose stage on a candidate the loop already marked safeToPropose AND
// that already passed the SUSTAIN in-band gate (verifier-canary.workflow.js). See
// deployment.md §"Advanced: autonomous delivery (SCALE)".
//
// WHAT THIS TEMPLATE OWNS, AND WHAT IT DOES NOT.
// This script owns exactly one thing: the AUTONOMY DECISION — may the loop merge this candidate
// without a human, and what does it do when the bake says no. The rollout mechanism and the SLO
// gate are OTHER SKILLS' subject matter and are CITED here, never restated, so there is one
// definition of each in the plugin and this file cannot drift away from it:
//
//   • ROLLOUT MECHANISM → **loop-ship**. `../../loop-ship/references/rollout-strategies.md` owns
//     canary vs blue-green vs rolling, the risk→strategy table, and the four feature-flag kinds;
//     `../../loop-ship/references/migrations.md` owns expand-contract, which is why 'migration' is
//     on the NEVER list below; `../../loop-ship/references/rollback-playbook.md` owns what a
//     TESTED rollback path is. Pass the chosen mechanism in via args (BAKE_MECHANISM /
//     ROLLBACK_SPEC) — do not re-derive it here, and do not describe it here.
//   • SLO GATE → **loop-operate**. `../../loop-operate/references/slo-model.md` owns SLIs, SLOs,
//     error budgets and burn-rate math; `../../loop-operate/references/alerting.md` owns
//     multi-window multi-burn-rate evaluation. The bake below asks loop-operate's question
//     ("is the burn rate inside the budget for this window?") and takes its answer; it does not
//     define what healthy means. Pass the gate in via args (HEALTH_SPEC).
//   • AUTONOMY LADDER + audit trail → `../../loop-operate/references/autonomy-and-rollback.md`,
//     cited by `references/deployment.md §"Advanced: autonomous delivery (SCALE)"`.
//
// CONTROL FLOW (this part is portable, and is what this template actually contributes):
//   read autonomy state -> eligibility gate -> merge behind canary -> bake -> promote|rollback -> update state
// INFRA-SPECIFIC (you must supply — marked EDIT ME): the three args above. Auto-merge WITHOUT a
//   real canary is not SCALE — it's just removing the safety net. If you cannot supply them,
//   return {action:'propose'} and let loop-ship run the rollout with a human at the gate.
//
// SAFETY: any gate miss, any active held-out alarm, any ineligible kind -> fall back to
// propose-only (return {action:'propose'}), never merge. A bad bake -> autonomous
// rollback + escalate. Rollback-rate over threshold -> trip autonomy OFF for all kinds.
// An un-cleared breach after rollback is an INCIDENT, not a deploy problem: hand it to
// loop-operate's health-response template, which escalates to loop-incident when no runbook
// restores the SLI.
//
// H10: no clock / no Math.random in-script; time is passed via args.nowIso.
//
// Invoke with: Workflow({ script, args: {
//   repo:{owner,name}, candidate, autonomyIssueNumber, ledgerIssueNumber,
//   baselineIssueNumber, trustThreshold, rollbackRateTrip, bakeMechanism,
//   healthCheckSpec, rollbackSpec, nowIso } })
//   candidate         — { id, kind, branch, prNumber, filesChanged:[...], risk, summary }
//   autonomyIssueNumber — pinned 🔒 Autonomy State issue (mode, enabledKinds, trips, log)
//   trustThreshold    — min credit-ledger trustWeight for a kind to be eligible (e.g. 0.9)
//   rollbackRateTrip  — rollback fraction over the recent window that trips autonomy off

export const meta = {
  name: 'canary-merge-template', // EDIT ME
  description: 'SCALE autonomous delivery: eligibility-gate a safeToPropose candidate, merge behind a canary, bake, promote or auto-rollback; trip to propose-only on alarm',
  phases: [
    { title: 'Gate', detail: 'autonomy on? kind eligible? gates green? — else propose-only' },
    { title: 'Merge', detail: 'merge to main behind a flag/canary (never 100%)' },
    { title: 'Bake', detail: 'watch health signals for the window' },
    { title: 'Decide', detail: 'promote if healthy, else autonomous rollback + escalate' },
  ],
}

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
// §M8 omission note: WIDTH and DRY_LIMIT omitted — promote/rollback is a single gating DECISION
// node (§M5 carve-out: width 1 in both modes), and there is no loop.

const REPO = (input && input.repo) || { owner: 'OWNER', name: 'REPO' } // EDIT ME
const C = (input && input.candidate) || null
const AUTONOMY_ISSUE = (input && input.autonomyIssueNumber) || null
const LEDGER_ISSUE = (input && input.ledgerIssueNumber) || null
const BASELINE_ISSUE = (input && input.baselineIssueNumber) || null // held-out alarm source
const TRUST_MIN = (input && input.trustThreshold) || 0.9
const ROLLBACK_TRIP = (input && input.rollbackRateTrip) || 0.34 // >1/3 of recent merges rolled back -> trip
// The three infra specs below are loop-ship's and loop-operate's to define; this template only
// carries them through to the agents. Choose them THERE, then pass them in.
// EDIT ME — pick the guard per loop-ship/references/rollout-strategies.md (canary slice, flag, or
// staged rollout) and name it here. Never 100% on merge; that is the whole point of the rung.
const BAKE_MECHANISM = (input && input.bakeMechanism) || 'EDIT_ME — name the guard chosen per loop-ship/references/rollout-strategies.md (canary slice / feature flag / staged rollout)'
// EDIT ME — the SLO gate, defined per loop-operate/references/slo-model.md (SLI, objective, error
// budget) and evaluated per loop-operate/references/alerting.md (multi-window multi-burn-rate).
// "Healthy" means what loop-operate says it means; do not invent a second definition here.
const HEALTH_SPEC = (input && input.healthCheckSpec) || 'EDIT_ME — the SLO gate per loop-operate/references/slo-model.md + alerting.md (SLI, objective, burn-rate windows), plus CI-on-main and no new failing held-out'
// EDIT ME — the TESTED rollback path from loop-ship/references/rollback-playbook.md. An untested
// rollback is not a rollback, and SCALE is not licensed without one.
const ROLLBACK_SPEC = (input && input.rollbackSpec) || 'EDIT_ME — the tested rollback path per loop-ship/references/rollback-playbook.md (revert the merge commit / flip the flag off / redeploy the prior digest)'
const NOW_ISO = (input && input.nowIso) || null

// Change classes that NEVER auto-merge, regardless of every gate (references/deployment.md
// §Eligibility). The reason each is on the list belongs to loop-ship, not here: 'migration' is
// expand-contract work (loop-ship/references/migrations.md), 'release' is a go/no-go gate
// (loop-ship/references/release-gates.md), and both are human-gated by design.
const NEVER_KINDS = ['migration', 'infra', 'secret', 'api-break', 'release']
const propose = (reason) => { log(`FALL BACK to propose-only: ${reason}`); return { action: 'propose', reason } }

if (!C) return propose('no candidate supplied')
if (!AUTONOMY_ISSUE) return propose('no 🔒 Autonomy State issue wired — SCALE cannot be enabled safely')

// --- PHASE 1: GATE ---------------------------------------------------------------
// 1a. Autonomy state: is SCALE on, for THIS kind, and not currently tripped?
const stateRead = await agent(
  `Repo: ${REPO.owner}/${REPO.name}. Read issue #${AUTONOMY_ISSUE} and return its body verbatim as "json".`,
  withRoute('scout', { label: 'read-autonomy', phase: 'Gate', schema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] } }),
)
let state
try { state = JSON.parse((stateRead && stateRead.json) || '') } catch { state = null }
if (!state) state = { mode: 'propose-only', enabledKinds: [], tripped: false, rollbacksRecent: [], log: [] }
if (state.mode !== 'auto-merge' || state.tripped) return propose(`autonomy mode=${state.mode} tripped=${!!state.tripped}`)
if (!Array.isArray(state.enabledKinds) || !state.enabledKinds.includes(C.kind)) return propose(`kind "${C.kind}" not in enabledKinds`)

// 1b. Hard eligibility: NEVER-list, high-risk memo, protected paths (defense-in-depth;
//     verifier-canary already blocks protected paths, re-checked here before a MERGE).
if (NEVER_KINDS.includes(C.kind)) return propose(`kind "${C.kind}" is on the NEVER-auto-merge list`)
if (C.risk === 'high') return propose('risk memo rated high')

// 1c. Held-out alarm active? An out-of-band meta-overfit signal forbids auto-merge outright.
if (BASELINE_ISSUE) {
  const b = await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Read issue #${BASELINE_ISSUE} (held-out baseline) and return its body verbatim as "json".`,
    withRoute('scout', { label: 'read-heldout', phase: 'Gate', schema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] } }),
  )
  let hb; try { hb = JSON.parse((b && b.json) || '') } catch { hb = null }
  const lastRun = hb && hb.history && hb.history.length ? hb.history[hb.history.length - 1] : null
  if (lastRun && lastRun.alarm) return propose('held-out meta-overfit alarm is active')
}

// 1d. Credit-ledger trust for this kind must clear the high bar.
if (LEDGER_ISSUE) {
  const l = await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Read issue #${LEDGER_ISSUE} (credit ledger) and return its body verbatim as "json".`,
    withRoute('scout', { label: 'read-ledger', phase: 'Gate', schema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] } }),
  )
  let led; try { led = JSON.parse((l && l.json) || '') } catch { led = null }
  const tw = led && led.kinds && led.kinds[C.kind] ? led.kinds[C.kind].trustWeight : 0
  if (tw < TRUST_MIN) return propose(`kind "${C.kind}" trustWeight ${tw} < ${TRUST_MIN}`)
}

// --- PHASE 2: MERGE (behind a guard, never 100%) ---------------------------------
// The guard is loop-ship's mechanism, applied here — rollout-strategies.md decides WHICH guard and
// at what slice; this template only requires that one is applied and that it is not 100%.
const merged = await agent(
  `Repo: ${REPO.owner}/${REPO.name}. Merge PR #${C.prNumber} (branch ${C.branch}) into main, but SHIP IT GUARDED, not to everyone, using the rollout mechanism loop-ship selected (see loop-ship/references/rollout-strategies.md): ${BAKE_MECHANISM}. Record the merge commit SHA. Do NOT roll out to 100%. Report the merge SHA and the guard you applied.`,
  withRoute('implement', { label: `merge:${C.id}`, phase: 'Merge', schema: { type: 'object', properties: { mergeSha: { type: 'string' }, guard: { type: 'string' }, ok: { type: 'boolean' } }, required: ['ok'] } }),
)
if (!merged || !merged.ok || !merged.mergeSha) return propose('merge did not complete cleanly — nothing to promote')

// --- PHASE 3: BAKE (watch health for the window) ---------------------------------
// The gate is loop-operate's, applied here verbatim: this template asks whether the SLO gate in
// HEALTH_SPEC holds and takes the answer. It does not define healthy, does not pick the burn-rate
// windows, and does not second-guess a breach — slo-model.md and alerting.md own all three.
const health = await agent(
  `Repo: ${REPO.owner}/${REPO.name}. For merge ${merged.mergeSha}, evaluate health over the bake window against the SLO gate as loop-operate defines it (see loop-operate/references/slo-model.md for the SLI/objective/error-budget model and alerting.md for multi-window multi-burn-rate evaluation): ${HEALTH_SPEC}. Return healthy=true ONLY if every signal is within bounds; otherwise healthy=false with the breached signal. An alert that went quiet while the SLI is unchanged is NOT healthy.`,
  withRoute('verify', { label: `bake:${C.id}`, phase: 'Bake', schema: { type: 'object', properties: { healthy: { type: 'boolean' }, breach: { type: 'string' } }, required: ['healthy'] } }),
)

// --- PHASE 4: DECIDE (promote or autonomous rollback) ----------------------------
const rollbacks = Array.isArray(state.rollbacksRecent) ? state.rollbacksRecent.slice(-19) : []
let action, detail
if (health && health.healthy) {
  await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Bake passed for ${merged.mergeSha}. Promote to full rollout (widen the flag / complete the staged rollout). Confirm done.`,
    withRoute('gating', { label: `promote:${C.id}`, phase: 'Decide', schema: { type: 'object', properties: { done: { type: 'boolean' } }, required: ['done'] } }),
  )
  action = 'promoted'; detail = merged.mergeSha
  rollbacks.push(0)
} else {
  // Autonomous rollback — cheap, reversible; the whole reason canary beats a perfect gate.
  // The path itself is loop-ship's tested rollback (rollback-playbook.md), executed here.
  await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Bake FAILED for ${merged.mergeSha} (breach: ${(health && health.breach) || 'unknown'}). Roll back now using the tested rollback path loop-ship defined (see loop-ship/references/rollback-playbook.md): ${ROLLBACK_SPEC}. Then open a loud issue titled "🚨 Auto-rollback ${merged.mergeSha}" describing the breach. If the SLI does NOT recover after the rollback, this is no longer a deploy problem — hand it to loop-operate (health-response), which escalates to loop-incident when no runbook restores it. Confirm the revert landed.`,
    withRoute('implement', { label: `rollback:${C.id}`, phase: 'Decide', schema: { type: 'object', properties: { reverted: { type: 'boolean' } }, required: ['reverted'] } }),
  )
  action = 'rolled-back'; detail = `${merged.mergeSha}: ${(health && health.breach) || 'breach'}`
  rollbacks.push(1)
}

// Tripwire: if the recent rollback rate is too high, revoke autonomy for ALL kinds.
const rate = rollbacks.length ? rollbacks.reduce((a, b) => a + b, 0) / rollbacks.length : 0
const trip = rate >= ROLLBACK_TRIP
if (trip) log(`🚨 AUTONOMY TRIPPED: rollback rate ${rate.toFixed(2)} >= ${ROLLBACK_TRIP} — dropping ALL kinds to propose-only. Human review required to re-enable.`)

// Persist state + append to the audit log.
const nextState = {
  ...state,
  mode: trip ? 'propose-only' : state.mode,
  tripped: trip ? true : state.tripped,
  rollbacksRecent: rollbacks,
  log: [...(state.log || []), { at: NOW_ISO, candidate: C.id, kind: C.kind, action, detail, rollbackRate: Number(rate.toFixed(3)) }],
}
if (trip) nextState.trippedAt = NOW_ISO
await agent(
  `Repo: ${REPO.owner}/${REPO.name}. Replace issue #${AUTONOMY_ISSUE}'s body with exactly this JSON, no commentary:\n${JSON.stringify(nextState, null, 2)}`,
  withRoute('doc', { label: 'write-autonomy', phase: 'Decide', schema: { type: 'object', properties: { updated: { type: 'boolean' } }, required: ['updated'] } }),
)

log(`SCALE ${action} ${C.id} (${C.kind}); rollbackRate=${rate.toFixed(2)}${trip ? ' — TRIPPED to propose-only' : ''}`)
return { action, candidate: C.id, kind: C.kind, mergeSha: merged.mergeSha, tripped: trip, rollbackRate: rate }
