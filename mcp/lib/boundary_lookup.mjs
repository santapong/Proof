// mcp/lib/boundary_lookup.mjs — the boundary_lookup MCP tool handler (Phase 3, S3), composed over
// the Phase-2 spine's mcp/lib/boundary.mjs, which already implements ADR-0007 (D7) §D7.1-§D7.5 in
// full: the speech-act rule (ranked `candidates[]`, never an `owner` field — D7.1), the own-fields-
// only corpus with `useInsteadWhen` reported as diverting evidence rather than folded into a score
// (D7.2), the exact-integer BigInt-rational score (D7.3), the discriminating-term `unowned` predicate
// (D7.4) and both directions of every edge (D7.5).
//
// boundary.mjs's own file-bottom comment ("Not implemented here") names exactly three pieces of D7
// as left "to the tool layer, which already composes multiple mcp/lib readers" — this file is that
// tool layer, and it adds precisely those three plus the ADR-0003 §D3.1 envelope every tool wraps
// its answer in:
//
//   - §D7.6 separatingQuestion — the pairwise {pair, margin, propositions[], reciprocal, oneWay,
//     ratedOverlap, storedDiscriminator} object for every adjacent pair in the returned shortlist.
//   - §D7.7 descriptionIsStale — compares the live `.claude/skills/<skill>/SKILL.md` frontmatter
//     description against the audit's approved text, never the other way round (§D7.7: "one
//     authority in the ranking" — the SCORE reads only the approved text; this field is the ONLY
//     place the live text is read, and only to report drift, never to score).
//   - §D7.8 auditIntegrity — the required-on-every-answer summary of the audit file's own debt
//     (edge counts, one-way edges, zero-in-degree skills, missing descriptions, missing overlaps,
//     unstored pairs), computed live from the same parse boundary.mjs already did.
//
// ============================================================================================
// ARCHITECTURE NOTE — same disclosed departure mcp/lib/route_node.mjs (S1) and
// mcp/lib/estimate_phase.mjs (S2) already took, for the same reason: a tool-handler layer built
// explicitly ON TOP OF the spine composes the spine via relative import, while sibling SPINE modules
// (modes.mjs, estimate.mjs, boundary.mjs, standards.mjs) still do not import one another. Every
// import below that is not mcp/lib/boundary.mjs is node:-only, per ADR-0002 §D2.1.
// ============================================================================================
//
// DIVERGENCE FROM THE STALE mcp/tool-contracts.json §D3.6 boundary_lookup entry, disclosed rather
// than silently reconciled — same posture route_node.mjs took for §D6.1's width structure and
// estimate_phase.mjs took for §M6's shape. §D3.6 predates ADR-0007 and describes a DIFFERENT tool:
// a `matches[]` array scored over "scope, useInsteadWhen conditions, overlap risk and resolution"
// (measured WRONG by ADR-0007 §4 — it inverts the ranking), an `against` param restricting overlaps
// to one pair, and an `include[]` param gating which fields come back. ADR-0007 §D7 explicitly
// REFINES and supersedes that entry (its own opening line: "It refines ADR-0003 §D3.6's
// `boundary_lookup` entry, which declared a `query` input ... and stopped there") and its own
// §D7_7_oneAuthorityInTheRanking records that the one concrete edit §D3.6 needs (descriptionIsStale
// boolean -> `"current"|"drifted"|"unrecorded"` enum) is "notApplied ... queued here alongside D5's
// unknown_task_kind and D6's width_undetermined / mode_not_priceable" — i.e. tool-contracts.json is
// known-stale and its repair is out of scope for this task (§D7_12_notRuledHere's last bullet: "Any
// change to mcp/tool-contracts.json. D7_7 specifies one edit verbatim and does not apply it."). This
// file therefore implements §D7's actual ruling — `candidates[]`/`outcome`/`authority`, no `against`,
// no `include` gate — not §D3.6's superseded wording. `against` and `include` are accepted as
// UNKNOWN properties would be under the OLD schema, but since this handler defines its own input
// shape (mirroring boundary.mjs's own `{skill, query, limit}` signature) they are simply not read.
//
// Per ADR-0005 (no silent default): every field of every ok:true result is either read straight
// through from boundary.mjs's already-validated result, or located fresh HERE by the same
// coordinate-first discipline (fence/heading-anchored, never a tree-wide content search) route_node.mjs
// and estimate_phase.mjs already use. `descriptionIsStale` gets a FOURTH state, `live_unreadable`,
// beyond §D7.7's ruled three (`current`/`drifted`/`unrecorded`) — disclosed here because §D7.7's three
// states all presuppose the live SKILL.md is readable (measured true for all 21 skills as of
// ADR-0007), and silently forcing an unreadable file into "current" or "unrecorded" would assert a
// fact this module could not check, which is exactly what ADR-0005 I1 forbids.
//
// Per ADR-0005 §D5.3.6: no clock, no randomness anywhere in this file's reachable code. Two identical
// calls return byte-identical structuredContent, inherited from boundary.mjs's own determinism
// (§D7.10) plus this file's own live reads, which are pure functions of the tree's bytes.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  readBoundaryAudit,
  boundaryLookup as spineBoundaryLookup,
  AUTHORITY,
  DEFAULT_ROOT as SPINE_DEFAULT_ROOT,
} from './boundary.mjs'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / boundary.mjs / route_node.mjs / estimate_phase.mjs):
// small, universal helpers are re-declared per file, anchored to the source file rather than to a
// sibling module.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const SERVER_VERSION = '0.2.0'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to every other mcp/lib file's own copy.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

function resourceUri(file) {
  return `proof://${file}`
}

function dedupeCitations(list) {
  const seen = new Set()
  const out = []
  for (const c of list) {
    if (!c) continue
    const key = `${c.file}:${c.startLine}-${c.endLine}:${c.section}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

// ---------------------------------------------------------------------------
// §D7.7 — read the LIVE `.claude/skills/<skill>/SKILL.md` frontmatter `description` key. This is the
// ONLY place in the boundary_lookup surface that reads the live SKILL.md rather than the audit JSON
// (§D7.7's "one authority in the ranking": the SCORE never reads this; only descriptionIsStale does).
//
// A narrow, hand-rolled scalar parser covering exactly the `description:` key — NOT the whole
// scripts/validate.mjs parseFrontmatter() surface, and deliberately not imported from there: ADR-0002
// §D2.1 requires every import specifier reachable from mcp/ to begin with `node:`, and
// scripts/validate.mjs is outside mcp/ and is not a node: specifier. Same duplicate-the-small-helper
// posture boundary.mjs's own header takes toward modes.mjs/estimate.mjs.
// ---------------------------------------------------------------------------

function skillMdPath(root, skill) {
  return path.join(resolveRoot(root), '.claude', 'skills', skill, 'SKILL.md')
}

function parseDescriptionScalar(raw) {
  if (raw[0] === '"') {
    const m = /^"((?:[^"\\]|\\.)*)"$/.exec(raw)
    if (!m) return null
    return m[1].replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
  }
  if (raw[0] === "'") {
    const m = /^'((?:[^']|'')*)'$/.exec(raw)
    if (!m) return null
    return m[1].replace(/''/g, "'")
  }
  return raw
}

function readLiveDescription(root, skill) {
  const file = skillMdPath(root, skill)
  const relFile = relPosix(root, file)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return { ok: false, error: `cannot read ${relFile}: ${e.code === 'ENOENT' ? 'no such file' : e.message}` }
  }
  const ls = toLines(text)
  if (ls[0] !== '---') {
    return { ok: false, error: `${relFile} does not open with a "---" frontmatter fence on line 1` }
  }
  let end = -1
  for (let i = 1; i < ls.length; i++) {
    if (ls[i] === '---' || ls[i] === '...') { end = i; break }
  }
  if (end === -1) return { ok: false, error: `${relFile}'s frontmatter fence is never closed` }
  let descLine = -1
  for (let i = 1; i < end; i++) {
    if (/^description:\s*/.test(ls[i])) { descLine = i; break }
  }
  if (descLine === -1) return { ok: false, error: `${relFile}'s frontmatter has no "description" key` }
  const raw = ls[descLine].replace(/^description:\s*/, '').trim()
  const value = parseDescriptionScalar(raw)
  if (value === null) {
    return { ok: false, error: `${relFile}:${descLine + 1} — the "description" value did not parse as a single scalar (unterminated quote?)` }
  }
  const lineNo = descLine + 1
  return {
    ok: true,
    value,
    citation: {
      file: relFile,
      section: '`description` frontmatter key',
      startLine: lineNo,
      endLine: lineNo,
      sha256: sha256OfLines(ls, lineNo, lineNo),
      resourceUri: resourceUri(relFile),
    },
  }
}

// §D7.7 — "unrecorded" when the audit never approved a description for this skill (3 skills, measured
// today: loop-skill, loop-frontend, loop-build); "current"/"drifted" by exact string comparison against
// the approved text when one exists; "live_unreadable" — the disclosed 4th state (see file header) —
// when an approved text exists but the live SKILL.md could not be read/parsed to compare against it.
function computeDescriptionIsStale(root, skill, approvedDescription) {
  if (approvedDescription === null || approvedDescription === undefined) {
    return { state: 'unrecorded', liveDescription: null, liveCitation: null, note: null }
  }
  const live = readLiveDescription(root, skill)
  if (!live.ok) {
    return {
      state: 'live_unreadable',
      liveDescription: null,
      liveCitation: null,
      note: `descriptionIsStale for '${skill}' could not compare against the live SKILL.md: ${live.error}. The approved text is reported; whether it is current is unknown, not assumed.`,
    }
  }
  return {
    state: live.value === approvedDescription ? 'current' : 'drifted',
    liveDescription: live.value,
    liveCitation: live.citation,
    note: null,
  }
}

// ---------------------------------------------------------------------------
// §D7.8 — the required auditIntegrity block, computed LIVE from the same parse boundary.mjs's
// readBoundaryAudit() already did (passed in as `read`, never re-derived from a hand count). Every
// field name matches mcp/boundary-match-contract.json D7_8_auditIntegrity.requiredFields verbatim.
// ---------------------------------------------------------------------------

function computeAuditIntegrity(root, read) {
  const N = read.matrix.length

  const edgeSet = new Set()
  let edgeCount = 0
  for (const row of read.matrix) {
    for (const edge of row.useInsteadWhen) {
      edgeCount++
      edgeSet.add(`${row.skill}>${edge.otherSkill}`)
    }
  }

  let reciprocalEdges = 0
  let oneWayEdges = 0
  for (const key of edgeSet) {
    const [a, b] = key.split('>')
    if (edgeSet.has(`${b}>${a}`)) reciprocalEdges++
    else oneWayEdges++
  }

  const inDegree = new Map(read.matrix.map((r) => [r.skill, 0]))
  for (const row of read.matrix) {
    for (const edge of row.useInsteadWhen) {
      if (inDegree.has(edge.otherSkill)) inDegree.set(edge.otherSkill, inDegree.get(edge.otherSkill) + 1)
    }
  }
  const zeroInDegreeSkills = read.matrix.filter((r) => (inDegree.get(r.skill) || 0) === 0).map((r) => r.skill)

  const overlapCount = read.overlaps.length
  const ratedOverlapsOneWayInMatrix = []
  read.overlaps.forEach((o, idx) => {
    const aToB = edgeSet.has(`${o.skillA}>${o.skillB}`)
    const bToA = edgeSet.has(`${o.skillB}>${o.skillA}`)
    if (aToB !== bToA) {
      ratedOverlapsOneWayInMatrix.push({
        index: idx,
        pair: `${o.skillA}|${o.skillB}`,
        severity: o.severity,
        storedOnlyOn: aToB ? o.skillA : o.skillB,
        citation: o.citation,
      })
    }
  })

  const approvedDescSkills = new Set(read.descriptionRewrites.map((d) => d.skill))
  const skillsWithNoApprovedDescription = read.matrix.filter((r) => !approvedDescSkills.has(r.skill)).map((r) => r.skill)

  const overlapTouchSet = new Set()
  for (const o of read.overlaps) { overlapTouchSet.add(o.skillA); overlapTouchSet.add(o.skillB) }
  const skillsWithNoRatedOverlap = read.matrix.filter((r) => !overlapTouchSet.has(r.skill)).map((r) => r.skill)

  let pairsWithNoStoredDiscriminator = 0
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = read.matrix[i].skill
      const b = read.matrix[j].skill
      if (!edgeSet.has(`${a}>${b}`) && !edgeSet.has(`${b}>${a}`)) pairsWithNoStoredDiscriminator++
    }
  }

  // descriptionDrift — computed over EVERY approved-description row, not only candidates in the
  // current shortlist: §D7.8 requires this block on every answer, and a caller who never happens to
  // rank loop-algo or loop-operate into their shortlist should still see that the audit has 2 drifted
  // descriptions somewhere. Costs 18 extra live reads per call (measured cheap: readLiveDescription is
  // one small file read + a short linear scan, well inside boundary.mjs's own ~1.5ms/call budget).
  const descriptionDrift = []
  for (const d of read.descriptionRewrites) {
    const live = readLiveDescription(root, d.skill)
    if (live.ok && live.value !== d.newDescription) descriptionDrift.push(d.skill)
  }

  return {
    matrixSize: N,
    edgeCount,
    reciprocalEdges,
    oneWayEdges,
    zeroInDegreeSkills,
    overlapCount,
    ratedOverlapsOneWayInMatrix,
    skillsWithNoApprovedDescription,
    skillsWithNoRatedOverlap,
    pairsWithNoStoredDiscriminator,
    descriptionDrift,
  }
}

// ---------------------------------------------------------------------------
// §D7.6 — the pairwise separating question for one adjacent pair in the shortlist. Both candidates
// passed in are already the AUGMENTED candidates this file builds (descriptionIsStale attached), but
// only their spine-provided fields (`useInsteadWhen`, `overlapsTouching`, `score`) are read here.
//
// margin is computed from the DISPLAYED decimal score strings, never from a raw rational kept out of
// boundary.mjs's public surface. This mirrors §D7.3's own displayNormaliser rule: "applied ONLY to the
// displayed `score` ... never to the ordering" — margin here is explicitly a REPORTED field (§D7.6:
// "REPORTED not used as a gate"), so it inherits the same never-load-bearing status the display score
// already has, and is not part of any comparison path ADR-0005 §D5.4 governs.
// ---------------------------------------------------------------------------

function buildSeparatingQuestion(a, b) {
  const scoreA = parseFloat(a.score)
  const scoreB = parseFloat(b.score)
  const margin = scoreA !== 0 ? Number(((scoreA - scoreB) / scoreA).toFixed(4)) : 0

  const propositions = []
  const aToB = a.useInsteadWhen.find((e) => e.otherSkill === b.skill)
  if (aToB) {
    propositions.push({
      storedOn: a.skill,
      proposition: aToB.condition,
      ifTrue: b.skill,
      ifFalse: a.skill,
      pointer: aToB.citation.section,
      citation: aToB.citation,
    })
  }
  const bToA = b.useInsteadWhen.find((e) => e.otherSkill === a.skill)
  if (bToA) {
    propositions.push({
      storedOn: b.skill,
      proposition: bToA.condition,
      ifTrue: a.skill,
      ifFalse: b.skill,
      pointer: bToA.citation.section,
      citation: bToA.citation,
    })
  }

  const reciprocal = Boolean(aToB) && Boolean(bToA)
  const oneWay = Boolean(aToB) !== Boolean(bToA)
  const storedDiscriminator = propositions.length > 0

  const ratedOverlapEntry =
    a.overlapsTouching.find((o) => o.other === b.skill) ||
    b.overlapsTouching.find((o) => o.other === a.skill) ||
    null
  const ratedOverlap = ratedOverlapEntry
    ? { severity: ratedOverlapEntry.severity, pointer: ratedOverlapEntry.citation.section, citation: ratedOverlapEntry.citation }
    : null

  const notes = []
  if (!storedDiscriminator) {
    notes.push(
      `No stored discriminator exists between '${a.skill}' and '${b.skill}' in either direction — an audit gap against .claude/skills/loop-skill/SKILL.md:47's "for every rated overlap, on both sides" rule (ADR-0007 §D7.6's null-branch: 161 of 210 unordered pairs measured with none today). Do not infer a boundary that is not stored; read docs/design/boundary-audit.json by hand for this pair.`
    )
  }

  return { pair: [a.skill, b.skill], margin, propositions, reciprocal, oneWay, ratedOverlap, storedDiscriminator, notes }
}

// ---------------------------------------------------------------------------
// Envelope constants (ADR-0003 §D3.5's `fallback` field — the manual procedure with the server
// absent, same grammar as route_node.mjs's FALLBACK_TEXT / estimate_phase.mjs's
// ESTIMATE_PHASE_FALLBACK_TEXT).
// ---------------------------------------------------------------------------

const BOUNDARY_LOOKUP_FALLBACK_TEXT =
  'Read docs/design/boundary-audit.json by hand: /matrix (21 rows) for scope + useInsteadWhen edges, /overlaps (28 rows) for rated pairwise conflicts with resolutions, /descriptionRewrites (18 rows) for approved description text. Per docs/design/README.md the file OUTRANKS any plan or build manifest — but it is evidence to weigh, never an owner to copy: no line in it says which skill owns a task.'

// ---------------------------------------------------------------------------
// Input validation — ADR-0005 D5.2's precondition, enforced in code because ADR-0001's hand-rolled
// zero-dependency server supplies no JSON-Schema validation of its own (same posture as
// route_node.mjs's / estimate_phase.mjs's own validateInput). Absence of BOTH `skill` and `query` is
// a domain-level `invalid_argument` (mcp/lib/boundary.mjs's own boundaryLookup() already reports it
// with a fix), not a -32602 shape violation — the two are individually optional properties, so no
// `required` array is violated; it is the anyOf that fails, which is semantic, not structural. TYPE
// mismatches on a supplied property ARE shape violations, per route_node.mjs's precedent.
// ---------------------------------------------------------------------------

function protocolError(field, message) {
  return { protocolError: true, jsonRpcCode: -32602, field, message }
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return protocolError(null, 'boundary_lookup requires an object argument')
  }
  if (input.skill !== undefined && typeof input.skill !== 'string') {
    return protocolError('skill', `skill must be a string; got ${typeof input.skill}`)
  }
  if (input.query !== undefined && typeof input.query !== 'string') {
    return protocolError('query', `query must be a string; got ${typeof input.query}`)
  }
  if (input.limit !== undefined && !(Number.isInteger(input.limit) && input.limit >= 1)) {
    return protocolError('limit', `limit must be a positive integer; got ${JSON.stringify(input.limit)}`)
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Public: boundaryLookup — the boundary_lookup tool handler. Composes mcp/lib/boundary.mjs's
// exact-lookup and ranked-lookup modes, then adds §D7.6/§D7.7/§D7.8 and the ADR-0003 §D3.1 envelope.
// Stops at the first structural failure rather than returning a partial result (ADR-0005 I2 — exactly
// ok:true or a named ok:false).
// ---------------------------------------------------------------------------

function boundaryLookup(rawInput, options = {}) {
  const root = options.root
  const sourceRoot = resolveRoot(root)

  const validation = validateInput(rawInput)
  if (validation.protocolError) return validation // -32602 seam — never the isError envelope
  const input = rawInput || {}

  const lookup = spineBoundaryLookup(root, { skill: input.skill, query: input.query, limit: input.limit })
  if (!lookup.ok) {
    return {
      ok: false,
      tool: 'boundary_lookup',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      // boundary.mjs's own codes (invalid_argument / source_missing / source_unparseable / not_found)
      // are already members of ADR-0003 §D3.5's closed error-code enum — unlike route_node.mjs, no
      // ADR-0004 semantic-tier mapping layer is needed here.
      citations: [], // disclosed empty citations on a totally unreadable/unparseable source — same
      // OPEN QUESTION route_node.mjs's structuralError() documents: D3.1 wants minItems:1 on both
      // branches, but fabricating a citation over bytes that were never successfully read would be
      // the exact silent default ADR-0005 I1 forbids.
      deprecations: [],
      notes: [],
      error: {
        code: lookup.code,
        message: lookup.error,
        fix: lookup.fix,
        fallback: BOUNDARY_LOOKUP_FALLBACK_TEXT,
      },
    }
  }

  // Second live read for §D7.8's auditIntegrity (and for description-approval citations below).
  // boundary.mjs's own "READ LIVE, NEVER SNAPSHOT" posture already pays this cost more than once per
  // call elsewhere (route_node.mjs's m8loc_block_text re-locates §M8 a second time for the same
  // reason) — cheap at boundary.mjs's own measured ~1.478ms/parse (§D7.10).
  const read = readBoundaryAudit(root)
  if (!read.ok) {
    // Extremely unlikely — spineBoundaryLookup() just read the same file moments ago successfully —
    // but per ADR-0005 I2, never silently omit auditIntegrity; surface the mismatch instead.
    return {
      ok: false,
      tool: 'boundary_lookup',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      citations: [],
      deprecations: [],
      notes: [],
      error: {
        code: read.code === 'source_missing' ? 'source_missing' : 'source_unparseable',
        message: `boundary_lookup's own ranked/exact answer succeeded, but a second live read for auditIntegrity failed: ${read.error}`,
        fix: read.fix,
        fallback: BOUNDARY_LOOKUP_FALLBACK_TEXT,
      },
    }
  }

  const descBySkill = new Map(read.descriptionRewrites.map((d) => [d.skill, d]))
  const auditIntegrity = computeAuditIntegrity(root, read)
  const citations = []
  const notes = [...(lookup.notes || [])]

  function attachStaleness(candidate) {
    const stale = computeDescriptionIsStale(root, candidate.skill, candidate.approvedDescription)
    citations.push(candidate.citation)
    candidate.useInsteadWhen.forEach((e) => citations.push(e.citation))
    candidate.pointedAtBy.forEach((e) => citations.push(e.citation))
    candidate.overlapsTouching.forEach((e) => citations.push(e.citation))
    if (Array.isArray(candidate.divertedBy)) candidate.divertedBy.forEach((e) => citations.push(e.citation))
    const descRow = descBySkill.get(candidate.skill)
    if (descRow) citations.push(descRow.citation)
    if (stale.liveCitation) citations.push(stale.liveCitation)
    if (stale.note) notes.push(stale.note)
    return { ...candidate, descriptionIsStale: stale.state, liveDescription: stale.liveDescription }
  }

  if (lookup.outcome === 'exact') {
    const candidateOut = attachStaleness(lookup.candidate)
    return {
      ok: true,
      tool: 'boundary_lookup',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      result: {
        outcome: 'exact',
        matrixSize: lookup.matrixSize,
        authority: lookup.authority,
        candidate: candidateOut,
        auditIntegrity,
      },
      citations: dedupeCitations(citations),
      deprecations: [],
      notes,
    }
  }

  // outcome === 'candidates' | 'unowned' — both are ranked shortlists (§D7.1 rule 2: candidates.length
  // >= 2 whenever outcome is 'candidates'; §D7.4: 'unowned' still returns the top 3, never empty).
  const candidatesOut = lookup.candidates.map(attachStaleness)

  const separatingQuestions = []
  for (let i = 0; i < candidatesOut.length - 1; i++) {
    const sq = buildSeparatingQuestion(candidatesOut[i], candidatesOut[i + 1])
    sq.propositions.forEach((p) => citations.push(p.citation))
    if (sq.ratedOverlap) citations.push(sq.ratedOverlap.citation)
    if (sq.notes.length) notes.push(...sq.notes)
    separatingQuestions.push(sq)
  }

  const result = {
    outcome: lookup.outcome,
    query: lookup.query,
    queryDiscriminatingTerms: lookup.queryDiscriminatingTerms,
    topDiscriminatingCount: lookup.topDiscriminatingCount,
    dfMax: lookup.dfMax,
    matrixSize: lookup.matrixSize,
    candidates: candidatesOut,
    separatingQuestions,
    authority: lookup.authority,
    auditIntegrity,
  }
  if (lookup.outcome === 'unowned') {
    result.decompositionSmell = lookup.decompositionSmell
  }

  return {
    ok: true,
    tool: 'boundary_lookup',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    result,
    citations: dedupeCitations(citations),
    deprecations: [],
    notes,
  }
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/boundary_lookup.mjs").then(m => console.log(JSON.stringify(m.boundaryLookup({query:"design a system architecture"}), null, 2)))'
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------

export {
  boundaryLookup,
  validateInput,
  computeDescriptionIsStale,
  computeAuditIntegrity,
  buildSeparatingQuestion,
  readLiveDescription,
  DEFAULT_ROOT,
  SPINE_DEFAULT_ROOT,
  BOUNDARY_LOOKUP_FALLBACK_TEXT,
  AUTHORITY,
}
