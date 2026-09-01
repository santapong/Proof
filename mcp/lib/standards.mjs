// mcp/lib/standards.mjs — the live reader over all 21 `.claude/skills/*/references/standards.md`
// files, implementing ADR-0003's `standards_shelf` tool (D3.6) and ADR-0005's no-silent-default law
// (D5.1/D5.3.5) over a source that is MEASURED heterogeneous (mcp/tool-contracts.json D3.6_tools
// standards_shelf.measuredHeterogeneity): 21 shelves, at least 15 distinct confirmation-log shapes
// collapsing into 6 families (bold paragraph, bold bullet, H2 heading, "Re-check cadence and
// confirmation log" heading, a numbered list item, and four shelves that point at "the foot" from a
// preamble line rather than announcing the log where they name it), two shelves with zero Markdown
// table rows (loop-incident, loop-operate — prose under bold field labels instead of a table), and at
// least one shelf (loop-engine) that is a mapping table plus six prose sections, none of them carrying
// a per-row Authoritative column at all.
//
// Zero MCP types live here, same discipline as mcp/lib/modes.mjs, mcp/lib/estimate.mjs and
// mcp/lib/boundary.mjs: this module knows nothing about JSON-RPC, tool schemas or envelopes — it
// locates and parses 21 Markdown files and hands back plain data. Testable with `node -e` alone:
//
//   node -e 'import("./mcp/lib/standards.mjs").then(m => console.log(m.readStandardsShelf(undefined, "loop-build").ok))'
//
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
//
// mcp/ code may only import node: builtins (ADR-0002 §D2.1 — every import specifier reachable from
// mcp/ must begin with `node:`). Per D2.1's literal "every import specifier reachable from mcp/" rule,
// this file does NOT import mcp/lib/modes.mjs, estimate.mjs or boundary.mjs even though it duplicates
// their small helpers (toLines, sha256OfLines, splitTableRow) — same posture as estimate.mjs's own
// header note: "if this ever disagrees with the source line, the source line wins, and this is the
// defect to fix."
//
// READ LIVE, NEVER SNAPSHOT. Every exported function re-reads every file on every call (ADR-0005
// §D5.3.7 rules out caching — a standards shelf is exactly the kind of file a human edits mid-session
// and then asks this server about).
//
// ADR-0005 §D5.3.5 (atomicity is per SECTION): either every row of a table under one H2 heading
// parsed, and the section comes back with parsed:true entries; or NONE of it does, and the section
// comes back as one raw-text entry in unparsedSections naming the reason. "Half a table is the worst
// possible answer" — a caller cannot distinguish "this shelf has four standards" from "this shelf has
// nine and five rows failed a regex." This is also exactly how loop-engine's lineage table (a mapping
// table with no Standard-name or Authoritative column) and its six prose sub-sections are handled —
// they are returned as sections, never forced into a row shape they do not have.
//
// The confirmation-log extractor below is a coordinate-plus-content walk, not a per-file special case:
// it tries an H2 heading whose text contains "confirmation log" (catches loop-build's bare "## Confirmation
// log" and loop-design's "## Re-check cadence and confirmation log") first, because a heading changes
// what content to return (the whole section) rather than one line; failing that, it scans the WHOLE
// document for a line beginning (optionally after a `-` bullet or `N.` numbered marker) with the bold
// token `**Confirmation log`, and takes the LAST such match — "at the foot" in every shelf that phrases
// it that way, and the only such line in every shelf that does not. A shelf's own preamble sentence
// ("Confirmation log at the foot.") never matches this pattern because it is not itself bold, so the
// preamble and the real entry are never confused. When NEITHER shape is found, this module returns
// confirmationLog: null plus a reason naming the file it searched — never a guess, per ADR-0005 I2.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Location constants
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const SKILLS_DIR_REL = path.join('.claude', 'skills')
const STANDARDS_REL_SUFFIX = path.join('references', 'standards.md')

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function skillsDirPath(root) {
  return path.join(resolveRoot(root), SKILLS_DIR_REL)
}

function standardsDocPath(root, skill) {
  return path.join(skillsDirPath(root), skill, STANDARDS_REL_SUFFIX)
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed),
  // each line terminated by a single \n. Byte-identical rule to modes.mjs / estimate.mjs / boundary.mjs.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Public: listSkillsWithStandardsShelf — every skill directory under .claude/skills that carries a
// references/standards.md, discovered by walking the tree live (no hardcoded 21-name list — a 22nd
// skill added tomorrow is picked up without an edit here).
// ---------------------------------------------------------------------------

function listSkillsWithStandardsShelf(root) {
  const dir = skillsDirPath(root)
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return { ok: false, code: 'source-missing', error: `cannot read ${relPosix(root, dir)}: ${e.code === 'ENOENT' ? 'no such directory' : e.message}` }
  }
  const skills = entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(standardsDocPath(root, name)))
    .sort()
  return { ok: true, skills }
}

// ---------------------------------------------------------------------------
// citeSpan — one D3.2 citation, built against an already-read file's lines.
// ---------------------------------------------------------------------------

function citeSpan(relFile, lines, section, startLine, endLine) {
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
    resourceUri: `proof://${relFile}`,
  }
}

// ---------------------------------------------------------------------------
// Public: locateStandardsDoc — read one shelf's file, once. Every other function in this module
// composes on this result rather than re-reading independently mid-call.
// ---------------------------------------------------------------------------

function locateStandardsDoc(root, skill) {
  if (typeof skill !== 'string' || skill.trim() === '') {
    return { ok: false, code: 'invalid_argument', error: 'skill must be a non-empty string', fix: 'Pass skill as a directory name under .claude/skills, e.g. "loop-design".' }
  }
  const file = standardsDocPath(root, skill)
  const relFile = relPosix(root, file)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'source_missing',
      error: `cannot read ${relFile}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`,
      fix: `Check the skill name against .claude/skills — "${skill}" has no references/standards.md, or does not exist.`,
      file: relFile,
    }
  }
  const lines = toLines(text)
  return { ok: true, skill, file: relFile, lines }
}

// ---------------------------------------------------------------------------
// splitH2Sections — every top-level `## ` section in the doc, in document order. Coordinate walk
// (ADR-0004 §D4.2's discipline, generalized from one fixed heading to "every H2"): a heading is any
// line matching `^##\s` that is not `^###` or deeper. Content bounds are [headingLine+1 .. nextHeadingLine-1]
// or EOF for the last section. The line before the first `##` (the H1 title and any lead paragraph) is
// exposed separately as `preamble`, never silently dropped.
// ---------------------------------------------------------------------------

function splitH2Sections(lines) {
  const headingIdx = []
  for (let i = 0; i < lines.length; i++) {
    if (/^##(?!#)\s+\S/.test(lines[i])) headingIdx.push(i)
  }
  const sections = []
  for (let k = 0; k < headingIdx.length; k++) {
    const h = headingIdx[k]
    const nextH = k + 1 < headingIdx.length ? headingIdx[k + 1] : lines.length
    sections.push({
      heading: lines[h].replace(/^##\s+/, '').trim(),
      headingText: lines[h].trim(),
      headingLine: h + 1, // 1-indexed
      startLine: h + 1, // citation span includes the heading line itself
      endLine: nextH, // 1-indexed, inclusive (last content line before next heading, or EOF)
    })
  }
  const preambleEnd = headingIdx.length ? headingIdx[0] : lines.length
  return { sections, preambleEndLine: preambleEnd } // preamble is lines[0..preambleEndLine-1], 0-indexed
}

// ---------------------------------------------------------------------------
// Markdown table detection — same discipline as modes.mjs's locateM3: the FIRST table (header row +
// `|---|` separator + contiguous data rows) found within a bounded span, never a tree-wide search.
// Every row in this repo's standards.md tables is one physical line (verified: no soft-wrapped cell
// text anywhere in the 21 files read for this module), so one table row = one citable source line.
// ---------------------------------------------------------------------------

function isTableRow(l) {
  return /^\|.*\|\s*$/.test(l)
}
function isSeparatorRow(l) {
  return /^\|[\s:|-]+\|\s*$/.test(l)
}

function splitTableRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function findFirstTable(lines, startLine, endLine) {
  // startLine/endLine are 1-indexed, inclusive, matching a splitH2Sections() section's bounds.
  let headerIdx = -1 // 0-indexed
  for (let i = startLine - 1; i < endLine; i++) {
    if (isTableRow(lines[i]) && i + 1 < endLine && isSeparatorRow(lines[i + 1])) { headerIdx = i; break }
  }
  if (headerIdx === -1) return null
  const rows = []
  for (let i = headerIdx + 2; i < endLine; i++) {
    if (!isTableRow(lines[i])) break
    rows.push({ line: i + 1, cells: splitTableRow(lines[i]) }) // 1-indexed line
  }
  return {
    headerLine: headerIdx + 1, // 1-indexed
    headerCells: splitTableRow(lines[headerIdx]),
    rows,
  }
}

// ---------------------------------------------------------------------------
// Column-label normalization and alias matching. Loose on purpose — the real safety net is
// normalizeGradeCell()'s strict VALUE mapping below (D5.3.1's "validate before evaluate" pattern,
// reused from modes.mjs's resolveMode/routeFor): a table whose "Authoritative"-looking column holds
// values this module cannot cleanly map to yes/draft/no fails the WHOLE table closed (parsed:false)
// rather than being included on a loose header match alone. This is what makes it safe for the
// standard-name/body/edition aliases below to be generous: a table that merely LOOKS like it might be
// a standards table (e.g. a "Skill step | Authoritative standard" mapping table, where the "authoritative"
// substring matches but the column holds prose, not a grade) fails the value check and returns as a
// raw section instead of a fabricated row.
// ---------------------------------------------------------------------------

function normalizeColumnLabel(cell) {
  return cell
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\([^)]*\)/g, '') // drop parenthetical qualifiers: "Edition (pinned)" -> "Edition "
    .replace(/\?/g, '')
    .trim()
    .toLowerCase()
}

function classifyColumn(normalizedLabel) {
  if (normalizedLabel.includes('authoritative') || normalizedLabel === 'grade') return 'grade'
  if (
    normalizedLabel.includes('standard') || normalizedLabel.includes('framework') ||
    normalizedLabel === 'source' || normalizedLabel === 'paper' || normalizedLabel === 'discipline' ||
    normalizedLabel === 'theorem' || normalizedLabel === 'convention'
  ) return 'name'
  if (normalizedLabel.includes('body') || normalizedLabel.includes('publisher') || normalizedLabel.includes('issuing') || normalizedLabel === 'author' || normalizedLabel === 'origin') return 'body'
  if (normalizedLabel.includes('edition') || normalizedLabel.includes('version') || normalizedLabel === 'pin' || normalizedLabel === 'pinned edition') return 'edition'
  return 'role'
}

// normalizeGradeCell — strict. Strips markdown, takes the leading token, maps it to the D3.6 enum
// {yes, draft, no}, or returns null if the cell does not cleanly say one of those (ADR-0005: never
// guess). Handles both vocabularies measured across the 21 shelves: "**Yes**" / "**Draft**" / "**No**"
// (the prose-legend form) and "**true**" / "**false**" (loop-algo's/loop-pattern's `authoritative: true`
// flag form — no shelf uses a bare `draft` boolean, which is consistent with every shelf's own claim
// that "no entry on this shelf carries this grade" wherever it applies).
function normalizeGradeCell(cell) {
  const stripped = cell.replace(/`/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
  const m = /^([A-Za-z]+)/.exec(stripped)
  if (!m) return null
  const token = m[1].toLowerCase()
  if (token === 'yes' || token === 'true') return 'yes'
  if (token === 'draft') return 'draft'
  if (token === 'no' || token === 'false') return 'no'
  return null
}

// ---------------------------------------------------------------------------
// parseStandardsTable — attempt to parse one table as one-row-per-standard. Requires a recognized
// grade column whose every non-empty cell maps cleanly via normalizeGradeCell(); if that requirement
// is not met the whole table is rejected (returns null) and the caller falls back to the raw-section
// path — D5.3.5 atomicity, enforced here rather than assumed.
// ---------------------------------------------------------------------------

function parseStandardsTable(table) {
  const roles = table.headerCells.map((c) => classifyColumn(normalizeColumnLabel(c)))
  const gradeCol = roles.indexOf('grade')
  if (gradeCol === -1) return null // no grade column at all — this table does not carry the vocabulary

  let nameCol = roles.indexOf('name')
  if (nameCol === -1) nameCol = 0 // fall back to the first column as the name — a structural default
  // about WHICH column plays the name role, not a guess about any cell's content.
  const bodyCol = roles.indexOf('body')
  const editionCol = roles.indexOf('edition')
  const roleCols = roles.map((r, i) => (r === 'role' ? i : -1)).filter((i) => i !== -1)

  const parsedRows = []
  for (const row of table.rows) {
    if (row.cells.length !== table.headerCells.length) return null // shape mismatch — whole table fails closed
    const gradeCell = row.cells[gradeCol]
    const grade = gradeCell.trim() === '' ? 'unstated' : normalizeGradeCell(gradeCell)
    if (grade === null) return null // a cell in the grade column that doesn't map — never guess; fail the table
    const roleText = roleCols.map((i) => row.cells[i]).filter((t) => t.trim() !== '').join('; ')
    parsedRows.push({
      standard: row.cells[nameCol],
      body: bodyCol === -1 ? null : row.cells[bodyCol],
      edition: editionCol === -1 ? null : row.cells[editionCol],
      grade,
      role: roleText || null,
      line: row.line,
    })
  }
  return parsedRows
}

// ---------------------------------------------------------------------------
// Public: parseSection — the atomic unit (ADR-0005 §D5.3.5). Tries the section's first table; on
// success returns { parsed:true, entries:[...] } with one citation per row; on failure (no table, or
// a table that fails the grade-column requirement) returns { parsed:false, rawText, reason } for the
// WHOLE section — this is the "return sections rather than failing" behavior loop-engine's lineage
// table and six prose sub-sections both exercise, and the same path loop-incident/loop-operate's
// zero-table-row prose sections take.
// ---------------------------------------------------------------------------

function parseSection(relFile, lines, skill, section) {
  const table = findFirstTable(lines, section.startLine, section.endLine)
  let parsedRows = null
  let reason = null
  if (!table) {
    reason = `no Markdown table found under "${section.heading}"`
  } else {
    parsedRows = parseStandardsTable(table)
    if (!parsedRows) {
      reason = `a table exists under "${section.heading}" but does not carry a clean Authoritative/grade column mapping to yes/draft/no on every row — returned as prose rather than a half-parsed table (ADR-0005 §D5.3.5)`
    }
  }

  if (parsedRows) {
    return {
      parsed: true,
      entries: parsedRows.map((r) => ({
        skill,
        section: section.headingText,
        parsed: true,
        standard: r.standard,
        body: r.body,
        edition: r.edition,
        grade: r.grade,
        role: r.role,
        citation: citeSpan(relFile, lines, section.headingText, r.line, r.line),
      })),
    }
  }

  const rawText = lines.slice(section.startLine - 1, section.endLine).join('\n')
  return {
    parsed: false,
    unparsed: {
      skill,
      section: section.headingText,
      reason,
      rawText,
      citation: citeSpan(relFile, lines, section.headingText, section.startLine, section.endLine),
    },
  }
}

// ---------------------------------------------------------------------------
// Confirmation-log extraction — see the file header for the full rationale. Two shapes, tried in
// order; the first to match wins (a shelf carries exactly one real confirmation log, even when a
// preamble line also mentions "the foot").
// ---------------------------------------------------------------------------

const CONFIRMATION_HEADING_RE = /confirmation log/i
const CONFIRMATION_INLINE_RE = /^(?:-\s+|\d+\.\s+)?\*\*Confirmation log\b/
const CONFIRMED_ON_INLINE_RE = /Confirmation log\s*[—-]\s*(\d{4}-\d{2}-\d{2})/i
const CONFIRMED_ON_HEADING_RE = /confirmed[^.\n]*?\bon\s+(\d{4}-\d{2}-\d{2})/i
// Each pattern tolerates a bold marker (`**`) landing between two words of the phrase itself — e.g.
// loop-integrate's "**not** independently re-confirmed" bolds only the first word — by allowing an
// optional `\*{0,2}\s*` between tokens rather than requiring the caveat phrase to be one contiguous
// unmarked run of text.
const OPEN_ITEM_MARKER_PATTERNS = [
  /not\*{0,2}\s*independently\*{0,2}\s*re-confirmed/i,
  /not\*{0,2}\s*re-confirmed/i,
  /deliberately\*{0,2}\s*left/i,
  /deliberately\*{0,2}\s*unpinned/i,
  /not\*{0,2}\s*confirmed/i,
  /unconfirmed/i,
]

function findOpenItemMarker(line) {
  for (const re of OPEN_ITEM_MARKER_PATTERNS) {
    const m = re.exec(line)
    if (m) return m.index
  }
  return -1
}

function lineHasOpenItemMarker(line) {
  return findOpenItemMarker(line) !== -1
}

// Public: locateConfirmationLog — try the H2-heading shape first (loop-build's bare "## Confirmation
// log", loop-design's "## Re-check cadence and confirmation log"), then the inline shape (bold
// paragraph / bold bullet / numbered item — every other shelf, including the four that also carry a
// "see the foot" preamble sentence, which never matches CONFIRMATION_INLINE_RE because it is not
// itself bold). Returns { found:false, reason } — never an ok:false error — when a shelf's file reads
// fine but genuinely carries neither shape; that is a fact about the shelf, not a tool failure.
function locateConfirmationLog(relFile, lines, skill) {
  const { sections } = splitH2Sections(lines)
  const headingSection = sections.find((s) => CONFIRMATION_HEADING_RE.test(s.heading))

  if (headingSection) {
    const text = lines.slice(headingSection.startLine - 1, headingSection.endLine).join('\n')
    const dateMatch = CONFIRMED_ON_HEADING_RE.exec(text)
    const openItems = []
    for (let i = headingSection.headingLine; i < headingSection.endLine; i++) {
      // headingSection.headingLine is 1-indexed; lines[] is 0-indexed, so this skips the heading itself.
      if (lineHasOpenItemMarker(lines[i])) openItems.push(lines[i].trim())
    }
    return {
      found: true,
      shape: 'heading',
      confirmedOn: dateMatch ? dateMatch[1] : null,
      openItems,
      rawText: text,
      citation: citeSpan(relFile, lines, headingSection.headingText, headingSection.startLine, headingSection.endLine),
    }
  }

  let matchLineIdx = -1 // 0-indexed, last match wins ("at the foot")
  for (let i = 0; i < lines.length; i++) {
    if (CONFIRMATION_INLINE_RE.test(lines[i])) matchLineIdx = i
  }
  if (matchLineIdx === -1) {
    return {
      found: false,
      reason: `no "## ...confirmation log..." heading and no bold "**Confirmation log" paragraph/bullet/numbered-item found anywhere in ${relFile}`,
    }
  }

  const line = lines[matchLineIdx]
  // confirmedOn — try the tight "Confirmation log — DATE" adjacency first (true for the large
  // majority of shelves); when the date is further into the same opening bold clause instead (e.g.
  // loop-integrate's "**Confirmation log — every pin ... verified ... on 2026-07-26.**"), fall back to
  // the first date found anywhere inside that SAME bold clause — still a bounded, coordinate-anchored
  // search (the opening `**...**` span this line already matched on), never a scan of the whole line.
  let dateMatch = CONFIRMED_ON_INLINE_RE.exec(line)
  if (!dateMatch) {
    const boldClause = /^(?:-\s+|\d+\.\s+)?\*\*(.*?)\*\*/.exec(line)
    if (boldClause) {
      const inClause = /(\d{4}-\d{2}-\d{2})/.exec(boldClause[1])
      if (inClause) dateMatch = inClause
    }
  }
  const openItems = []
  const markerIdx = findOpenItemMarker(line)
  if (markerIdx !== -1) {
    // Back up to the nearest preceding bold-open `**` so the captured clause keeps its own heading
    // ("**Not independently re-confirmed...**") rather than starting mid-word.
    const boldOpen = line.lastIndexOf('**', markerIdx)
    openItems.push(line.slice(boldOpen !== -1 ? boldOpen : markerIdx).trim())
  }

  // Section this line falls under, for the citation's `section` field.
  const { sections: allSections } = splitH2Sections(lines)
  const enclosing = [...allSections].reverse().find((s) => matchLineIdx + 1 >= s.startLine && matchLineIdx + 1 <= s.endLine)
  const sectionLabel = enclosing ? enclosing.headingText : '(no enclosing H2 heading)'
  const sectionEndLine = enclosing ? enclosing.endLine : lines.length // 1-indexed, inclusive

  // loop-docs's shape: the "Not (independently) re-confirmed" caveat is its OWN paragraph, one blank
  // line after the "**Confirmation log —" paragraph, rather than folded into the same sentence every
  // other shelf uses. Look one non-blank line ahead, bounded to the same section (never past a `##`
  // heading) — a single bounded lookahead, not an open-ended scan, so it cannot accidentally absorb
  // unrelated later prose. If that next paragraph opens bold and carries a caveat marker, it is part
  // of this shelf's confirmation log and is folded in verbatim, on its own line.
  let endLine = matchLineIdx + 1 // 1-indexed
  let nextIdx = matchLineIdx + 1
  while (nextIdx < sectionEndLine && lines[nextIdx].trim() === '') nextIdx++
  if (nextIdx < sectionEndLine && /^\*\*/.test(lines[nextIdx]) && lineHasOpenItemMarker(lines[nextIdx])) {
    openItems.push(lines[nextIdx].trim())
    endLine = nextIdx + 1
  }

  const rawText = lines.slice(matchLineIdx, endLine).join('\n').trim()

  return {
    found: true,
    shape: 'inline',
    confirmedOn: dateMatch ? dateMatch[1] : null,
    openItems,
    rawText,
    citation: citeSpan(relFile, lines, sectionLabel, matchLineIdx + 1, endLine),
  }
}

// ---------------------------------------------------------------------------
// Public: readStandardsShelf — locate, split, parse every section, extract the confirmation log.
// Composes on locateStandardsDoc(); every call re-reads the file (ADR-0005 §D5.3.7).
// ---------------------------------------------------------------------------

function readStandardsShelf(root, skill) {
  const located = locateStandardsDoc(root, skill)
  if (!located.ok) return located

  const { lines, file } = located
  const { sections } = splitH2Sections(lines)

  const entries = []
  const unparsedSections = []
  for (const section of sections) {
    // The section that carries the confirmation log's own inline paragraph (typically the last,
    // "Edition discipline"-titled section) is still run through the same table-vs-prose parse as
    // every other section — the confirmation log itself is extracted separately, below, from the
    // whole document, so no special-casing is needed here to avoid double work turning into a bug.
    const result = parseSection(file, lines, skill, section)
    if (result.parsed) entries.push(...result.entries)
    else unparsedSections.push(result.unparsed)
  }

  const log = locateConfirmationLog(file, lines, skill)

  return {
    ok: true,
    skill,
    file,
    sectionsCount: sections.length,
    entries,
    unparsedSections,
    confirmationLog: log.found
      ? { confirmedOn: log.confirmedOn, openItems: log.openItems, rawText: log.rawText, citation: log.citation, shape: log.shape }
      : null,
    confirmationLogReason: log.found ? null : log.reason,
    citation: citeSpan(file, lines, '(whole file)', 1, lines.length),
  }
}

// ---------------------------------------------------------------------------
// Public: readAllStandardsShelves — every skill's shelf, discovered live (listSkillsWithStandardsShelf).
// ---------------------------------------------------------------------------

function readAllStandardsShelves(root) {
  const listed = listSkillsWithStandardsShelf(root)
  if (!listed.ok) return listed
  return {
    ok: true,
    shelvesSearched: listed.skills.length,
    shelves: listed.skills.map((skill) => readStandardsShelf(root, skill)),
  }
}

// ---------------------------------------------------------------------------
// Public: searchStandards — composes the two lookup modes mcp/tool-contracts.json D3.6's
// standards_shelf inputSchema anyOf(skill, query) describes. `skill` narrows to one shelf (returning
// its own confirmationLog); `query` free-text-matches standard/body/role/rawText across every shelf's
// entries and unparsedSections, optionally filtered by `grade`, capped at `limit` (default 10, max 50
// per D3.6). This is the search composition only — assembling it into the full tools/call envelope
// (citations[] at the top level, isError, structuredContent) is the tool layer's job, same posture as
// mcp/lib/boundary.mjs's "Not implemented here" note below.
// ---------------------------------------------------------------------------

function searchStandards(root, { skill, query, grade, limit } = {}) {
  if (grade !== undefined && grade !== null && !['yes', 'draft', 'no'].includes(grade)) {
    return { ok: false, code: 'invalid_argument', error: `grade must be one of "yes", "draft", "no"; got ${JSON.stringify(grade)}`, fix: 'Pass grade as one of the plugin\'s three authority grades, or omit it.' }
  }
  const effectiveLimit = limit === undefined || limit === null ? 10 : limit
  if (!Number.isInteger(effectiveLimit) || effectiveLimit < 1 || effectiveLimit > 50) {
    return { ok: false, code: 'invalid_argument', error: `limit must be an integer between 1 and 50; got ${JSON.stringify(limit)}`, fix: 'Pass limit between 1 and 50, or omit it for the default of 10.' }
  }

  if ((skill === undefined || skill === null) && (query === undefined || query === null)) {
    return { ok: false, code: 'invalid_argument', error: 'searchStandards requires either "skill" (one shelf) or "query" (free text across all shelves)', fix: 'Pass skill:"<skill-name>" for one shelf, or query:"<free text>" to search every shelf.' }
  }

  if (skill !== undefined && skill !== null) {
    const shelf = readStandardsShelf(root, skill)
    if (!shelf.ok) return shelf
    let entries = shelf.entries
    if (grade) entries = entries.filter((e) => e.grade === grade)
    entries = entries.slice(0, effectiveLimit)
    return {
      ok: true,
      entries,
      unparsedSections: shelf.unparsedSections,
      shelvesSearched: 1,
      shelfConfirmation: shelf.confirmationLog,
      authorityNote: AUTHORITY_NOTE,
    }
  }

  const q = String(query).trim()
  if (q === '') {
    return { ok: false, code: 'invalid_argument', error: 'query must be a non-empty string', fix: 'Pass a non-empty free-text query, e.g. "SLSA provenance".' }
  }
  const needle = q.toLowerCase()
  const all = readAllStandardsShelves(root)
  if (!all.ok) return all

  const matchedEntries = []
  const matchedUnparsed = []
  for (const shelf of all.shelves) {
    if (!shelf.ok) continue // a per-shelf source_missing is not the whole search's failure
    for (const e of shelf.entries) {
      if (grade && e.grade !== grade) continue
      const hay = [e.standard, e.body, e.role].filter(Boolean).join(' ').toLowerCase()
      if (hay.includes(needle)) matchedEntries.push(e)
    }
    for (const u of shelf.unparsedSections) {
      if (grade) continue // grade filtering has no meaning on an unparsed (no-grade) section
      const hay = `${u.section} ${u.rawText}`.toLowerCase()
      if (hay.includes(needle)) matchedUnparsed.push(u)
    }
  }

  return {
    ok: true,
    entries: matchedEntries.slice(0, effectiveLimit),
    unparsedSections: matchedUnparsed.slice(0, effectiveLimit),
    shelvesSearched: all.shelvesSearched,
    authorityNote: AUTHORITY_NOTE,
  }
}

// D3.6_tools standards_shelf.resultSchema.authorityNote — const, quoted verbatim from
// mcp/tool-contracts.json so the tool layer does not need a second copy of this sentence.
const AUTHORITY_NOTE = 'This reports what the shelf SAYS and when the shelf last checked, never what is true today. Editions rot; the shelves say so and set a re-check cadence. Confirm against a primary source before citing an edition in a deliverable — loop-skill SKILL.md step 4: confirm every version, edition, licence and date against a primary source, not from memory.'

// ---------------------------------------------------------------------------
// Not implemented here (recorded, not silently dropped — same convention as mcp/lib/boundary.mjs's
// file-bottom "Not implemented here" note):
//
//   recheckCadence — mcp/tool-contracts.json's shelfConfirmation.recheckCadence field. The 21 shelves
//   phrase their re-check cadence in genuinely free prose ("roughly twice a year", "quarterly for the
//   fast-moving section, annually for the rest", "the confirmation log below records dates rather than
//   promising diligence") with no consistent bold marker or heading to locate by coordinate the way
//   the confirmation log itself has. Extracting a single string per shelf would mean guessing WHICH
//   sentence is "the" cadence when a shelf states several at different granularities (per-section vs.
//   whole-shelf) — exactly the silent-default ADR-0005 forbids. Left null on every confirmationLog
//   this module returns; a caller that needs it reads the shelf's own "Edition discipline" section,
//   which every readStandardsShelf() result already returns verbatim (parsed:false, in unparsedSections
//   or folded into the confirmation-log rawText for the two heading-shaped shelves).
//
//   A shelf-level "grade legend" extraction (each shelf's own worded definitions of yes/draft/no,
//   which appear in at least three different phrasings across the 21 files — see the file header).
//   The per-ENTRY grade field (D3.6's entries[].grade enum) is what "carries the three authority
//   grades through" in the sense mcp/tool-contracts.json's resultSchema actually specifies; a second,
//   free-text legend extraction was judged out of scope for the same reason recheckCadence is.
// ---------------------------------------------------------------------------

export {
  DEFAULT_ROOT,
  listSkillsWithStandardsShelf,
  locateStandardsDoc,
  splitH2Sections,
  findFirstTable,
  splitTableRow,
  normalizeColumnLabel,
  classifyColumn,
  normalizeGradeCell,
  parseStandardsTable,
  parseSection,
  locateConfirmationLog,
  readStandardsShelf,
  readAllStandardsShelves,
  searchStandards,
  AUTHORITY_NOTE,
}
