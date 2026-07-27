// Template: IMPROVEMENT LOOP — the autonomous engineering loop's engine.
// Adapts loop-until-budget.workflow.js: each round pulls a deduped batch of feedback,
// runs act->verify per item (pipeline, no barrier), and collects PROPOSALS; when there
// is no fresh feedback it does a research/tech-debt round instead. Guarded by budget
// floor (loop-policy L2), dry counter (L1), and a hard round cap (L4); dedups against
// everything seen + open issues/PRs (L3). Ends every unit of work at a propose gate — it
// NEVER merges (harness policy H11).
//
// SAFETY: defaults to runMode:"dry" — it returns proposal objects and opens NOTHING.
// Only wire the live PR-creation step (marked EDIT ME) once you trust it, and even then
// open DRAFT PRs on claude/ branches and never merge.
//
// Model/effort and verifier width come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// BREAKING CHANGE, v0.4.0 → v1.0.0 — READ THIS IF YOU HAVE A CLOUD ROUTINE WIRED TO THIS TEMPLATE.
// `input.mode` is now reserved fleet-wide for the EXECUTION mode ('optimize'|'full'), so this
// template's dry/live safety switch was RENAMED to `input.runMode`. A caller still passing the old
// `mode: "dry"` or `mode: "live"` gets the safe default (RUN_MODE falls back to 'dry') and never an
// accidental live run — but a routine that meant `mode: "live"` now opens NOTHING while still
// reporting success. That is a silent no-op, so the script logs a loud ⚠️ warning when it sees the
// legacy value (see LEGACY_MODE below). Fix: rename the argument to `runMode`.
//
// Invoke with: Workflow({ script, args: { repo: {owner,name}, runMode: "dry"|"live", mode: "optimize"|"full", maxRounds, floor } })
// input.runMode — 'dry' (default, safe) | 'live' — this template's dry/live switch
// input.mode    — 'optimize' (default) | 'full' — the fleet execution mode (§M2), NOT dry/live
// input.planner — 'opus' (default) | 'fable' — planner-node override only (§M7); this template
//                 declares no planner node, so the flag is inert here and passes through harmlessly

export const meta = {
  name: 'improvement-loop-template', // EDIT ME
  description: 'Autonomous improvement loop: intake feedback, act+verify per item, propose; research when idle', // EDIT ME
  phases: [
    { title: 'Intake', detail: 'read + dedup feedback' },
    { title: 'Act', detail: 'triage + implement per item' },
    { title: 'Verify', detail: 'self-review + risk memo' },
    { title: 'Research', detail: 'improvement ideas when idle' },
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
const DRY_LIMIT = MODE === 'full' ? 3 : 2
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// DRY_LIMIT above IS loop policy L1's K — 2 in optimize, 3 in full (§M5). WIDTH is kept: the
// Verify stage is a genuine adversarial review ("adversarially review this change"), and §M5
// forbids full mode ever running a single skeptic on one. This loop runs UNATTENDED and its
// output is a PR proposal, so a full-mode run gated by one reviewer while billing at the
// Opus-5/xhigh ceiling was the worst possible combination. The lens set is declared below.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.
const REPO = (input && input.repo) || { owner: 'OWNER', name: 'REPO' } // EDIT ME

// SAFETY SWITCH — dry/live. `input.mode` is reserved fleet-wide for the EXECUTION mode
// ('optimize'|'full'), so this template's dry/live switch is `input.runMode` (renamed in v1.0.0).
// A v0.4.0 caller still passing mode:"live" resolves to the SAFE default 'dry' and would otherwise
// keep completing successfully while opening nothing — so say it LOUDLY rather than silently.
const LEGACY_MODE = input && (input.mode === 'dry' || input.mode === 'live') ? input.mode : null
if (LEGACY_MODE) {
  log(`⚠️  BREAKING CHANGE (v0.4.0 → v1.0.0): args.mode="${LEGACY_MODE}" is the OLD dry/live switch and is IGNORED. ` +
      `args.mode now selects the EXECUTION mode ('optimize'|'full') fleet-wide, and "${LEGACY_MODE}" is not one of those values — ` +
      `MODE resolved to '${MODE}'. Rename the argument to runMode:"${LEGACY_MODE}". ` +
      `Until you do, this run stays in the SAFE dry mode and will open NOTHING.`)
}
const RUN_MODE = input && input.runMode === 'live' ? 'live' : 'dry' // default dry = safe
if (LEGACY_MODE === 'live' && RUN_MODE === 'dry') {
  log('⚠️  You asked for a LIVE run with the retired mode:"live" key. Nothing will be branched, opened, or merged this run.')
}
const FLOOR = (input && input.floor) || 60000 // one round + verification headroom (L2)
const MAX_ROUNDS = (input && input.maxRounds) || 6 // hard backstop (L4)

// EDIT ME: the Verify node's DECLARED review lenses. Each attacks a proposed change a DIFFERENT
// way (H4: diversity beats redundancy). Mode picks how MANY run (§M5); it never invents new ones.
// ORDER MATTERS — in optimize mode only lens[0] runs, so lens[0] carries the broadest mandate.
// Five are declared so a gating review can reach width 5 without inventing a lens at run time.
const REVIEW_LENSES = [
  { key: 'correctness', prompt: 'Attack the change itself: does it do what the item asked, exactly, and does it hold on the empty, null, boundary, and error paths as well as the happy one?' },
  { key: 'regression', prompt: 'Attack the blast radius: what previously-working behavior could this break, what callers depend on the changed contract, and does the added test actually fail before the fix and pass after?' },
  { key: 'scope', prompt: 'Attack the scope: does the diff contain ONLY the named change? An unrelated cleanup, a smuggled behavior change, or a second fix makes this unreviewable by a human at the gate.' },
  { key: 'security', prompt: 'Attack it as an adversary: new untrusted input reaching a dangerous sink, a widened permission, a secret or token in the diff, a dependency added without provenance.' },
  { key: 'reversibility', prompt: 'Attack the exit: if this lands and is wrong, can it be reverted cleanly? A migration, a data backfill, or a released artifact makes safeToPropose a much higher bar.' },
]

// Verifier width is mode-resolved (§M5): 1 in optimize, 3 in full, 5 on a gating node. Capped by
// the declared lens set, and any cap is logged — no silent narrowing (H6).
const VERIFY_WIDTH = Math.min(WIDTH('verify'), REVIEW_LENSES.length)
if (VERIFY_WIDTH < WIDTH('verify')) {
  log(`verifier width capped at ${VERIFY_WIDTH}: only ${REVIEW_LENSES.length} lenses declared (§M5)`)
}
const ACTIVE_LENSES = REVIEW_LENSES.slice(0, VERIFY_WIDTH)
// A change is judged unsafe to propose on a MAJORITY refute at ⌈N/2⌉ — 1 of 1, 2 of 3, 3 of 5.
// Computed, never a literal, because a literal is silently wrong the moment width becomes 5.
log(`verify [mode=${MODE}]: width ${VERIFY_WIDTH} (${ACTIVE_LENSES.map((l) => l.key).join(', ')}); a change is blocked at ${Math.ceil(VERIFY_WIDTH / 2)} refute(s)`)

const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['issue', 'pr-comment', 'ci-failure', 'tech-debt'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          ref: { type: 'string' },
          priority: { type: 'number' },
        },
        required: ['kind', 'title'],
      },
    },
  },
  required: ['items'],
}
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: { approach: { type: 'string' }, skill: { type: 'string' }, worthDoing: { type: 'boolean' } },
  required: ['approach', 'worthDoing'],
}
const ACT_SCHEMA = {
  type: 'object',
  properties: { branch: { type: 'string' }, summary: { type: 'string' }, filesChanged: { type: 'array', items: { type: 'string' } }, testAdded: { type: 'boolean' } },
  required: ['summary'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: { safeToPropose: { type: 'boolean' }, risk: { type: 'string', enum: ['low', 'medium', 'high'] }, memo: { type: 'string' } },
  required: ['safeToPropose', 'risk'],
}
const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, rationale: { type: 'string' }, source: { type: 'string' } },
        required: ['title', 'rationale'],
      },
    },
  },
  required: ['proposals'],
}

const key = (it) => `${it.kind || 'idea'}:${it.ref || it.title}`
const seen = new Set()
const proposals = []
let dry = 0
let round = 0

if (RUN_MODE === 'dry') log('DRY run mode: no branches, PRs, or merges — returning proposal objects only')
if (!budget.total) log('no budget target set — running a single bounded round')

do {
  round++

  // INTAKE — read-only. Reads real issues/PRs via the GitHub tools; dedups against open work.
  const intake = await agent(
    `Repo: ${REPO.owner}/${REPO.name}. Using the GitHub tools, gather ACTIONABLE, deduplicated feedback: open issues (list_issues/search_issues) not already covered by an open PR, plus unresolved review comments and failing CI on open PRs (pull_request_read get_comments/get_review_comments/get_check_runs). Skip anything already tracked by an open issue/PR. Return raw items; [] if none.`,
    optsFor({ taskType: 'scout', phase: 'Intake', schema: ITEMS_SCHEMA }, `intake:r${round}`),
  )
  const fresh = ((intake && intake.items) || []).filter((it) => !seen.has(key(it)))
  fresh.forEach((it) => seen.add(key(it)))
  log(`round ${round}: ${fresh.length} fresh feedback items` + (budget.total ? `, ${Math.round(budget.remaining() / 1000)}k left` : ''))

  if (!fresh.length) {
    // IDLE → one research/tech-debt round (produces proposal ideas, not code).
    dry++
    const research = await agent(
      `Repo: ${REPO.owner}/${REPO.name}. No pending feedback. Propose high-value improvements grounded in the project plus market/ecosystem trends and research (use research tools if available). Verify each idea against a real source; dedup against any open issue proposing the same. Return proposals.`,
      optsFor({ taskType: 'analyze', phase: 'Research', schema: RESEARCH_SCHEMA }, `research:r${round}`),
    )
    const ideas = ((research && research.proposals) || []).filter((p) => !seen.has(key({ title: p.title })))
    ideas.forEach((p) => seen.add(key({ title: p.title })))
    proposals.push(...ideas.map((p) => ({ source: 'research', title: p.title, rationale: p.rationale, ref: p.source })))
    log(`round ${round} [mode=${MODE}]: idle -> ${ideas.length} research proposals (dry=${dry}/${DRY_LIMIT})`)
    continue
  }
  dry = 0

  // ACT -> VERIFY per item, no barrier (H1). Prioritize highest first.
  const ordered = fresh.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))
  const handled = await pipeline(
    ordered,
    (it) =>
      agent(
        `Triage this ${it.kind} for ${REPO.owner}/${REPO.name} and decide the approach + which sibling skill owns it (loop-debug, loop-design, loop-test, loop-scout). Item: ${it.title} — ${it.detail || ''} (${it.ref || ''}). Set worthDoing=false to skip.`,
        optsFor({ taskType: 'analyze', phase: 'Act', schema: TRIAGE_SCHEMA }, `triage:${key(it)}`),
      ).then((t) => ({ it, triage: t })),
    (prev) => {
      if (!prev || !prev.triage || !prev.triage.worthDoing) return prev
      const verb = RUN_MODE === 'live'
        ? 'Implement the change on a NEW claude/-prefixed branch (design -> implement -> add a fails-before/passes-after test -> update docs). Do NOT push to main or merge.'
        : 'Describe the change you WOULD make (design, files, the test you would add) without editing anything.'
      // AP5 (Tangled Loop) fix: in live mode the Act stage mutates files and multiple
      // items can run concurrently under pipeline() (H1), so each gets its own git
      // worktree (H7). Dry mode is read-only and needs no isolation.
      const actOpts = optsFor({ taskType: 'implement', phase: 'Act', schema: ACT_SCHEMA }, `act:${key(prev.it)}`)
      if (RUN_MODE === 'live') actOpts.isolation = 'worktree'
      return agent(
        `${verb}\nItem: ${prev.it.title} — ${prev.it.detail || ''}\nApproach: ${prev.triage.approach}`,
        actOpts,
      ).then((a) => ({ ...prev, act: a }))
    },
    // Width is mode-resolved (§M5): one adversarial reviewer per item in optimize, three diverse
    // lenses in full. The inner parallel() is a WITHIN-ITEM lens vote, not a cross-item barrier,
    // so H2's earned-barrier test is not engaged and no item waits on another item's change.
    (prev) => {
      if (!prev || !prev.act) return prev
      return parallel(
        ACTIVE_LENSES.map((lens) => () =>
          agent(
            `Adversarially review this change and write its impact/risk memo (loop-review + loop-audit). Set safeToPropose=false if it is unsafe, unclear, or unverified.\nChange: ${prev.act.summary}\nFiles: ${(prev.act.filesChanged || []).join(', ')}\n\nYour lens: ${lens.prompt}`,
            optsFor({ taskType: 'verify', phase: 'Verify', schema: VERIFY_SCHEMA }, `verify:${lens.key}:${key(prev.it)}`),
            // Carry the lens key alongside the verdict so a dead reviewer cannot shift the
            // remaining verdicts' labels when the nulls are filtered out.
          ).then((v) => (v ? { lens: lens.key, verdict: v } : null)),
        ),
      ).then((votes) => {
        // Dead reviewers resolve to null — filter before counting (harness policy H5).
        const live = votes.filter(Boolean)
        if (live.length < ACTIVE_LENSES.length) {
          log(`verify ${key(prev.it)}: ${ACTIVE_LENSES.length - live.length}/${ACTIVE_LENSES.length} review lens(es) died; judging on ${live.length}`)
        }
        const blocks = live.filter((v) => !v.verdict.safeToPropose).length
        // No live reviewer means UNREVIEWED, which is never safe to propose — default false (H4).
        const safeToPropose = live.length > 0 && blocks < Math.max(1, Math.ceil(live.length / 2))
        const RANK = { low: 0, medium: 1, high: 2 }
        // Risk is the WORST rating any live lens gave, never the average — averaging lets one
        // reassuring reviewer wash out a real high-risk finding.
        const risk = live.reduce((worst, v) => ((RANK[v.verdict.risk] || 0) > RANK[worst] ? v.verdict.risk : worst), 'low')
        const memo = live.map((v) => `[${v.lens}] ${v.verdict.memo || ''}`).join('\n')
        return { ...prev, verify: { safeToPropose, risk, memo, votes: live.length, blocks } }
      })
    },
  )

  // PROPOSE gate — collect proposals. NEVER merge.
  for (const h of handled.filter(Boolean)) {
    if (!h.triage || !h.triage.worthDoing) { log(`skip ${key(h.it)}: triaged out`); continue }
    if (!h.act || !h.verify || !h.verify.safeToPropose) { log(`skip ${key(h.it)}: not safe to propose`); continue }
    // EDIT ME (live mode): open a DRAFT PR from h.act.branch and post a summary comment here —
    //   mcp__github__create_pull_request({ draft: true, head: h.act.branch, base: 'main', ... })
    //   mcp__github__add_issue_comment(...). NEVER call merge_pull_request.
    // Apply the `automated` label AND a `kind:${h.it.kind}` label (or a hidden
    //   `<!-- credit-kind: ${h.it.kind} -->` body marker) so credit-ledger.workflow.js
    //   can attribute this PR's outcome back to its kind. See references/credit-horizon.md.
    proposals.push({ source: 'feedback', item: h.it, change: h.act, risk: h.verify })
  }
} while (budget.total && budget.remaining() > FLOOR && round < MAX_ROUNDS && dry < DRY_LIMIT)

// Ledger line (L5). This template runs UNATTENDED, so the execution mode is recorded explicitly:
// a transcript with no mode in it is unreadable after the fact.
log(`done: ${round} round(s), ${proposals.length} proposals · mode=${MODE} runMode=${RUN_MODE} verifyWidth=${VERIFY_WIDTH} dryLimit=${DRY_LIMIT} maxRounds=${MAX_ROUNDS} — nothing merged`)
return { mode: RUN_MODE, executionMode: MODE, rounds: round, proposals }
