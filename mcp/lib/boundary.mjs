// mcp/lib/boundary.mjs — the live reader over docs/design/boundary-audit.json, implementing
// ADR-0007's ranking (D7) and speech act (D7.1).
//
// Zero MCP types live here, same discipline as mcp/lib/modes.mjs and mcp/lib/estimate.mjs: this
// module knows nothing about JSON-RPC, tool schemas or envelopes — it reads one JSON source and
// hands back plain data plus the deterministic scoring D7 defines over it. Testable with `node -e`
// alone:
//
//   node -e 'import("./mcp/lib/boundary.mjs").then(m => console.log(m.readBoundaryAudit().ok))'
//
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
//
// mcp/ code may only import node: builtins (ADR-0002 §D2.1 — EVERY import specifier reachable from
// mcp/, not just mcp/server.mjs, must begin with `node:`). Per D2.1's literal "every import
// specifier reachable from mcp/" rule, this file does NOT import mcp/lib/modes.mjs or
// mcp/lib/estimate.mjs even though it duplicates small helpers (toLines, sha256OfLines, relPosix)
// from both — same posture as estimate.mjs's own header note: "if this ever disagrees with the
// source line, the source line wins, and this is the defect to fix."
//
// READ LIVE, NEVER SNAPSHOT. Every exported function re-reads and re-JSON.parses
// docs/design/boundary-audit.json on every call (ADR-0005 §D5.3.7 rules out caching for exactly this
// reason: loop-skill/SKILL.md step 3 requires a NEW skill to add rows to this file, so a cached copy
// goes stale the moment the tool's own governing skill is used as intended). No module-level state
// holds parsed content across calls.
//
// Per ADR-0007 §D7.1 (the speech act): every answer this module builds is an ASSERTIVE (a cited
// report of what the file says) plus a DIRECTIVE (evidence the caller must weigh) — NEVER a
// DECLARATION. No result object built here carries a field named owner, owningSkill, owns, verdict,
// decision, answer, winner or selected. The ranked array is always `candidates`. This module never
// invents a boundary the file does not contain: every edge, every overlap, every score term traces
// to a JSON pointer computed from the live file, never to a hand-maintained table.
//
// Scope note: this library implements D7's scoring core (§D7.2 corpus, §D7.3 score, §D7.4 unowned,
// §D7.5 both directions of every edge) plus the rated-overlap evidence this task's brief asks for
// (every overlap row touching a candidate, carrying its `resolution` text — the checkable
// predicate). §D7.6's pairwise separating-question object, §D7.7's descriptionIsStale live/approved
// cross-check and §D7.8's auditIntegrity block are NOT implemented here — see the file-bottom
// comment "Not implemented here" for the reasoning. Nothing below fabricates any of those fields;
// they are simply absent from this module's surface, same as any field the source file itself does
// not contain.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Location constants
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const BOUNDARY_DOC_REL = path.join('docs', 'design', 'boundary-audit.json')

// §D7.4 — both thresholds are functions of the LIVE matrix size, never fixed constants. Recomputed
// on every call from N = matrix.length (see rankCandidates()), not module-level.
const MIN_DISCRIMINATING = 2 // §D7.4 — fixed count, but the df window it counts over is not.

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function boundaryDocPath(root) {
  return path.join(resolveRoot(root), BOUNDARY_DOC_REL)
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to mcp/lib/modes.mjs's and estimate.mjs's copy.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// JSON positional scanner. boundary-audit.json is JSON.parse'd for values (ADR-0001 §77: "JSON.parse
// is free"), but D3.2 citations need a byte/line span PER NODE, which JSON.parse discards. This is a
// hand-rolled, string-aware bracket-depth walker — no dependency, mirrors the ADR's own description
// of citationMechanics.lineSpanRule: "Brace-depth scan upward to the enclosing object's `{` line,
// then forward to depth 0." (mcp/boundary-match-contract.json D7_0_source.citationMechanics)
// ---------------------------------------------------------------------------

function buildOffsetToLine(text) {
  // Returns a function mapping a 0-based char offset to its 1-indexed line number.
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1)
  }
  return (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

// Scans a JSON array's element boundaries, starting just after the array's own `[`. Elements are
// assumed to be objects or arrays (true for every array this module reads: matrix, overlaps,
// descriptionRewrites, useInsteadWhen). String-aware (backslash-escape tolerant), so a `{`/`}`/`[`/`]`
// inside a quoted value never perturbs the depth count. Returns [{start, end}] — 0-based offsets,
// `end` inclusive of the closing bracket — or null if the array's closing `]` is never reached.
function scanArrayElements(text, arrayOpenIdx) {
  const elements = []
  let depth = 0
  let inString = false
  let escape = false
  let elemStart = -1
  for (let i = arrayOpenIdx + 1; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') { inString = true; continue }
    if (c === '{' || c === '[') {
      if (depth === 0) elemStart = i
      depth++
      continue
    }
    if (c === '}' || c === ']') {
      depth--
      if (depth === 0 && elemStart !== -1) {
        elements.push({ start: elemStart, end: i })
        elemStart = -1
      } else if (depth < 0) {
        return { elements, closeIdx: i } // the array's own matching `]`
      }
      continue
    }
    // whitespace, commas, colons at depth 0 between elements — ignored
  }
  return null // unterminated — caller reports source_unparseable
}

// Finds `"<key>": [` anchored at line-start (coordinate, not a content search — same discipline as
// modes.mjs's `^##\s+M8\.` heading regex), returning the 0-based offset of the `[` character, or -1.
function findKeyArrayOpen(text, key, fromIdx = 0) {
  const re = new RegExp('^[ \\t]*"' + key + '"\\s*:\\s*\\[', 'm')
  re.lastIndex = 0
  const slice = text.slice(fromIdx)
  const m = re.exec(slice)
  if (!m) return -1
  const matchEnd = fromIdx + m.index + m[0].length
  return matchEnd - 1 // index of the '[' itself
}

// ---------------------------------------------------------------------------
// Public: readBoundaryAudit — locate, JSON.parse and index the whole file, live, on every call.
// Every row (matrix / overlaps / descriptionRewrites) and every useInsteadWhen edge carries a D3.2
// citation computed from the SAME parse pass, so a caller can fetch theloopskill://<file> over
// resources/read and recompute the sha256 independently.
// ---------------------------------------------------------------------------

function readBoundaryAudit(root) {
  const file = boundaryDocPath(root)
  const relFile = relPosix(root, file)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'source_missing',
      error: `cannot read ${relFile}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`,
      fix: `Restore ${relFile} — it is the sole source docs/design/README.md declares authoritative for skill boundaries.`,
    }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      ok: false,
      code: 'source_unparseable',
      error: `${relFile} does not parse as JSON: ${e.message}`,
      fix: `Fix the JSON syntax error in ${relFile} — this module never guesses at malformed source.`,
    }
  }

  const ls = toLines(text)
  const offsetToLine = buildOffsetToLine(text)

  const citeSpan = (startOffset, endOffset, pointer) => {
    const startLine = offsetToLine(startOffset)
    const endLine = offsetToLine(endOffset)
    const excerptFull = ls.slice(startLine - 1, endLine).join('\n')
    const truncated = excerptFull.length > 2000
    return {
      file: relFile,
      section: pointer,
      startLine,
      endLine,
      sha256: sha256OfLines(ls, startLine, endLine),
      excerpt: truncated ? excerptFull.slice(0, 2000) : excerptFull,
      excerptTruncated: truncated,
      resourceUri: `theloopskill://${relFile}`,
    }
  }

  const requiredKeys = ['matrix', 'overlaps', 'descriptionRewrites']
  for (const k of requiredKeys) {
    if (!Array.isArray(parsed[k])) {
      return {
        ok: false,
        code: 'source_unparseable',
        error: `${relFile} has no top-level array at "${k}" — expected the D7_0_source shape (matrix[], overlaps[], descriptionRewrites[]).`,
        fix: `Restore the "${k}" array in ${relFile} to its documented shape (mcp/boundary-match-contract.json D7_0_source.shapeOnDisk).`,
      }
    }
  }

  // --- matrix ---
  const matrixOpen = findKeyArrayOpen(text, 'matrix')
  if (matrixOpen === -1) {
    return { ok: false, code: 'source_unparseable', error: `no line-anchored "matrix": [ in ${relFile}`, fix: `Restore the "matrix" key at the top level of ${relFile}.` }
  }
  const matrixScan = scanArrayElements(text, matrixOpen)
  if (!matrixScan || matrixScan.elements.length !== parsed.matrix.length) {
    return { ok: false, code: 'source_unparseable', error: `matrix array in ${relFile} did not scan cleanly (found ${matrixScan ? matrixScan.elements.length : 'unterminated'} element span(s), JSON.parse saw ${parsed.matrix.length})`, fix: `Check ${relFile} for malformed JSON near the "matrix" array.` }
  }

  const matrix = parsed.matrix.map((row, i) => {
    const span = matrixScan.elements[i]
    const pointer = `/matrix/${i}`
    const rowCitation = citeSpan(span.start, span.end, pointer)

    // useInsteadWhen — nested array within this row's own text span. Searched from span.start in the
    // FULL text (not a row-local slice) so the resulting offsets are already absolute — no
    // slice-relative-to-absolute translation needed.
    let useInsteadWhen = []
    if (Array.isArray(row.useInsteadWhen) && row.useInsteadWhen.length) {
      const uiwOpenAbs = findKeyArrayOpen(text, 'useInsteadWhen', span.start)
      const uiwScanAbs = uiwOpenAbs !== -1 && uiwOpenAbs < span.end ? scanArrayElements(text, uiwOpenAbs) : null
      if (uiwScanAbs && uiwScanAbs.elements.length === row.useInsteadWhen.length) {
        useInsteadWhen = row.useInsteadWhen.map((edge, j) => ({
          otherSkill: edge.otherSkill,
          condition: edge.condition,
          citation: citeSpan(uiwScanAbs.elements[j].start, uiwScanAbs.elements[j].end, `${pointer}/useInsteadWhen/${j}`),
        }))
      } else {
        // Could not scan cleanly — report each edge with the ROW's citation rather than inventing a
        // sub-span (never invent a boundary the file does not evidently contain at that coordinate).
        useInsteadWhen = row.useInsteadWhen.map((edge, j) => ({
          otherSkill: edge.otherSkill,
          condition: edge.condition,
          citation: { ...rowCitation, section: `${pointer}/useInsteadWhen/${j}` },
        }))
      }
    }

    return { skill: row.skill, scope: row.scope, useInsteadWhen, citation: rowCitation }
  })

  // --- overlaps ---
  const overlapsOpen = findKeyArrayOpen(text, 'overlaps')
  if (overlapsOpen === -1) {
    return { ok: false, code: 'source_unparseable', error: `no line-anchored "overlaps": [ in ${relFile}`, fix: `Restore the "overlaps" key at the top level of ${relFile}.` }
  }
  const overlapsScan = scanArrayElements(text, overlapsOpen)
  if (!overlapsScan || overlapsScan.elements.length !== parsed.overlaps.length) {
    return { ok: false, code: 'source_unparseable', error: `overlaps array in ${relFile} did not scan cleanly`, fix: `Check ${relFile} for malformed JSON near the "overlaps" array.` }
  }
  const overlaps = parsed.overlaps.map((o, n) => ({
    skillA: o.skillA,
    skillB: o.skillB,
    risk: o.risk,
    severity: o.severity,
    resolution: o.resolution,
    citation: citeSpan(overlapsScan.elements[n].start, overlapsScan.elements[n].end, `/overlaps/${n}`),
  }))

  // --- descriptionRewrites ---
  const descOpen = findKeyArrayOpen(text, 'descriptionRewrites')
  if (descOpen === -1) {
    return { ok: false, code: 'source_unparseable', error: `no line-anchored "descriptionRewrites": [ in ${relFile}`, fix: `Restore the "descriptionRewrites" key at the top level of ${relFile}.` }
  }
  const descScan = scanArrayElements(text, descOpen)
  if (!descScan || descScan.elements.length !== parsed.descriptionRewrites.length) {
    return { ok: false, code: 'source_unparseable', error: `descriptionRewrites array in ${relFile} did not scan cleanly`, fix: `Check ${relFile} for malformed JSON near the "descriptionRewrites" array.` }
  }
  const descriptionRewrites = parsed.descriptionRewrites.map((d, k) => ({
    skill: d.skill,
    newDescription: d.newDescription,
    citation: citeSpan(descScan.elements[k].start, descScan.elements[k].end, `/descriptionRewrites/${k}`),
  }))

  return {
    ok: true,
    sourceRoot: root ? path.resolve(root) : DEFAULT_ROOT,
    file: relFile,
    matrix,
    overlaps,
    descriptionRewrites,
  }
}

// ---------------------------------------------------------------------------
// §D7.3 — tokenizer. Total, no locale, no clock, no stopword list.
// ---------------------------------------------------------------------------

function tokenize(text) {
  const norm = String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ')
  return norm.split(/\s+/).filter(Boolean)
}

function distinct(arr) {
  return Array.from(new Set(arr))
}

// ---------------------------------------------------------------------------
// Exact-integer rational arithmetic (BigInt) — §D7.3's "no float, no Math.log at compare time" rule.
// ---------------------------------------------------------------------------

function gcdBig(a, b) {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) { [a, b] = [b, a % b] }
  return a === 0n ? 1n : a
}

function makeRat(n, d) {
  if (d < 0n) { n = -n; d = -d }
  const g = gcdBig(n, d)
  return { n: n / g, d: d / g }
}

function ratAdd(a, b) {
  return makeRat(a.n * b.d + b.n * a.d, a.d * b.d)
}

function ratMul(a, b) {
  return makeRat(a.n * b.n, a.d * b.d)
}

function ratCompare(a, b) {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}

const RAT_ZERO = Object.freeze({ n: 0n, d: 1n })

function ratFromInt(i) {
  return { n: BigInt(i), d: 1n }
}

// TF saturation, exact rational: 11f/(5f+6) (Robertson k1 = 6/5). f = 0 yields 0/6 = 0.
function tfSaturated(f) {
  return makeRat(11n * BigInt(f), 5n * BigInt(f) + 6n)
}

function ratToFixedString(r, decimals = 6) {
  const scale = 10n ** BigInt(decimals)
  const negative = (r.n < 0n) !== (r.d < 0n)
  const nAbs = r.n < 0n ? -r.n : r.n
  const dAbs = r.d < 0n ? -r.d : r.d
  const scaled = (nAbs * scale) / dAbs // floor
  const s = scaled.toString().padStart(decimals + 1, '0')
  const intPart = s.slice(0, s.length - decimals)
  const fracPart = decimals > 0 ? '.' + s.slice(s.length - decimals) : ''
  return (negative && scaled !== 0n ? '-' : '') + intPart + fracPart
}

// ---------------------------------------------------------------------------
// §D7.3 — the IDF table. IDF[d] = round(1000 * ln((2N+2)/(2d+1))), d = 0..N. Math.log runs exactly
// N+1 times, at table construction only — it never reaches the comparison path (§D7.3's portability
// rule; see mcp/boundary-match-contract.json D7_3_score.idf.portability).
// ---------------------------------------------------------------------------

function buildIdfTable(N) {
  const table = []
  for (let d = 0; d <= N; d++) {
    table.push(Math.round(1000 * Math.log((2 * N + 2) / (2 * d + 1))))
  }
  return table // table[d] for d in 0..N; out-of-vocabulary (d=0) is table[0], the maximum entry.
}

// ---------------------------------------------------------------------------
// §D7.2 — corpus. Scored fields are scope (weight 3/5) and the APPROVED description (weight 2/5),
// renormalized to 1 (scope alone) when no approved description exists. Document frequency is
// measured over the COMBINED per-row bag (scope + description), per §D7.3's idf.d definition.
// ---------------------------------------------------------------------------

function buildCorpus(matrix, descriptionRewrites) {
  const descBySkill = new Map(descriptionRewrites.map((d) => [d.skill, d]))
  const rows = matrix.map((row) => {
    const desc = descBySkill.get(row.skill) || null
    const scopeTokens = tokenize(row.scope)
    const descTokens = desc ? tokenize(desc.newDescription) : []
    const scopeCounts = new Map()
    for (const t of scopeTokens) scopeCounts.set(t, (scopeCounts.get(t) || 0) + 1)
    const descCounts = new Map()
    for (const t of descTokens) descCounts.set(t, (descCounts.get(t) || 0) + 1)
    const bag = new Set([...scopeTokens, ...descTokens]) // combined, for df
    const fieldsScored = desc ? ['scope', 'description'] : ['scope']
    const weight = desc ? { scope: makeRat(3n, 5n), description: makeRat(2n, 5n) } : { scope: makeRat(1n, 1n) }
    return { skill: row.skill, scopeCounts, descCounts, bag, fieldsScored, weight, approvedDescription: desc ? desc.newDescription : null, descCitation: desc ? desc.citation : null }
  })

  const N = rows.length
  const df = new Map()
  for (const r of rows) {
    for (const t of r.bag) df.set(t, (df.get(t) || 0) + 1)
  }
  return { rows, N, df: (t) => df.get(t) || 0 }
}

// ---------------------------------------------------------------------------
// §D7.3 — score one row against the distinct query term set T, given the live IDF table and DF_MAX.
// Returns the exact rational score, the discriminating-term match count, and per-term matched
// evidence for the fields the row actually scored on.
// ---------------------------------------------------------------------------

function scoreRow(corpusRow, T, idfTable, dfFn, dfMax) {
  let score = RAT_ZERO
  const matchedTerms = []
  let nDiscriminating = 0
  const fieldCounts = { scope: corpusRow.scopeCounts, description: corpusRow.descCounts }

  for (const t of T) {
    const d = dfFn(t)
    const idf = idfTable[Math.min(d, idfTable.length - 1)]
    const discriminating = d >= 1 && d <= dfMax
    let matchedInAnyField = false

    for (const field of corpusRow.fieldsScored) {
      const count = fieldCounts[field].get(t) || 0
      if (count === 0) continue
      matchedInAnyField = true
      const contribution = ratMul(ratMul(corpusRow.weight[field], tfSaturated(count)), ratFromInt(idf))
      score = ratAdd(score, contribution)
      matchedTerms.push({ term: t, field, count, idf, discriminating })
    }
    if (matchedInAnyField && discriminating) nDiscriminating++
  }

  return { score, matchedTerms, nDiscriminating }
}

// ---------------------------------------------------------------------------
// §D7.2 diversion — a query hit inside THIS row's own useInsteadWhen[j].condition is reported
// against this row (never added to the row's score, never transferred to otherSkill's score; see
// mcp/boundary-match-contract.json D7_2_corpus.diversion for why an additive transfer was rejected).
// ---------------------------------------------------------------------------

function divertedByFor(matrixRow, rowIndex, T) {
  const out = []
  const Tset = new Set(T)
  matrixRow.useInsteadWhen.forEach((edge, j) => {
    const condTerms = distinct(tokenize(edge.condition))
    const matched = condTerms.filter((t) => Tset.has(t))
    if (matched.length) {
      out.push({ otherSkill: edge.otherSkill, matchedTerms: matched, pointer: `/matrix/${rowIndex}/useInsteadWhen/${j}`, citation: edge.citation })
    }
  })
  return out
}

// ---------------------------------------------------------------------------
// §D7.5 — both directions of every edge. Builds, once per call, a full adjacency read from the live
// matrix: outbound edges verbatim per row, and inbound edges SYNTHESIZED by scanning every row for a
// useInsteadWhen entry that targets the skill in question — each carrying the pointer to where it is
// actually stored, never invented.
// ---------------------------------------------------------------------------

function buildReciprocity(matrix, skillIndex) {
  const row = matrix[skillIndex]
  const outboundTargets = new Set(row.useInsteadWhen.map((e) => e.otherSkill))

  const pointedAtBy = []
  matrix.forEach((other, k) => {
    if (k === skillIndex) return
    other.useInsteadWhen.forEach((edge, m) => {
      if (edge.otherSkill === row.skill) {
        pointedAtBy.push({ skill: other.skill, condition: edge.condition, direction: 'inbound', pointer: `/matrix/${k}/useInsteadWhen/${m}`, citation: edge.citation })
      }
    })
  })
  const inboundSources = new Set(pointedAtBy.map((e) => e.skill))

  const oneWayOut = [...outboundTargets].filter((t) => !inboundSources.has(t))
  const oneWayIn = [...inboundSources].filter((s) => !outboundTargets.has(s))

  return {
    useInsteadWhen: row.useInsteadWhen,
    pointedAtBy,
    reciprocity: {
      outDegree: row.useInsteadWhen.length,
      inDegree: pointedAtBy.length,
      oneWayOut,
      oneWayIn,
    },
  }
}

// ---------------------------------------------------------------------------
// Rated overlaps touching a candidate — every row of the 28-row /overlaps array where skillA or
// skillB equals this skill. `resolution` is returned verbatim: it is where the checkable predicate
// for that overlap lives (per this task's brief).
// ---------------------------------------------------------------------------

function overlapsTouching(overlaps, skill) {
  return overlaps
    .filter((o) => o.skillA === skill || o.skillB === skill)
    .map((o) => ({
      skillA: o.skillA,
      skillB: o.skillB,
      other: o.skillA === skill ? o.skillB : o.skillA,
      severity: o.severity,
      risk: o.risk,
      resolution: o.resolution,
      citation: o.citation,
    }))
}

// ---------------------------------------------------------------------------
// The authority constant every answer carries — §D7.1 rule 3. Text matches
// mcp/boundary-match-contract.json D7_1_speechAct.authorityConstant.
// ---------------------------------------------------------------------------

const AUTHORITY = 'boundary-audit.json outranks any plan or build manifest (docs/design/README.md). ' +
  'This ranking is the server\'s, computed by the documented score in mcp/boundary-match-contract.json; ' +
  'the authority is the file\'s. A rank is not a ruling — read the evidence and decide.'

// ---------------------------------------------------------------------------
// Public: buildCandidate — the shared shape for both a ranked candidate and an exact-lookup result.
// Never a field named owner/owningSkill/owns/verdict/decision/answer/winner/selected (§D7.1).
// ---------------------------------------------------------------------------

function buildCandidate(read, matrixIndexBySkill, skill, extra = {}) {
  const idx = matrixIndexBySkill.get(skill)
  const row = read.matrix[idx]
  const recip = buildReciprocity(read.matrix, idx)
  const descRow = read.descriptionRewrites.find((d) => d.skill === skill) || null
  return {
    skill: row.skill,
    scope: row.scope,
    approvedDescription: descRow ? descRow.newDescription : null,
    fieldsScored: descRow ? ['scope', 'description'] : ['scope'],
    citation: row.citation,
    ...extra,
    useInsteadWhen: recip.useInsteadWhen,
    pointedAtBy: recip.pointedAtBy,
    reciprocity: recip.reciprocity,
    overlapsTouching: overlapsTouching(read.overlaps, row.skill),
  }
}

// ---------------------------------------------------------------------------
// Public: rankCandidates — §D7.3's score and ordering, §D7.4's unowned predicate, §D7.1's minimum
// shortlist. Reads the file live via readBoundaryAudit(); never caches across calls.
// ---------------------------------------------------------------------------

function rankCandidates(root, query, { limit = 5 } = {}) {
  if (typeof query !== 'string' || query.trim() === '') {
    return { ok: false, code: 'invalid_argument', error: 'query must be a non-empty string', fix: 'Pass a non-empty free-text query, e.g. "plan a whole project into phases".' }
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return { ok: false, code: 'invalid_argument', error: `limit must be a positive integer; got ${JSON.stringify(limit)}`, fix: 'Pass limit as a positive integer, or omit it for the default of 5.' }
  }

  const read = readBoundaryAudit(root)
  if (!read.ok) return read

  const N = read.matrix.length
  const dfMax = Math.floor(N / 4)
  const idfTable = buildIdfTable(N)
  const corpus = buildCorpus(read.matrix, read.descriptionRewrites)
  const T = distinct(tokenize(query))
  if (!T.length) {
    return { ok: false, code: 'invalid_argument', error: 'query tokenized to zero terms', fix: 'Pass a query containing at least one alphanumeric term.' }
  }

  const matrixIndexBySkill = new Map(read.matrix.map((r, i) => [r.skill, i]))

  const scored = corpus.rows.map((corpusRow, i) => {
    const { score, matchedTerms, nDiscriminating } = scoreRow(corpusRow, T, idfTable, corpus.df, dfMax)
    return { skill: corpusRow.skill, index: i, score, matchedTerms, nDiscriminating, divertedBy: divertedByFor(read.matrix[i], i, T) }
  })

  // §D7.3 ordering — score desc, nDiscriminating desc, matrix index asc. Total on all three keys.
  scored.sort((a, b) => {
    const c = ratCompare(b.score, a.score)
    if (c !== 0) return c
    if (b.nDiscriminating !== a.nDiscriminating) return b.nDiscriminating - a.nDiscriminating
    return a.index - b.index
  })

  const queryDiscriminatingTerms = T.filter((t) => { const d = corpus.df(t); return d >= 1 && d <= dfMax })
  const topDiscriminatingCount = scored[0].nDiscriminating
  const outcome = topDiscriminatingCount < MIN_DISCRIMINATING ? 'unowned' : 'candidates'

  const notes = []
  let effectiveLimit
  let take
  if (outcome === 'unowned') {
    // §D7.4 — "the top 3 rows anyway", never gated on the caller's limit, never empty.
    effectiveLimit = Math.min(3, N)
    take = scored.slice(0, effectiveLimit)
  } else {
    effectiveLimit = limit
    if (effectiveLimit < 2) {
      notes.push(`limit:${limit} was raised to 2 — a one-element shortlist is a verdict wearing a list's clothes (ADR-0007 §D7.1 rule 2).`)
      effectiveLimit = 2
    }
    effectiveLimit = Math.min(effectiveLimit, N)
    take = scored.slice(0, effectiveLimit)
  }

  const candidates = take.map((s) => buildCandidate(read, matrixIndexBySkill, s.skill, {
    score: ratToFixedString(s.score, 6),
    matchedTerms: s.matchedTerms,
    nDiscriminating: s.nDiscriminating,
    divertedBy: s.divertedBy,
  }))

  return {
    ok: true,
    outcome,
    query,
    queryDiscriminatingTerms,
    topDiscriminatingCount,
    dfMax,
    matrixSize: N,
    candidates,
    notes,
    authority: AUTHORITY,
    ...(outcome === 'unowned'
      ? { decompositionSmell: 'No row of the matrix matches this ask on two or more discriminating terms. Per .claude/skills/loop-build/SKILL.md:31, a task with no owning skill is a decomposition smell: split the task until each part has an owner, or record deliberately that it falls outside the fleet. Do not assign the highest-scoring row by default.' }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// Public: exactLookup — §D7.9. `skill:` alone is an exact key lookup: not_found when absent from the
// matrix, outcome:'exact' when present. Never runs the scorer, never returns 'unowned' — the absence
// of a KEY is a different fact from the absence of an OWNER (a decomposition smell), and loop-build's
// roster sweep must be able to tell them apart.
// ---------------------------------------------------------------------------

function exactLookup(root, skill) {
  if (typeof skill !== 'string' || skill.trim() === '') {
    return { ok: false, code: 'invalid_argument', error: 'skill must be a non-empty string', fix: 'Pass skill as a skill name exactly as it appears in /matrix, e.g. "loop-design".' }
  }
  const read = readBoundaryAudit(root)
  if (!read.ok) return read

  const matrixIndexBySkill = new Map(read.matrix.map((r, i) => [r.skill, i]))
  if (!matrixIndexBySkill.has(skill)) {
    return {
      ok: false,
      code: 'not_found',
      error: `${JSON.stringify(skill)} is not a skill in ${read.file}'s /matrix (21 entries as of ADR-0007)`,
      fix: `Check the spelling against /matrix in ${read.file}, or use query: instead of skill: for a ranked lookup.`,
    }
  }

  return {
    ok: true,
    outcome: 'exact',
    matrixSize: read.matrix.length,
    authority: AUTHORITY,
    candidate: buildCandidate(read, matrixIndexBySkill, skill),
  }
}

// ---------------------------------------------------------------------------
// Public: boundaryLookup — composes the two modes above, mirroring mcp/tool-contracts.json D3.6's
// boundary_lookup anyOf(skill, query) input shape.
// ---------------------------------------------------------------------------

function boundaryLookup(root, { skill, query, limit } = {}) {
  if (skill != null) return exactLookup(root, skill)
  if (query != null) return rankCandidates(root, query, limit === undefined ? {} : { limit })
  return {
    ok: false,
    code: 'invalid_argument',
    error: 'boundaryLookup requires either "skill" (exact lookup) or "query" (ranked lookup)',
    fix: 'Pass skill:"<skill-name>" for an exact match, or query:"<free text>" for a ranked shortlist.',
  }
}

// ---------------------------------------------------------------------------
// Not implemented here (recorded, not silently dropped — see file header "Scope note"):
//
//   §D7.6 separatingQuestion — the pairwise {pair, margin, propositions[], reciprocal, oneWay,
//   ratedOverlap, storedDiscriminator} object for every adjacent pair in the shortlist. This task's
//   brief asks for matched evidence, both edge directions, and touching overlaps; the adjacent-pair
//   proposition frame is a distinct, larger piece of surface (margin computation across the whole
//   sorted list, a null-branch contract over 161/210 unordered pairs) left to the tool-layer task
//   that assembles the full boundary_lookup MCP response.
//
//   §D7.7 descriptionIsStale — requires reading and frontmatter-parsing all 21 live SKILL.md files
//   per call (not just the JSON source this module owns) to compare against descriptionRewrites.
//   Left to the tool layer, which already composes multiple mcp/lib readers.
//
//   §D7.8 auditIntegrity — a required-on-every-answer summary block (matrixSize, edgeCount,
//   reciprocalEdges, oneWayEdges, zeroInDegreeSkills, overlapCount, ratedOverlapsOneWayInMatrix,
//   skillsWithNoApprovedDescription, skillsWithNoRatedOverlap, pairsWithNoStoredDiscriminator). Every
//   value it needs is computable from what readBoundaryAudit() already returns (a caller can derive
//   it by scanning read.matrix / read.overlaps / read.descriptionRewrites directly), but assembling
//   it as a named export was left to the tool layer alongside D7.6/D7.7 rather than guessed at here.
// ---------------------------------------------------------------------------

export {
  readBoundaryAudit,
  rankCandidates,
  exactLookup,
  boundaryLookup,
  tokenize,
  buildIdfTable,
  buildCorpus,
  scoreRow,
  buildReciprocity,
  overlapsTouching,
  ratToFixedString,
  ratCompare,
  AUTHORITY,
  DEFAULT_ROOT,
}
