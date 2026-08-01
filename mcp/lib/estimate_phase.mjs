// mcp/lib/estimate_phase.mjs — the estimate_phase MCP tool handler (Phase 3, S2), composed over
// the Phase-2 spine: mcp/lib/estimate.mjs (§M6 — the whole pre-flight arithmetic: computeItems,
// computeWidthM6, computeNodeTokens, resolveBandKey/lookupBandRow for the flag-selected 'planner on
// Fable' row, accumulateTotals) and, narrowly, mcp/lib/modes.mjs (resolveMode() only — mode and
// compareTo canonicalization/alias handling per ADR-0003 §D3.3, whose appliesTo list names both
// route_node.mode AND estimate_phase.mode/estimate_phase.compareTo). estimate_phase never reads
// §M8/ROUTES: ADR-0003 §D3.6's own "sources" list for this tool names §M6 alone, and ADR-0006's
// sourcePins agree — §M8 has no bearing on the pre-flight arithmetic.
//
// ============================================================================================
// ARCHITECTURE NOTE — same disclosed departure mcp/lib/route_node.mjs (Phase 3, S1) already took,
// for the same reason. Read that file's header before touching the imports below; this file follows
// its precedent rather than re-litigating it: a tool-handler layer built explicitly ON TOP OF the
// spine composes the spine via relative import, while sibling SPINE modules (modes.mjs, estimate.mjs,
// boundary.mjs, standards.mjs) still do not import one another. Every import below that is NOT one of
// the two spine modules is node:-only, per ADR-0002 §D2.1.
// ============================================================================================
//
// Per ADR-0005 (no silent default): every field of every ok:true result is either read straight
// through from the spine's already-validated result, or located fresh HERE by the same
// coordinate-first discipline modes.mjs/estimate.mjs already use for §M8/§M6 — heading -> bounded
// section (estimate.mjs's own exported locateM6Section) -> anchored line, never a tree-wide content
// search. This file locates four pieces of §M6 prose neither spine module parses (their concern is
// the BAND/SIZE/formula-fence machinery, not these standalone paragraphs): the "what changed" bullet
// (:174), the "risks" bullet (:175), the confirmation-contract blockquote (:229-235) and its §M7a
// substitution, and the two "DECIDED" clauses — the ≤15-agents guideline (:256) and the --budget
// refusal (:258). Every one of those locators is a bounded regex scan within the already-coordinate-
// bounded §M6 section, never a hardcoded line number: a reformat fails loud (source-anchor-moved)
// rather than silently citing stale bytes.
//
// Per ADR-0005 §D5.3.6: no clock, no randomness, anywhere in this file's reachable code — inherited
// from mcp/lib/estimate.mjs's own arithmetic (A1-A4) and never reintroduced here. Two identical calls
// return byte-identical structuredContent (§M6:437 / ADR-0003's determinism note on this tool).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  readModesM6,
  locateM6Section,
  resolveBandKey,
  lookupBandRow,
  computeItems,
  computeWidthM6,
  computeNodeTokens,
  accumulateTotals,
  CANONICAL_KINDS,
  NODE_SHAPES,
  SIZE_RATIONAL,
} from './estimate.mjs'

import { resolveMode } from './modes.mjs'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / route_node.mjs): small, universal helpers are
// re-declared per file, anchored to the source file rather than to a sibling module.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const SERVER_VERSION = '0.2.0'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to modes.mjs's / estimate.mjs's own copies.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

function resourceUri(file) {
  return `heimdall://${file}`
}

function withResourceUri(citation) {
  if (!citation) return citation
  return { ...citation, resourceUri: resourceUri(citation.file) }
}

function dedupeCitations(list) {
  const seen = new Set()
  const out = []
  for (const c of list) {
    if (!c) continue
    const key = `${c.file}:${c.startLine}-${c.endLine}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function citeM6Range(m6loc, startLine, endLine) {
  return { file: m6loc.file, section: m6loc.section, startLine, endLine, sha256: sha256OfLines(m6loc.allLines, startLine, endLine) }
}

// Bounded scan within the already-located §M6 section (m6loc.sectionStart0..sectionEnd0, both
// 0-indexed) for the first line matching anchorRegex. Coordinate-bounded, never a tree-wide search
// (ADR-0004 §D4.2) — the SAME discipline modes.mjs's crosscheckM3 uses for §M3's rows.
function findM6Line(m6loc, anchorRegex) {
  for (let i = m6loc.sectionStart0; i < m6loc.sectionEnd0; i++) {
    if (anchorRegex.test(m6loc.allLines[i])) return i // 0-indexed
  }
  return -1
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function pluralItems(n) {
  return `${n} item${n === 1 ? '' : 's'}`
}

function pluralLenses(n) {
  return `${n} lens${n === 1 ? '' : 'es'}`
}

// ---------------------------------------------------------------------------
// Envelope constants (ADR-0003 §D3.5, §D3.6, §D3.8's estimate_phase call-site entry, §D6.2).
// ---------------------------------------------------------------------------

const ESTIMATE_PHASE_FALLBACK_TEXT =
  "Do §M6's arithmetic by hand against the BAND table (:209) and SIZE (:225). This is the status quo and it is fully specified — §M6 is deliberately pure arithmetic over literals precisely so it can be done without tooling."

const CALIBRATION_WARNING =
  'BAND and SIZE are calibration, not physics. Re-baseline them from <transcriptDir>/journal.jsonl at every gate. The all-out column is the thinner-evidence half. This estimate is deterministic arithmetic over the numbers currently in §M6 — it is not a measurement.'

const DEPRECATION_MESSAGE =
  'The v1.1 mode names are a deprecated compatibility shim (§M9.6). Prefer lite|balanced|all-out; the aliases are removed in the next major.'

const PLANNER_VALUES = Object.freeze(['opus', 'fable'])
const SIZE_VALUES = Object.freeze(Object.keys(SIZE_RATIONAL)) // ['compact','standard','long-form'] — read from the spine's own exported table, never re-hardcoded independently.

// ---------------------------------------------------------------------------
// Input validation — ADR-0005 §D5.2's precondition, enforced in code because ADR-0001's hand-rolled
// zero-dependency server supplies no JSON-Schema validation of its own. Absence of an OPTIONAL field
// is legal and takes the declared default (never an error); presence of an unrecognized VALUE for a
// tool-declared (not source-derived) enum — nodeShape, size, planner — is a shape violation and maps
// to JSON-RPC -32602 (ADR-0003 §D3.5 protocolSeam), exactly mirroring how mcp/lib/route_node.mjs
// treats its own nodeShape/planner checks. `mode`/`compareTo`/`taskType` are different: they are
// vocabularies READ LIVE from execution-modes.md (§M2/§M3/§M8), so an unrecognized VALUE for those is
// an in-band `unknown_mode`/`unknown_task_kind` answer instead — only their JSON TYPE is checked here.
// nodeShape is REQUIRED on every node per ADR-0006 §D6.1.1 ("REQUIRED on route_node and on every
// estimate_phase node item... never defaulted from taskType") — its absence is -32602, matching
// route_node.mjs exactly, and for the identical reason: taskType -> nodeShape is not a function.
// ---------------------------------------------------------------------------

function protocolError(field, message) {
  return { protocolError: true, jsonRpcCode: -32602, field, message }
}

function validateNode(node, idx) {
  const p = (field, message) => protocolError(`nodes[${idx}]${field ? '.' + field : ''}`, message)
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return p(null, `nodes[${idx}] must be an object`)
  }
  if (typeof node.label !== 'string' || node.label.length === 0) {
    return p('label', `nodes[${idx}].label is required and must be a non-empty string`)
  }
  if (typeof node.taskType !== 'string') {
    return p('taskType', `nodes[${idx}].taskType is required and must be a string — the ten valid values are ${CANONICAL_KINDS.join(', ')}`)
  }
  if (node.nodeShape === undefined || node.nodeShape === null) {
    return p(
      'nodeShape',
      `nodes[${idx}].nodeShape is required — one of ${JSON.stringify(NODE_SHAPES)} (§M5:141-148, ADR-0006 §D6.1.1). It is never defaulted from taskType: taskType:'gating' alone does not say whether this is the DECISION shape (width 1 in every mode) or the VERIFY shape (width 3 balanced / 5 all-out).`
    )
  }
  if (typeof node.nodeShape !== 'string' || !NODE_SHAPES.includes(node.nodeShape)) {
    return p('nodeShape', `nodes[${idx}].nodeShape must be one of ${JSON.stringify(NODE_SHAPES)}; got ${JSON.stringify(node.nodeShape)}`)
  }
  if (node.phase !== undefined && typeof node.phase !== 'string') {
    return p('phase', `nodes[${idx}].phase must be a string; got ${typeof node.phase}`)
  }
  if (node.fanOut !== undefined) {
    const okKnown = Number.isInteger(node.fanOut) && node.fanOut >= 1
    const okUnknown = node.fanOut === 'unknown'
    if (!okKnown && !okUnknown) {
      return p('fanOut', `nodes[${idx}].fanOut must be a positive integer or the literal "unknown"; got ${JSON.stringify(node.fanOut)}`)
    }
  }
  // maxRounds/angles TYPE only here — their conditional REQUIREDNESS when fanOut:'unknown' is a
  // cross-field semantic rule and is enforced in-band by estimate.mjs's computeItems() (invalid_argument).
  if (node.maxRounds !== undefined && !(Number.isInteger(node.maxRounds) && node.maxRounds >= 1)) {
    return p('maxRounds', `nodes[${idx}].maxRounds must be a positive integer; got ${JSON.stringify(node.maxRounds)}`)
  }
  if (node.angles !== undefined && !(Number.isInteger(node.angles) && node.angles >= 1)) {
    return p('angles', `nodes[${idx}].angles must be a positive integer; got ${JSON.stringify(node.angles)}`)
  }
  if (node.size !== undefined && (typeof node.size !== 'string' || !SIZE_VALUES.includes(node.size))) {
    return p('size', `nodes[${idx}].size must be one of ${JSON.stringify(SIZE_VALUES)}; got ${JSON.stringify(node.size)}`)
  }
  if (node.askIsThorough !== undefined && typeof node.askIsThorough !== 'boolean') {
    return p('askIsThorough', `nodes[${idx}].askIsThorough must be a boolean; got ${typeof node.askIsThorough}`)
  }
  if (node.declaredLenses !== undefined && !(Number.isInteger(node.declaredLenses) && node.declaredLenses >= 0)) {
    return p('declaredLenses', `nodes[${idx}].declaredLenses must be a non-negative integer; got ${JSON.stringify(node.declaredLenses)}`)
  }
  return { ok: true }
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return protocolError(null, 'estimate_phase requires an object argument')
  }
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    return protocolError('nodes', 'nodes is required and must be a non-empty array')
  }
  for (let i = 0; i < input.nodes.length; i++) {
    const v = validateNode(input.nodes[i], i)
    if (v.protocolError) return v
  }
  if (input.mode !== undefined && input.mode !== null && typeof input.mode !== 'string') {
    return protocolError('mode', `mode must be a string; got ${typeof input.mode}`)
  }
  if (input.compareTo !== undefined && input.compareTo !== null && typeof input.compareTo !== 'string') {
    return protocolError('compareTo', `compareTo must be a string; got ${typeof input.compareTo}`)
  }
  if (input.planner !== undefined && !PLANNER_VALUES.includes(input.planner)) {
    return protocolError('planner', `planner must be one of ${JSON.stringify(PLANNER_VALUES)}; got ${JSON.stringify(input.planner)}`)
  }
  if (input.budgetTokens !== undefined && !(Number.isInteger(input.budgetTokens) && input.budgetTokens >= 1)) {
    return protocolError('budgetTokens', `budgetTokens must be a positive integer; got ${JSON.stringify(input.budgetTokens)}`)
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Envelope builders
// ---------------------------------------------------------------------------

function structuralError({ sourceRoot, internalResult, citations = [], fixText }) {
  const code =
    internalResult.code === 'source-missing'
      ? 'source_missing'
      : internalResult.code === 'source-heading-missing' ||
          internalResult.code === 'source-fence-missing' ||
          internalResult.code === 'source-fence-unclosed' ||
          internalResult.code === 'source-anchor-moved' ||
          internalResult.code === 'source-block-uninterpretable' ||
          internalResult.code === 'source-shape-changed'
        ? 'source_unparseable'
        : 'internal'
  return {
    ok: false,
    tool: 'estimate_phase',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    citations,
    deprecations: [],
    notes: [],
    error: { code, message: internalResult.error, fix: fixText, fallback: ESTIMATE_PHASE_FALLBACK_TEXT },
  }
}

function priceErrorEnvelope({ sourceRoot, citations, priceResult, whichField }) {
  const code = priceResult.code
  let fix = 'inspect the node named in the message and correct the field it names'
  let details
  if (code === 'unknown_task_kind') {
    fix = `pass one of ${CANONICAL_KINDS.join(', ')} for taskType`
    details = [{ field: 'taskType', issue: priceResult.error }]
  } else if (code === 'width_undetermined') {
    fix = 'pass askIsThorough:true or askIsThorough:false on the named node'
    details = [{ field: 'askIsThorough', issue: priceResult.error }]
  } else if (code === 'not_found') {
    fix = "confirm the node's taskType/planner combination names a §M6 BAND row"
  } else if (code === 'invalid_argument') {
    fix = 'supply maxRounds and angles (both positive integers) when fanOut is "unknown"'
  } else {
    fix = 'this is an internal arithmetic guard — file a defect rather than retry with different numbers'
  }
  return {
    ok: false,
    tool: 'estimate_phase',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    citations,
    deprecations: [],
    notes: [],
    error: {
      code,
      message: `[pricing at ${whichField}] ${priceResult.error}`,
      fix,
      details,
      fallback: ESTIMATE_PHASE_FALLBACK_TEXT,
    },
  }
}

// ---------------------------------------------------------------------------
// D6.2 — lite is an EXPLICIT UNPRICED REFUSAL, never a labelled balanced upper bound. citation points
// at execution-modes.md:225's positive absence sentence, located live (never a hardcoded line number).
// `agents` is reported as a DIAGNOSTIC DETAIL only, per D6.2's errorShape.detailsMustCarry: §M6:180's
// agents = Σ items(n) × width(n) needs no BAND, and §M5 puts every lite width at 1 (D6.1's
// liteWidthAuthority — the SOLE source is §M8's WIDTH(), which evaluates to 1 for every kind; that
// fact is a settled, ADR-ruled constant, not a fresh §M8 read, since estimate_phase's own sources list
// (ADR-0003 §D3.6) names §M6 alone). computeItems() itself needs no §M6 read at all (pure over the
// node object), so this diagnostic is available even though the BAND/width machinery is refused.
// ---------------------------------------------------------------------------

function liteRefusal({ sourceRoot, mode, compareTo, m6loc, nodes }) {
  const liteFields = []
  if (mode === 'lite') liteFields.push('mode')
  if (compareTo === 'lite') liteFields.push('compareTo')

  const anchorLine = findM6Line(m6loc, /^\*\*There is no `lite` column, deliberately/)
  const citation =
    anchorLine === -1
      ? withResourceUri(citeM6Range(m6loc, m6loc.headingLine0 + 1, m6loc.headingLine0 + 1))
      : withResourceUri(citeM6Range(m6loc, anchorLine + 1, anchorLine + 1))

  let agentsAtLiteWidth1 = 0
  let agentsIssue = 'computable without BAND and therefore reported, but as diagnostic detail and never as a result — every lite width is 1 (§M8\'s WIDTH() is the sole source for lite width and evaluates to 1 for every kind, ADR-0006 §D6.1 liteWidthAuthority), so agents = Σ items(n) × 1 = Σ items(n).'
  let agentsComputable = true
  for (const node of nodes) {
    const itemsResult = computeItems(node)
    if (!itemsResult.ok) {
      agentsComputable = false
      agentsIssue += ` (Could not complete: node ${JSON.stringify(node.label)} — ${itemsResult.error})`
      break
    }
    agentsAtLiteWidth1 += itemsResult.items
  }

  return {
    ok: false,
    tool: 'estimate_phase',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    citations: [citation],
    deprecations: [],
    notes: [],
    error: {
      code: 'mode_not_priceable',
      message: `${liteFields.join(' and ')} ${liteFields.length === 1 ? 'is' : 'are'} 'lite', which has no §M6 BAND column — the table at execution-modes.md:209-217 has exactly two data columns, 'balanced' and 'all-out' (execution-modes.md:225: "There is no \`lite\` column, deliberately").`,
      fix: 'Re-run the estimate at --mode balanced or --mode all-out; lite has no published band.',
      details: [
        {
          field: 'agents',
          issue: agentsIssue,
          supplied: null,
          expected: agentsComputable ? agentsAtLiteWidth1 : undefined,
        },
      ],
      fallback: "Today's instruction unchanged — read §M6's BAND table directly and note that it prices balanced and all-out only.",
    },
  }
}

// ---------------------------------------------------------------------------
// Per-node pricing — composes estimate.mjs's exported primitives directly (resolveBandKey,
// lookupBandRow, computeItems, computeWidthM6, computeNodeTokens) rather than calling its higher-level
// estimateNode()/estimatePhaseTotals(), because this tool's resultSchema needs one extra datum neither
// composite returns: the BAND row's own LABEL text (e.g. "scout / doc", "planner on Fable") for
// `bandKind`. Every arithmetic step below is still the spine's own function, never re-derived —
// only the row-label capture is new plumbing.
//
// D6.1.4 declaredLenses (estimate_phase node items, "with route_node's semantics"): `width` in the
// OUTPUT is always the raw §M5/§M6 value (∈ {1,3,5} — the resultSchema enum admits no other value).
// `agents` is computed from the EFFECTIVE width — min(raw width, declaredLenses) when declaredLenses
// was supplied, else the raw width uncapped. Absence is the D6.1.4-declared meaning "not yet
// declared", not a failed lookup: agents is then reported as a strict upper bound (isUpperBound:true,
// reusing §M6:205's existing "upper bound" idiom, per D6.1.4's own instruction), exactly as a
// fanOut:"unknown" discovery loop already is. multiplicandString shows the number that was ACTUALLY
// multiplied (the effective width), with the cap disclosed in parens when it differs from the raw
// width, so the string stays self-consistent with `agents` even though the flat `width` field cannot.
// ---------------------------------------------------------------------------

function priceOneNode(m6, node, { mode, planner }) {
  if (!CANONICAL_KINDS.includes(node.taskType)) {
    return {
      ok: false,
      code: 'unknown_task_kind',
      error: `unrecognized taskType ${JSON.stringify(node.taskType)} on node ${JSON.stringify(node.label)} — the ten valid values are ${CANONICAL_KINDS.join(', ')}`,
    }
  }

  const bandKey = resolveBandKey({ taskType: node.taskType, planner })
  const bandLookup = lookupBandRow(m6.bandRows, bandKey)
  if (!bandLookup.ok) return { ok: false, code: bandLookup.code, error: `${bandLookup.error} (node ${JSON.stringify(node.label)})` }
  const row = bandLookup.row
  const band = mode === 'balanced' ? row.balanced : row.allOut

  const itemsResult = computeItems(node)
  if (!itemsResult.ok) return itemsResult

  const widthResult = computeWidthM6({ nodeShape: node.nodeShape, mode, taskType: node.taskType, askIsThorough: node.askIsThorough }, m6.widthCases)
  if (!widthResult.ok) return widthResult

  const rawWidth = widthResult.value
  const hasDeclaredLenses = node.declaredLenses !== undefined
  const effectiveWidth = hasDeclaredLenses ? Math.min(rawWidth, node.declaredLenses) : rawWidth
  const agents = itemsResult.items * effectiveWidth
  if (!Number.isSafeInteger(agents)) {
    return { ok: false, code: 'internal', error: `agents (items × effective width) exceeded Number.isSafeInteger for node ${JSON.stringify(node.label)}` }
  }

  const size = node.size || 'standard'
  const tokens = computeNodeTokens({ agents, bandLow: band.low, bandHigh: band.high, size })
  if (!tokens.ok) return { ...tokens, error: `${tokens.error} (node ${JSON.stringify(node.label)})` }

  const items = itemsResult.items
  const isUpperBound = itemsResult.isUpperBound || !hasDeclaredLenses

  let multiplicandString = `${node.label}: ${pluralItems(items)} × ${pluralLenses(effectiveWidth)} = ${agents}`
  if (hasDeclaredLenses && effectiveWidth !== rawWidth) {
    multiplicandString += ` (capped from width ${rawWidth} by declaredLenses:${node.declaredLenses})`
  }

  const sizeDecimal = { compact: 0.4, standard: 1, 'long-form': 3 }[size]

  return {
    ok: true,
    label: node.label,
    taskType: node.taskType,
    items,
    width: rawWidth,
    agents,
    multiplicandString,
    bandKind: row.label,
    sizeMultiplier: sizeDecimal,
    tokensLow: tokens.low,
    tokensHigh: tokens.high,
    isUpperBound,
    citation: withResourceUri(widthResult.citation),
    // Extra, non-schema fields kept only for THIS module's own citation aggregation below — stripped
    // before anything is placed into result.perNode (that schema is additionalProperties:false).
    _bandCitation: withResourceUri(row.citation),
    _formulaCitation: withResourceUri(m6.formulaCitation),
  }
}

function priceNodes(m6, nodes, { mode, planner }) {
  const perNode = []
  for (const node of nodes) {
    const r = priceOneNode(m6, node, { mode, planner })
    if (!r.ok) return r
    perNode.push(r)
  }
  const totals = accumulateTotals(perNode.map((n) => ({ agents: n.agents, low: n.tokensLow, high: n.tokensHigh })))
  if (!totals.ok) return totals
  const phaseLabels = new Set(nodes.map((n) => (n.phase !== undefined ? n.phase : '__default__')))
  return {
    ok: true,
    perNode,
    total: { agents: totals.agents, phases: phaseLabels.size, tokensLow: totals.low, tokensHigh: totals.high },
  }
}

// ---------------------------------------------------------------------------
// §M6 prose — the "what changed" bullet (:174) and "risks" bullet (:175), both sentence-parsed (never
// a table) from the already coordinate-bounded §M6 section, split on the doc's own ", and "/", or "
// list-item boundaries. Populated only when at least one of {mode, compareTo} is 'all-out': both
// bullets describe what --mode all-out changes relative to balanced (execution-modes.md:174-175), and
// a balanced-vs-balanced call has no all-out in the pair for them to describe — reported as an empty
// array plus a disclosed note, never a silently-invented balanced-vs-balanced analogue (ADR-0005 I1).
// ---------------------------------------------------------------------------

// Full flat-list split: every TOP-LEVEL (paren-depth-0) comma is a boundary, consuming a following
// "and " (the Oxford-comma-joined final item). Paren-aware so a parenthetical like "(5 on gating
// nodes)" is never itself mistaken for a list boundary. Used for §M6:174's "what changed" bullet,
// which is a flat five-item list with no internal sub-clause commas.
function splitFlatList(text) {
  const parts = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    if (depth === 0 && c === ',') {
      parts.push(current)
      current = ''
      i++
      while (text[i] === ' ') i++
      if (text.startsWith('and ', i)) i += 4
      continue
    }
    current += c
    i++
  }
  if (current.trim()) parts.push(current)
  return parts.map((s) => s.replace(/`/g, '').trim()).filter(Boolean)
}

// Two-clause split: splits ONLY at the first TOP-LEVEL ", and " boundary, leaving everything after it
// — including its own internal commas (e.g. "capped at min(16, cores − 2) per workflow (H6), so a
// wide full-mode phase queues") — as one intact second item. Used for §M6:175's "risks" bullet, which
// is naturally two independent risk clauses joined by "and", not a flat list: a flat split would
// wrongly fragment "min(16, cores − 2)" and the trailing ", so ..." consequence clause into separate
// array entries.
function splitTwoClauses(text) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    if (depth === 0 && text.startsWith(', and ', i)) {
      return [text.slice(0, i), text.slice(i + ', and '.length)].map((s) => s.replace(/`/g, '').trim()).filter(Boolean)
    }
  }
  const single = text.replace(/`/g, '').trim()
  return single ? [single] : []
}

function extractM6Bullet(m6loc, anchorRegex, splitMode) {
  const line = findM6Line(m6loc, anchorRegex)
  if (line === -1) return { ok: false }
  const raw = m6loc.allLines[line]
  const dashIdx = raw.indexOf('—')
  const afterDash = dashIdx === -1 ? raw : raw.slice(dashIdx + 1)
  const text = afterDash.replace(/\*\*/g, '').trim().replace(/\.$/, '')
  const items = splitMode === 'twoClause' ? splitTwoClauses(text) : splitFlatList(text)
  return { ok: true, items, citation: withResourceUri(citeM6Range(m6loc, line + 1, line + 1)) }
}

// ---------------------------------------------------------------------------
// §M6's two "DECIDED" clauses — the ≤15-agents-per-workflow guideline (:256) and the --budget refusal
// (:258). Sentence-parsed, anchored on the literal "DECIDED" opener, never a hardcoded line number.
// ---------------------------------------------------------------------------

function locateAgentGuidelineClause(m6loc) {
  let idx = -1
  for (let i = m6loc.sectionStart0; i < m6loc.sectionEnd0; i++) {
    const l = m6loc.allLines[i]
    if (/^\*\*DECIDED/.test(l) && /15-agents-per-workflow guideline/.test(l) && /guideline wins/.test(l)) { idx = i; break }
  }
  if (idx === -1) {
    return { ok: false, code: 'source-anchor-moved', error: 'no "DECIDED — all-out mode versus the ≤15-agents-per-workflow guideline" clause found under §M6 in execution-modes.md' }
  }
  const raw = m6loc.allLines[idx]
  const m = /guideline wins\.\*\*\s*(.+)$/.exec(raw)
  const instruction = m ? m[1].replace(/`/g, '').trim() : raw.replace(/\*\*/g, '').trim()
  return { ok: true, instruction, citation: withResourceUri(citeM6Range(m6loc, idx + 1, idx + 1)) }
}

function locateBudgetRefusalClause(m6loc) {
  let idx = -1
  for (let i = m6loc.sectionStart0; i < m6loc.sectionEnd0; i++) {
    const l = m6loc.allLines[i]
    if (/^\*\*DECIDED/.test(l) && /--budget/.test(l) && /refuses to start/.test(l)) { idx = i; break }
  }
  if (idx === -1) {
    return { ok: false, code: 'source-anchor-moved', error: 'no "DECIDED — --mode all-out + --budget: the pre-flight refuses to start" clause found under §M6 in execution-modes.md' }
  }
  const raw = m6loc.allLines[idx]
  const m = /offers exactly three exits:\s*(.+?)\.\s+State this plainly/.exec(raw)
  const exits = m ? m[1].replace(/`/g, '').split(/,\s*(?:or\s+)?/).map((s) => s.trim()).filter(Boolean) : []
  return { ok: true, exits, citation: withResourceUri(citeM6Range(m6loc, idx + 1, idx + 1)) }
}

// ---------------------------------------------------------------------------
// Confirmation contract (:229-235). The exact quoted sentence is defined for --mode all-out only —
// §M6:164: "It does not fire in balanced mode at all." When the priced `mode` IS all-out, the sentence
// is reproduced verbatim with N/P/X/Y/A/B substituted, and the §M7a variant substituted verbatim when
// planner is fable and the DAG actually has a planner node. When `mode` is 'balanced' (the only other
// legal value once lite is refused), no literal §M6 sentence exists for that case; a derived analog is
// built from the same numbers and the departure from verbatim quoting is disclosed via `notes`
// (ADR-0005 I1 — never silently passed off as the located sentence).
// ---------------------------------------------------------------------------

function buildConfirmationPrompt({ m6loc, mode, compareTo, headline, compare, planner, hasPlannerNode, notes }) {
  const baseLine = findM6Line(m6loc, /^>\s*All-out mode: N agents across P phases/)
  const fableLine = findM6Line(m6loc, /^>\s*…loop-until-dry K=3/)
  const phaseWord = (n) => `phase${n === 1 ? '' : 's'}`
  const compareParenthetical = `(${compareTo} would be ${compare.tokensLow}–${compare.tokensHigh})`

  if (mode !== 'all-out') {
    notes.push(
      `confirmationPrompt is a DERIVED analog, not §M6's literal sentence: execution-modes.md:164 states the pre-flight "does not fire in balanced mode at all", so the exact template at execution-modes.md:231 is defined for --mode all-out only. The priced mode here is '${mode}', so the modifier-A / verifier-width / loop-until-dry / model-pin clauses (which describe all-out specifically) are omitted rather than misstated.`
    )
    const citation = baseLine === -1 ? null : withResourceUri(citeM6Range(m6loc, baseLine + 1, baseLine + 1))
    return {
      text: `${capitalize(mode)} mode: ${headline.agents} agents across ${headline.phases} ${phaseWord(headline.phases)}, est. ${headline.tokensLow}–${headline.tokensHigh} output tokens ${compareParenthetical}. Proceed?`,
      citation,
    }
  }

  if (baseLine === -1) {
    return { text: null, error: { code: 'source-anchor-moved', error: 'no confirmation-contract blockquote found under §M6 in execution-modes.md' } }
  }

  const tail =
    planner === 'fable' && hasPlannerNode && fableLine !== -1
      ? 'Modifier A disabled · verifier width 3 (5 on gating nodes) · loop-until-dry K=3 · every node pinned to claude-opus-5 except the planner, which runs claude-fable-5 (see the §M7 disclosure above). Proceed?'
      : 'Modifier A disabled · verifier width 3 (5 on gating nodes) · loop-until-dry K=3 · every node pinned to claude-opus-5. Proceed?'

  const citationLine = planner === 'fable' && hasPlannerNode && fableLine !== -1 ? fableLine : baseLine
  if (planner === 'fable' && !hasPlannerNode) {
    notes.push("planner:'fable' has no effect on confirmationPrompt: the DAG being priced has no taskType:'planner' node, so §M6's --planner fable substitution (execution-modes.md:233-235) never applies (§M7a's PLANNER override is scoped to taskType:'planner' nodes and nothing else).")
  }

  return {
    text: `All-out mode: ${headline.agents} agents across ${headline.phases} ${phaseWord(headline.phases)}, est. ${headline.tokensLow}–${headline.tokensHigh} output tokens ${compareParenthetical}. ${tail}`,
    citation: withResourceUri(citeM6Range(m6loc, citationLine + 1, citationLine + 1)),
  }
}

// ---------------------------------------------------------------------------
// Public: estimatePhase — the estimate_phase tool handler. Stops at the first error rather than
// returning a partial result (ADR-0005 I2 — exactly ok:true or a named ok:false).
// ---------------------------------------------------------------------------

function estimatePhase(rawInput, options = {}) {
  const root = options.root
  const sourceRoot = resolveRoot(root)

  const validation = validateInput(rawInput)
  if (validation.protocolError) return validation // -32602 seam — never the isError envelope
  const input = rawInput

  // --- mode / compareTo: accept five, advertise three, canonicalize, reject naming the three
  // (§M2:59, ADR-0005 §D5.3.1). Pure functions of CANONICAL_MODES — no doc read needed yet. ---
  const modeResult = resolveMode(input.mode)
  if (!modeResult.ok) {
    return {
      ok: false, tool: 'estimate_phase', authoringTimeOnly: true, serverVersion: SERVER_VERSION, sourceRoot,
      citations: [], deprecations: [], notes: [],
      error: { code: 'unknown_mode', message: `mode: ${modeResult.error}`, fix: `pass one of ${modeResult.valid.join(', ')} (or omit mode for the all-out default)`, fallback: ESTIMATE_PHASE_FALLBACK_TEXT },
    }
  }
  const mode = modeResult.mode === 'balanced' && modeResult.isDefault ? 'all-out' : modeResult.mode
  // ^ estimate_phase's own DECLARED default (tool-contracts.json D3.6) is 'all-out', not §M2:59's
  // 'balanced' — resolveMode()'s absent-input default is generic to modes.mjs (route_node's own
  // default, §M2:59). This tool's absent-`mode` case substitutes the TOOL's declared default instead,
  // which is legal under ADR-0005's absentIsLegal rule (a declared default for an absent argument is
  // not a failed lookup) — never applied when the caller supplied 'balanced' explicitly.
  const modeIsDefault = input.mode === undefined || input.mode === null || input.mode === ''

  const compareToResult = resolveMode(input.compareTo)
  if (!compareToResult.ok) {
    return {
      ok: false, tool: 'estimate_phase', authoringTimeOnly: true, serverVersion: SERVER_VERSION, sourceRoot,
      citations: [], deprecations: [], notes: [],
      error: { code: 'unknown_mode', message: `compareTo: ${compareToResult.error}`, fix: `pass one of ${compareToResult.valid.join(', ')} (or omit compareTo for the balanced default)`, fallback: ESTIMATE_PHASE_FALLBACK_TEXT },
    }
  }
  const compareTo = compareToResult.mode

  const deprecations = []
  const citations = []
  if (modeResult.alias) {
    deprecations.push({ field: 'mode', supplied: modeResult.supplied, canonical: modeResult.mode, removedIn: 'next major', message: DEPRECATION_MESSAGE })
  }
  if (compareToResult.alias) {
    deprecations.push({ field: 'compareTo', supplied: compareToResult.supplied, canonical: compareToResult.mode, removedIn: 'next major', message: DEPRECATION_MESSAGE })
  }

  // --- §M6 section locator, live, every call (ADR-0005 §D5.3.7 — no caching). Needed even for the
  // lite refusal below, since its citation points into this same section. ---
  const m6loc = locateM6Section(root)
  if (!m6loc.ok) {
    return structuralError({ sourceRoot, internalResult: m6loc, citations: [], fixText: 'set THELOOPSKILL_ROOT to a TheLoopSkill checkout, or correct the server path in .mcp.json' })
  }

  // --- D6.2: lite is an explicit unpriced refusal, never a silent balanced fallback. ---
  if (mode === 'lite' || compareTo === 'lite') {
    return liteRefusal({ sourceRoot, mode, compareTo, m6loc, nodes: input.nodes })
  }

  // --- §M6: locate + parse the formula fence, BAND table and SIZE sentence, live, every call. ---
  const m6 = readModesM6({ root })
  if (!m6.ok) {
    return structuralError({ sourceRoot, internalResult: m6, citations: [], fixText: "restore execution-modes.md §M6's BAND table / formula fence / SIZE sentence" })
  }

  const planner = input.planner === undefined ? 'opus' : input.planner
  const hasPlannerNode = input.nodes.some((n) => n.taskType === 'planner')

  // --- price the headline `mode`, then the `compareTo` mode, over the SAME node array (§M6:180's
  // "the pre-flight evaluates the whole expression twice"). Stop at the first per-node error rather
  // than returning a partial phase total (ADR-0005 I2). ---
  const headlinePriced = priceNodes(m6, input.nodes, { mode, planner })
  if (!headlinePriced.ok) {
    return priceErrorEnvelope({ sourceRoot, citations: dedupeCitations([withResourceUri(m6.formulaCitation), withResourceUri(m6.bandCitation)]), priceResult: headlinePriced, whichField: `mode='${mode}'` })
  }
  const comparePriced = priceNodes(m6, input.nodes, { mode: compareTo, planner })
  if (!comparePriced.ok) {
    return priceErrorEnvelope({ sourceRoot, citations: dedupeCitations([withResourceUri(m6.formulaCitation), withResourceUri(m6.bandCitation)]), priceResult: comparePriced, whichField: `compareTo='${compareTo}'` })
  }

  // --- assemble citations from both pricing passes, deduped. ---
  for (const n of [...headlinePriced.perNode, ...comparePriced.perNode]) {
    citations.push(n.citation, n._bandCitation, n._formulaCitation)
  }
  citations.push(withResourceUri(m6.sizeCitation))
  if (m6.bandRevisionCitation) citations.push(withResourceUri(m6.bandRevisionCitation))

  // --- perNode — strip the internal-only fields (_bandCitation/_formulaCitation) before exposing;
  // result.perNode's schema is additionalProperties:false and declares neither. ---
  const perNode = headlinePriced.perNode.map(({ ok: _ok, _bandCitation, _formulaCitation, ...pub }) => pub)

  const total = headlinePriced.total
  const comparisonTotal = comparePriced.total
  const ratioLow = total.tokensLow / comparisonTotal.tokensLow
  const ratioHigh = total.tokensHigh / comparisonTotal.tokensHigh

  // --- §M6:174/:175 — what changed, and the risks. Populated only when all-out is somewhere in the
  // priced pair (see extractM6Bullet's own header note above). ---
  const notes = []
  let whatModeChanged = []
  let risks = []
  if (mode === 'all-out' || compareTo === 'all-out') {
    const changed = extractM6Bullet(m6loc, /^3\.\s+\*\*What all-out mode changed\*\*/, 'flat')
    if (changed.ok) { whatModeChanged = changed.items; citations.push(changed.citation) }
    else notes.push('could not locate the §M6 "What all-out mode changed" bullet (execution-modes.md:174) — whatModeChanged is reported empty rather than guessed.')

    const risksResult = extractM6Bullet(m6loc, /^4\.\s+\*\*Risks worth naming before spending\*\*/, 'twoClause')
    if (risksResult.ok) { risks = risksResult.items; citations.push(risksResult.citation) }
    else notes.push('could not locate the §M6 "Risks worth naming before spending" bullet (execution-modes.md:175) — risks is reported empty rather than guessed.')
  } else {
    notes.push("whatModeChanged and risks are empty: both describe what --mode all-out changes relative to balanced (execution-modes.md:174-175), and neither mode nor compareTo is 'all-out' on this call.")
  }

  // --- §M6:256 DECIDED — the ≤15-agents-per-workflow guideline. Always computed (cheap, always
  // computable from `total.agents`), per the task's explicit "the guideline wins" instruction. ---
  const guideline = locateAgentGuidelineClause(m6loc)
  const agentGuidelineBreach = guideline.ok
    ? { exceeds: total.agents > 15, guideline: 15, instruction: guideline.instruction }
    : { exceeds: total.agents > 15, guideline: 15 }
  if (guideline.ok) citations.push(guideline.citation)
  else notes.push(`could not locate §M6's ≤15-agents-per-workflow DECIDED clause (execution-modes.md:256) — agentGuidelineBreach.exceeds is still reported, but with no instruction text.`)

  // --- §M6:258 DECIDED — --budget refusal. Only present when budgetTokens was actually supplied
  // (ADR-0005 absentIsLegal — an absent optional field is not a failed lookup). ---
  let budgetRefusal
  if (input.budgetTokens !== undefined) {
    const budgetClause = locateBudgetRefusalClause(m6loc)
    const refuses = total.tokensHigh > input.budgetTokens
    budgetRefusal = budgetClause.ok ? { refuses, exits: budgetClause.exits } : { refuses }
    if (budgetClause.ok) citations.push(budgetClause.citation)
    else notes.push("could not locate §M6's --budget DECIDED clause (execution-modes.md:258) — budgetRefusal.refuses is still reported, but with no exits text.")
  }

  // --- confirmation contract (:229-235). ---
  const confirmation = buildConfirmationPrompt({
    m6loc, mode, compareTo,
    headline: total, compare: comparisonTotal,
    planner, hasPlannerNode, notes,
  })
  if (confirmation.error) {
    return structuralError({ sourceRoot, internalResult: confirmation.error, citations: dedupeCitations(citations), fixText: "restore execution-modes.md §M6's confirmation-contract blockquote (:229-235)" })
  }
  if (confirmation.citation) citations.push(confirmation.citation)

  const estimateBlock = `const ESTIMATE = { agents: ${total.agents}, tokensLow: ${total.tokensLow}, tokensHigh: ${total.tokensHigh}, mode: ${JSON.stringify(mode)} }`

  const result = {
    mode,
    compareTo,
    perNode,
    total,
    comparison: { mode: compareTo, agents: comparisonTotal.agents, tokensLow: comparisonTotal.tokensLow, tokensHigh: comparisonTotal.tokensHigh, ratioLow, ratioHigh },
    whatModeChanged,
    risks,
    agentGuidelineBreach,
    confirmationPrompt: confirmation.text,
    requiresHumanConfirmation: true,
    estimateBlock,
    bandRevision: m6.bandRevision,
    calibrationWarning: CALIBRATION_WARNING,
  }
  if (budgetRefusal !== undefined) result.budgetRefusal = budgetRefusal

  return {
    ok: true,
    tool: 'estimate_phase',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    result,
    citations: dedupeCitations(citations),
    deprecations,
    notes,
  }
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/estimate_phase.mjs").then(m => console.log(JSON.stringify(m.estimatePhase({nodes:[{label:"verify-sweep",taskType:"verify",nodeShape:"adversarial-verify",fanOut:5,askIsThorough:true}]}), null, 2)))'
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------

export {
  estimatePhase,
  validateInput,
  priceOneNode,
  priceNodes,
  liteRefusal,
  extractM6Bullet,
  locateAgentGuidelineClause,
  locateBudgetRefusalClause,
  buildConfirmationPrompt,
  DEFAULT_ROOT,
  CALIBRATION_WARNING,
  DEPRECATION_MESSAGE,
  ESTIMATE_PHASE_FALLBACK_TEXT,
}
