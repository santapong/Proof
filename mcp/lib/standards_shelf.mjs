// mcp/lib/standards_shelf.mjs — the standards_shelf MCP tool handler (Phase 3, S4), composed over
// the Phase-2 spine's mcp/lib/standards.mjs, which already implements the shelf reader in full: the
// per-shelf table parser with its D5.3.5 whole-section-atomicity rule (parsed:true rows or a raw
// unparsedSections entry, never a half-parsed table), the three-grade normalizer (yes/draft/no —
// D3.6's `entries[].grade` enum), the confirmation-log locator (heading shape and inline shape, last-
// match-wins), and the two-mode search composition (`skill` narrows to one shelf, `query` free-texts
// across all 21).
//
// standards.mjs's own file-bottom "Not implemented here" note names exactly one piece it deliberately
// leaves "to the tool layer" (its own words, echoing boundary.mjs's identical convention that
// mcp/lib/boundary_lookup.mjs already picked up for §D7.6-§D7.8): `recheckCadence`. Its reasoning is
// that the 21 shelves phrase their re-check cadence in free prose with no SINGLE consistent shape, so
// picking "the" cadence sentence out of a shelf that states several would be exactly the guess
// ADR-0005 forbids — UNLESS a shape is narrow enough to locate by coordinate rather than by judgment.
// Grepping all 21 shelves (Phase 3 S4 research pass, repo head at task start) turns up exactly that
// narrow shape in 13 of 21 shelves: a bold-led line beginning `**Re-check` (bullet or numbered-item
// prefix tolerated — loop-algo/loop-autopilot/loop-docs/loop-harness/loop-incident/loop-integrate/
// loop-operate/loop-pattern/loop-review/loop-scout/loop-ship/loop-skill), or, for loop-design alone, an
// H2 heading whose text contains "re-check" ("## Re-check cadence and confirmation log"), where the
// cadence sentence is the section's first paragraph. The remaining 8 shelves (loop-audit, loop-debug,
// loop-engine, loop-frontend, loop-orchestrate, loop-research, loop-test, loop-v1) either never mention
// re-checking at all, or only in ordinary (non-bold) prose with no anchor a coordinate walk can pick
// out without guessing WHICH sentence is "the" cadence — those correctly come back with
// recheckCadence:null and an explained reason, never a guess. This module implements exactly that
// narrow, coordinate-first extraction: heading shape tried first (matching locateConfirmationLog's own
// precedence rule), then the bold-inline shape with last-match-wins (the same "at the foot" rule
// locateConfirmationLog already established, needed here too — loop-ship has TWO bold "**Re-check"
// lines, one about a report-year detail at line 28 and the real shelf-level cadence note at line 80).
//
// ============================================================================================
// ARCHITECTURE NOTE — same disclosed departure mcp/lib/route_node.mjs (S1), mcp/lib/estimate_phase.mjs
// (S2) and mcp/lib/boundary_lookup.mjs (S3) already took: a tool-handler layer built explicitly ON TOP
// of the spine composes the spine via relative import, while sibling SPINE modules (modes.mjs,
// estimate.mjs, boundary.mjs, standards.mjs) still do not import one another. Every import below that
// is not mcp/lib/standards.mjs is node:-only, per ADR-0002 §D2.1.
// ============================================================================================
//
// DISCLOSED GAP #1 — entries[].parsed:false. mcp/tool-contracts.json's D3.6 standards_shelf
// resultSchema describes `entries[].parsed` as "true = a Markdown table row was parsed into fields.
// false = the section is prose and rawText carries it" — i.e. the schema tolerates unparsed content
// living IN `entries` too. The spine never does this: standards.mjs's readStandardsShelf() puts every
// parsed row in `entries` (always parsed:true) and every unparsed section in the SEPARATE
// `unparsedSections` array, never both, and never a parsed:false entry. This file follows the spine's
// actual shape rather than reconciling the schema's more permissive description — duplicating the same
// content into both arrays would not be "implementing" the schema's tolerance, it would be inventing a
// second copy of data the spine does not produce, which is a form of the fabrication ADR-0005 forbids
// as surely as inventing a row that was never there. `entries` here is therefore always parsed:true;
// unparsed content is exclusively in `unparsedSections`, which the D3.6 schema separately marks
// REQUIRED for exactly this reason ("Omitting this turns a parser limitation into an apparent absence
// of standards").
//
// DISCLOSED GAP #2 — citations minItems:1 on an ok:true zero-match query. D3.1 requires citations to
// carry at least one entry on EVERY envelope, both branches. A single-skill lookup always clears this:
// the confirmation log is present in 21 of 21 shelves (measuredHeterogeneity), so shelfConfirmation's
// own citation is always available even when `entries`/`unparsedSections` both come back empty (e.g. a
// grade filter that matches nothing on that shelf). A global `query` search that matches NOTHING in any
// of the 21 shelves has no such fallback — no row, no unparsed section, no shelfConfirmation (query mode
// does not return one; see standards.mjs's own searchStandards()). Fabricating a citation over bytes
// that played no part in producing the answer would be exactly the silent default ADR-0005 I1 forbids,
// so this file leaves `citations: []` in that one genuinely-empty case rather than inventing one — the
// same disclosed choice mcp/lib/boundary_lookup.mjs already made for its own unreadable-source branch.
// OPEN QUESTION for whoever tightens D3.1: either the envelope schema needs a documented exception for
// a true empty-result query, or `citations` needs to drop minItems:1 for this one shape.
//
// Per ADR-0005 (no silent default): every field of every ok:true result is either read straight through
// from standards.mjs's already-validated result, or located fresh HERE by the same coordinate-first
// discipline (heading -> bounded section -> anchored line, never a tree-wide content search) every
// other mcp/lib file already uses. Per ADR-0005 §D5.3.6: no clock, no randomness anywhere in this
// file's reachable code — inherited from standards.mjs's own "READ LIVE, NEVER SNAPSHOT" posture (every
// call re-reads every file touched; nothing is cached across calls).

import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  searchStandards,
  locateStandardsDoc,
  splitH2Sections,
  locateConfirmationLog,
  DEFAULT_ROOT as SPINE_DEFAULT_ROOT,
} from './standards.mjs'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / boundary.mjs / standards.mjs / route_node.mjs /
// estimate_phase.mjs / boundary_lookup.mjs): small, universal helpers are re-declared per file,
// anchored to the source file rather than to a sibling module. None of these are exported by
// standards.mjs (its own export list has no citeSpan/sha256OfLines), so this file carries its own
// byte-identical copies rather than reaching into the spine's private internals.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const SERVER_VERSION = '0.1.0'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to every other mcp/lib file's own copy,
  // including standards.mjs's own sha256OfLines this duplicates rather than imports.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

function resourceUri(file) {
  return `theloopskill://${file}`
}

function citeSpanLocal(relFile, lines, section, startLine, endLine) {
  // Byte-identical algorithm to standards.mjs's own (private) citeSpan(), duplicated here because it
  // is not exported — same posture boundary_lookup.mjs's own sha256OfLines/citeRange copies take.
  const excerptFull = lines.slice(startLine - 1, endLine).join('\n')
  const truncated = excerptFull.length > 2000
  return {
    file: relFile,
    section,
    startLine,
    endLine,
    sha256: sha256OfLines(lines, startLine, endLine),
    excerpt: truncated ? excerptFull.slice(0, 2000) : excerptFull,
    excerptTruncated: truncated,
    resourceUri: resourceUri(relFile),
  }
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
// recheckCadence extraction — see the file header for the full rationale and the measured 13/21
// coverage. Two shapes, tried in order, mirroring locateConfirmationLog's own precedence rule exactly
// (heading shape first, because a heading changes what content to return; inline shape second, with
// last-match-wins for "at the foot" shelves like loop-ship that mention "**Re-check" twice for two
// different things).
// ---------------------------------------------------------------------------

const RECHECK_HEADING_RE = /re-check/i
const RECHECK_INLINE_RE = /^(?:-\s+|\d+\.\s+)?\*\*Re-check\b/

// The first contiguous non-blank paragraph starting at or after `from0` (0-indexed), bounded above by
// `endExclusive0` (0-indexed, exclusive — a splitH2Sections() section's 1-indexed `endLine` used
// directly as the exclusive 0-indexed bound). Returns null if the span is entirely blank.
function firstParagraphBounds(lines, from0, endExclusive0) {
  let i = from0
  while (i < endExclusive0 && lines[i].trim() === '') i++
  if (i >= endExclusive0) return null
  const start0 = i
  while (i < endExclusive0 && lines[i].trim() !== '') i++
  return { start0, end0: i } // end0 is 0-indexed, exclusive
}

function locateRecheckCadence(relFile, lines, skill) {
  const { sections } = splitH2Sections(lines)
  const headingSection = sections.find((s) => RECHECK_HEADING_RE.test(s.heading))

  if (headingSection) {
    // headingSection.headingLine is the heading's own 1-indexed line number; the first content line
    // after it sits at 0-indexed array position headingLine (1-indexed heading line N -> 0-indexed
    // index N-1 for the heading itself -> N for the line after it). headingSection.endLine (1-indexed,
    // inclusive) used directly as the 0-indexed exclusive bound, same arithmetic locateConfirmationLog
    // already uses for its own headingSection walks.
    const para = firstParagraphBounds(lines, headingSection.headingLine, headingSection.endLine)
    if (para) {
      const startLine = para.start0 + 1 // 1-indexed
      const endLine = para.end0 // 1-indexed inclusive (para.end0 is the exclusive 0-indexed bound,
      // which is numerically the same value as the inclusive 1-indexed end of the paragraph)
      return {
        found: true,
        shape: 'heading',
        text: lines.slice(para.start0, para.end0).join(' ').trim(),
        citation: citeSpanLocal(relFile, lines, headingSection.headingText, startLine, endLine),
      }
    }
    // A heading matched but the section is empty right after it (not observed in any of the 21
    // shelves as measured) — fall through to the inline scan below rather than assert a paragraph
    // that is not there.
  }

  let matchLineIdx = -1 // 0-indexed, last match wins — loop-ship's own two "**Re-check" lines are
  // exactly why: line 28 is about a report-year detail, line 80 is the real shelf-level cadence note.
  for (let i = 0; i < lines.length; i++) {
    if (RECHECK_INLINE_RE.test(lines[i])) matchLineIdx = i
  }
  if (matchLineIdx === -1) {
    return {
      found: false,
      reason: `no "## ...re-check..." heading and no bold "**Re-check" paragraph/bullet/numbered-item found anywhere in ${relFile} — this shelf states no re-check cadence in a shape that can be located without guessing which sentence is "the" cadence`,
    }
  }

  const { sections: allSections } = splitH2Sections(lines)
  const enclosing = [...allSections].reverse().find((s) => matchLineIdx + 1 >= s.startLine && matchLineIdx + 1 <= s.endLine)
  const sectionLabel = enclosing ? enclosing.headingText : '(no enclosing H2 heading)'

  return {
    found: true,
    shape: 'inline',
    text: lines[matchLineIdx].trim(),
    citation: citeSpanLocal(relFile, lines, sectionLabel, matchLineIdx + 1, matchLineIdx + 1),
  }
}

// ---------------------------------------------------------------------------
// Per-skill extras — recheckCadence (this file's own extraction, above) plus the confirmation-log
// REASON for the null case (standards.mjs's readStandardsShelf() computes confirmationLogReason, but
// searchStandards()'s single-skill branch only forwards `shelf.confirmationLog`, silently dropping the
// reason when it is null — measured unreachable today, confirmationLogPresentIn is 21 of 21, but per
// ADR-0005 I2 the explained-null path must still exist rather than being a silent drop if a 22nd shelf
// is added tomorrow without one). Both are derived from ONE extra live read of the shelf (locateConfirmationLog
// is reused from the spine directly rather than re-derived — "call the spine, never reimplement it"),
// so this costs one additional small file read per single-skill call, same cheap-and-disclosed posture
// boundary_lookup.mjs's own "second live read" already established.
// ---------------------------------------------------------------------------

function computeShelfExtras(root, skill) {
  const located = locateStandardsDoc(root, skill)
  if (!located.ok) {
    // Unreachable in practice — searchStandards() just read this same file moments ago successfully —
    // but per ADR-0005 I2, never silently omit; surface the mismatch instead of guessing.
    const reason = `could not re-read ${skill}'s shelf for recheckCadence/confirmationLogReason extraction: ${located.error}`
    return { recheckCadence: { found: false, reason }, confirmationLogReason: null }
  }
  const { file, lines } = located
  const recheckCadence = locateRecheckCadence(file, lines, skill)
  const log = locateConfirmationLog(file, lines, skill)
  return { recheckCadence, confirmationLogReason: log.found ? null : log.reason }
}

// ---------------------------------------------------------------------------
// Envelope constants (ADR-0003 §D3.8's fallback for standards_shelf, echoed verbatim into the error
// envelope's `fallback` field — same grammar as route_node.mjs's FALLBACK_TEXT / estimate_phase.mjs's
// / boundary_lookup.mjs's own copies).
// ---------------------------------------------------------------------------

const STANDARDS_SHELF_FALLBACK_TEXT =
  'Read .claude/skills/<skill>/references/standards.md. Given the measured heterogeneity of the 21 shelves the fallback is frequently BETTER than the tool — prose sections come back as raw text either way, and a human reading the file loses nothing.'

const GRADE_VALUES = Object.freeze(['yes', 'draft', 'no'])

// ---------------------------------------------------------------------------
// Input validation — ADR-0005 D5.2's precondition, enforced in code because ADR-0001's hand-rolled
// zero-dependency server supplies no JSON-Schema validation of its own (same posture as
// route_node.mjs's / estimate_phase.mjs's / boundary_lookup.mjs's own validateInput). TYPE mismatches
// and ENUM mismatches on a supplied property are shape violations (route_node.mjs's own precedent for
// `nodeShape`/`planner`: an enum field with no alias-widening special case, unlike `mode`, fails at
// -32602). Absence of BOTH `skill` and `query` is left to the spine's own searchStandards(), which
// already reports it as a domain-level `invalid_argument` — same reasoning boundary_lookup.mjs's own
// validateInput gives for its identical anyOf(skill,query): the two are individually optional
// properties, so no `required` array is violated; it is the anyOf that fails, which is semantic.
// ---------------------------------------------------------------------------

function protocolError(field, message) {
  return { protocolError: true, jsonRpcCode: -32602, field, message }
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return protocolError(null, 'standards_shelf requires an object argument')
  }
  if (input.skill !== undefined && typeof input.skill !== 'string') {
    return protocolError('skill', `skill must be a string; got ${typeof input.skill}`)
  }
  if (input.query !== undefined && typeof input.query !== 'string') {
    return protocolError('query', `query must be a string; got ${typeof input.query}`)
  }
  if (input.grade !== undefined && input.grade !== null && (typeof input.grade !== 'string' || !GRADE_VALUES.includes(input.grade))) {
    return protocolError('grade', `grade must be one of ${JSON.stringify(GRADE_VALUES)}; got ${JSON.stringify(input.grade)}`)
  }
  if (input.limit !== undefined && !(Number.isInteger(input.limit) && input.limit >= 1)) {
    return protocolError('limit', `limit must be a positive integer; got ${JSON.stringify(input.limit)}`)
  }
  return { ok: true }
}

// Maps standards.mjs's own internal error codes onto ADR-0003 §D3.5's closed public error-code enum
// (invalid_argument | unknown_mode | not_found | source_missing | source_unparseable | gate_unavailable
// | internal). Two disclosed corrections, not a blind passthrough:
//
//   1. listSkillsWithStandardsShelf() returns code 'source-missing' (HYPHEN) when .claude/skills/ itself
//      is unreadable; locateStandardsDoc() returns code 'source_missing' (UNDERSCORE) when one skill's
//      file is unreadable — an inconsistency inside the Phase-2 spine itself. Both normalize to D3.5's
//      underscore spelling here.
//
//   2. D3.5's own codes table names the exact case a single-skill lookup on an unknown/mistyped skill
//      name is: "not_found: ... standards_shelf on a skill with no references/standards.md." The spine
//      reports that same case as 'source_missing' (locateStandardsDoc has no way to distinguish "this
//      skill genuinely has no shelf" from "the whole tree is unreadable" — both are just an ENOENT on a
//      constructed path). This file DOES have that context (the caller supplied `skill` and the read
//      failed with "no such file"), so it remaps to 'not_found' precisely there, leaving true
//      tree-wide unreadability (a permissions error, or a query-mode failure with no `skill` supplied)
//      as 'source_missing'.
function mapErrorCode(spineResult, input) {
  const code = spineResult.code
  if (code === 'invalid_argument') return 'invalid_argument'
  if (code === 'source_missing' || code === 'source-missing') {
    const hadSkill = typeof input.skill === 'string'
    const noSuchFile = /no such file/.test(spineResult.error || '')
    if (hadSkill && noSuchFile) return 'not_found'
    return 'source_missing'
  }
  return 'internal'
}

// ---------------------------------------------------------------------------
// Public: standardsShelf — the standards_shelf tool handler. Composes standards.mjs's searchStandards()
// (pinned rows, three-grade vocabulary, unparsedSections, the D5.3.5 whole-section-atomicity rule) plus
// this file's own recheckCadence extraction and confirmationLogReason forwarding into the ADR-0003
// §D3.1 envelope. Stops at the first structural failure rather than returning a partial result
// (ADR-0005 I2 — exactly ok:true or a named ok:false).
// ---------------------------------------------------------------------------

function standardsShelf(rawInput, options = {}) {
  const root = options.root
  const sourceRoot = resolveRoot(root)

  const validation = validateInput(rawInput)
  if (validation.protocolError) return validation // -32602 seam — never the isError envelope
  const input = rawInput || {}

  const spineResult = searchStandards(root, { skill: input.skill, query: input.query, grade: input.grade, limit: input.limit })

  if (!spineResult.ok) {
    return {
      ok: false,
      tool: 'standards_shelf',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      // Disclosed empty citations on a totally unreadable/unparseable source — same posture
      // boundary_lookup.mjs's own error branch takes: fabricating a citation over bytes that were
      // never successfully read would be the exact silent default ADR-0005 I1 forbids.
      citations: [],
      deprecations: [],
      notes: [],
      error: {
        code: mapErrorCode(spineResult, input),
        message: spineResult.error,
        fix: spineResult.fix,
        fallback: STANDARDS_SHELF_FALLBACK_TEXT,
      },
    }
  }

  const citations = []
  const notes = []

  for (const e of spineResult.entries) citations.push(e.citation)
  for (const u of spineResult.unparsedSections) citations.push(u.citation)

  let shelfConfirmation
  if (typeof input.skill === 'string') {
    const extras = computeShelfExtras(root, input.skill)

    if (spineResult.shelfConfirmation) {
      citations.push(spineResult.shelfConfirmation.citation)
      shelfConfirmation = {
        confirmedOn: spineResult.shelfConfirmation.confirmedOn,
        recheckCadence: extras.recheckCadence.found ? extras.recheckCadence.text : null,
        openItems: spineResult.shelfConfirmation.openItems,
        citation: spineResult.shelfConfirmation.citation,
      }
    } else {
      // The confirmation log itself is an explained null (measured unreachable — confirmationLogPresentIn
      // is 21 of 21 today — but the spine's own contract allows it, and dropping the reason here would
      // be exactly the silent omission ADR-0005 I2 forbids).
      notes.push(
        extras.confirmationLogReason
          ? `shelfConfirmation is null for '${input.skill}': ${extras.confirmationLogReason}`
          : `shelfConfirmation is null for '${input.skill}' and no reason was recorded by the spine — a gap in standards.mjs's own contract, not a guess papered over here.`
      )
      shelfConfirmation = null
    }

    if (extras.recheckCadence.found) {
      citations.push(extras.recheckCadence.citation)
    } else {
      notes.push(`recheckCadence is null for '${input.skill}': ${extras.recheckCadence.reason}`)
    }
  }

  const result = {
    entries: spineResult.entries,
    unparsedSections: spineResult.unparsedSections,
    shelvesSearched: spineResult.shelvesSearched,
    authorityNote: spineResult.authorityNote,
  }
  if (shelfConfirmation !== undefined) result.shelfConfirmation = shelfConfirmation

  return {
    ok: true,
    tool: 'standards_shelf',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    result,
    citations: dedupeCitations(citations), // see DISCLOSED GAP #2 above: may legitimately be empty on
    // a global query that matches nothing anywhere, rather than a fabricated citation over bytes that
    // played no part in the (empty) answer.
    deprecations: [],
    notes,
  }
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/standards_shelf.mjs").then(m => console.log(JSON.stringify(m.standardsShelf({skill:"loop-design"}), null, 2)))'
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------

export {
  standardsShelf,
  validateInput,
  mapErrorCode,
  locateRecheckCadence,
  computeShelfExtras,
  DEFAULT_ROOT,
  SPINE_DEFAULT_ROOT,
  STANDARDS_SHELF_FALLBACK_TEXT,
  GRADE_VALUES,
}
