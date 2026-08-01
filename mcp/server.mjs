// mcp/server.mjs — heimdall-mcp, the stdio JSON-RPC shell (Phase 3, S7).
//
// This file is deliberately the LAST thing written in Phase 3 and deliberately THIN: it owns
// wire framing, protocol-version negotiation, method dispatch, the static tool/resource registry,
// and process lifecycle. It owns no doctrine — every fact in every answer comes from calling S1-S6
// (mcp/lib/{route_node,estimate_phase,boundary_lookup,standards_shelf,run_gate,resources}.mjs),
// which themselves call the Phase-2 spine (mcp/lib/{modes,estimate,boundary,standards}.mjs). This
// file never reads execution-modes.md, boundary-audit.json or a standards.md itself.
//
// ============================================================================================
// GOVERNING LAW, applied in this file:
//   ADR-0001 (mcp/ADR-0001-runtime-and-dependency.md) — zero-dependency, hand-rolled newline-
//     delimited JSON-RPC 2.0 over stdio, Node stdlib only. Point 1: stdout is the transport, never
//     write anything non-protocol to it; diagnostics to stderr. Point 2: echo the client's
//     protocolVersion back verbatim when it is one of the five frozen supported versions, else
//     advertise 2025-06-18. Point 3: the seven methods below; everything else is -32601; a message
//     with id absent or null is a notification and MUST NOT get a response; accept a batch array.
//     Point 5: -32700/-32601/-32602/-32603 at the JSON-RPC layer; a domain-level tool failure is a
//     SUCCESSFUL tools/call result with isError:true, never a JSON-RPC error (mirrored below in
//     toMcpToolResult()). Point 6: no clock/randomness in tool OUTPUT (this file adds none; the one
//     legitimate exception, run_gate's own durationMs/verdict, is the spine's disclosed exception,
//     not this file's).
//   ADR-0002 (docs/design/ADR-0002-dependency-seam-and-boot-contract.md) — D2.1: every import
//     specifier reachable from mcp/server.mjs begins with node: (see the ARCHITECTURE NOTE below
//     for the one disclosed, unavoidable exception every S1-S6 file already flagged). D2.4: the
//     boot-failure contract (C1-C7) this file implements directly — see BOOT SELF-CHECK below.
//     D2.5: the runtime-pin.json "bootContract" block this file's exit codes and stderr shape
//     match. D2.6: this file does not touch CONTRIBUTING.md — that edit is a separate action item
//     "in the same commit that adds mcp/server.mjs", not part of this file's own diff.
//   ADR-0003 (docs/design/ADR-0003-tool-contracts-and-call-sites.md) + mcp/tool-contracts.json —
//     the D3.1 envelope, D3.2 citations, D3.3 mode advertise-three/accept-five, D3.4 annotations,
//     D3.5 error envelope and the -32602/isError seam, D3.7 resources. Where a tool-handler file
//     (S1-S5) already disclosed a divergence from tool-contracts.json's stale D3.6 entry (route_node
//     ADR-0006 width structure + required nodeShape; boundary_lookup's full ADR-0007 rewrite;
//     run_gate's v1-scope narrowing to validate.mjs only, no input properties), this file's
//     registered inputSchema/outputSchema/description follow the IMPLEMENTATION, not the stale
//     contract file — matching what every S1-S5 file already did when the two disagreed.
// ============================================================================================
//
// ============================================================================================
// ARCHITECTURE NOTE — inheriting the open question every S1-S3 file already raised and did not
// resolve, because resolving it is a design decision above a single task's scope, not a thing to
// pick silently (route_node.mjs, estimate_phase.mjs, boundary_lookup.mjs "ARCHITECTURE NOTE").
//
// ADR-0002 §D2.1 states the invariant as "every import specifier reachable from mcp/server.mjs
// begins with node:", read fully literally. Taken that literally, it would forbid THIS file from
// importing mcp/lib/route_node.mjs, mcp/lib/resources.mjs, or any of the other five tool-handler /
// resource-layer files S7 exists to wire together — which cannot be what is intended, since a
// stdio shell that cannot reach its own tool handlers cannot serve tools/call at all. The reading
// S1-S3 already adopted, and this file adopts identically: D2.1's no-relative-import discipline
// governs SIBLING spine modules avoiding lateral coupling to EACH OTHER (modes.mjs/estimate.mjs/
// boundary.mjs/standards.mjs do not import one another), and the §D2.3.6 assertNoDependencies()
// grep is aimed at THIRD-PARTY specifiers reaching the module graph, not at this repo's own
// mcp/lib/*.mjs files. The five mcp/lib/*.mjs specifiers below are the only non-node: imports in
// this file; every other import is node:-only. If the golden-query gate's assertNoDependencies()
// is ever built to the fully literal reading, it will flag these five imports (and route_node.mjs's
// two, estimate_phase.mjs's two, boundary_lookup.mjs's one) identically — at which point either
// ADR-0002 gets a stated carve-out for intra-mcp/lib composition, or the tool layer needs a
// different composition mechanism. Not resolved here, same as upstream.
// ============================================================================================

import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The five Phase-3 tool handlers (S1-S5).
import { routeNode } from './lib/route_node.mjs'
import { estimatePhase } from './lib/estimate_phase.mjs'
import { boundaryLookup } from './lib/boundary_lookup.mjs'
import { standardsShelf, GRADE_VALUES } from './lib/standards_shelf.mjs'
import { runGate, RUN_GATE_TOOL_DESCRIPTION, RUN_GATE_ANNOTATIONS, RUN_GATE_SCOPE_NOTE } from './lib/run_gate.mjs'

// The read-only resource layer (S6).
import { listResources, readResource, RESOURCES_CAPABILITY, SUGGESTED_JSONRPC_ERROR_CODE } from './lib/resources.mjs'

// Closed vocabularies reused for tools/list's inputSchema literals, imported from the spine's own
// exported constants rather than re-typed here (ADR-0005 — never invent a value the spine already
// derives correctly). CANONICAL_KINDS/CANONICAL_MODES come from modes.mjs (the §M8 authority);
// NODE_SHAPES and SIZE_RATIONAL come from estimate.mjs, which is what route_node.mjs,
// estimate_phase.mjs and this file all independently import them from — none of the four re-declare
// a second copy of either array.
import { CANONICAL_KINDS, CANONICAL_MODES } from './lib/modes.mjs'
import { NODE_SHAPES, SIZE_RATIONAL } from './lib/estimate.mjs'

// Doc-shape boot-self-check probes (see BOOT SELF-CHECK below) — the cheap, locate-only readers
// each spine module already exports for exactly this kind of reuse. No new extraction logic is
// written here; these are the same functions readModesM8()/readModesM6()/boundaryLookup()/
// searchStandards() call internally on every tool call, invoked once, up front, so a shape break is
// visible in the boot log instead of only surfacing on the first tools/call that needs it.
import { locateM8 } from './lib/modes.mjs'
import { locateM6Section } from './lib/estimate.mjs'
import { readBoundaryAudit } from './lib/boundary.mjs'
import { listSkillsWithStandardsShelf } from './lib/standards.mjs'

const SIZE_VALUES = Object.freeze(Object.keys(SIZE_RATIONAL)) // ['compact','standard','long-form'] —
// read from the spine's own exported table, identical to estimate_phase.mjs's own derivation.
const PLANNER_VALUES = Object.freeze(['opus', 'fable']) // §M7a/§M7b — not exported by any spine
// module (route_node.mjs and estimate_phase.mjs each keep their own small local copy too); kept
// here purely for tools/list's advertised inputSchema, which is documentation (ADR-0003 §D3.1:
// "the schema is documentation with teeth only at the gate") — the handlers enforce the real check.

// -------------------------------------------------------------------------------------------------
// Identity + root resolution — ADR-0002 §D2.4 C7: "ROOT derives from import.meta.url, not
// process.cwd()." mcp/server.mjs sits ONE level above mcp/lib/, so this is one path.resolve(HERE,
// '..') where every mcp/lib/*.mjs file itself does path.resolve(HERE, '..', '..') from mcp/lib/ —
// same arithmetic, different depth, exactly as run_gate.mjs's own header comment predicted this
// file would need. HEIMDALL_ROOT overrides it (THELOOPSKILL_ROOT accepted as a deprecated alias) (the packaged-install escape hatch); none of the
// mcp/lib/*.mjs files read that env var themselves (verified: no HEIMDALL_ROOT or THELOOPSKILL_ROOT reference in any
// of them), so this resolved ROOT is passed explicitly as { root: ROOT } on every handler call
// below — omitting it would silently fall back to each handler's OWN independently-computed
// DEFAULT_ROOT, which happens to agree with this file's DEFAULT_ROOT but would silently ignore an
// operator's HEIMDALL_ROOT override. That would be exactly the silent default ADR-0005
// forbids, so it is never omitted.
// -------------------------------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/
const DEFAULT_ROOT = path.resolve(HERE, '..') // repo root, one level up from mcp/
// HEIMDALL_ROOT is the name; THELOOPSKILL_ROOT is accepted one major as a deprecated
// alias (renamed with heimdall-mcp 0.2.0) so existing wiring keeps booting — but it says
// so on stderr, once, at startup (see below), rather than silently.
const LEGACY_ROOT = process.env.THELOOPSKILL_ROOT
const ROOT = process.env.HEIMDALL_ROOT
  ? path.resolve(process.env.HEIMDALL_ROOT)
  : LEGACY_ROOT ? path.resolve(LEGACY_ROOT) : DEFAULT_ROOT

const SERVER_NAME = 'heimdall-mcp'
const SERVER_VERSION = '0.2.0' // mcp/runtime-pin.json serverInfo.version — must move together
const PROTOCOL_ADVERTISE = '2025-06-18' // mcp/runtime-pin.json protocol.advertise
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
  '2024-10-07',
]) // mcp/runtime-pin.json protocol.supportedVersions, ADR-0001 point 2

// -------------------------------------------------------------------------------------------------
// stderr — the ONLY diagnostic channel (ADR-0001 point 1, ADR-0002 C2). Every line is prefixed
// "heimdall-mcp: " (ADR-0002 C3) so an operator scanning Claude Code's own stderr can grep it
// out. No console.log anywhere in this file or reachable from it — stdout carries protocol bytes
// only, including on every failure path.
// -------------------------------------------------------------------------------------------------

function stderrLine(text) {
  process.stderr.write(`heimdall-mcp: ${text}\n`)
}

if (!process.env.HEIMDALL_ROOT && LEGACY_ROOT) {
  stderrLine('THELOOPSKILL_ROOT is deprecated (server renamed heimdall-mcp in 0.2.0) — rename the variable to HEIMDALL_ROOT; the alias will be dropped in the next major')
}

// ADR-0002 §D2.4 C4 — the three exact literal strings. Reproduced verbatim (not paraphrased; the
// gate this ADR anticipates asserts on them byte-for-byte). <ROOT>/<process.version>/<mcp dir> are
// substituted in, never the surrounding grammar.
function sourceDocsMissingMessage(what) {
  return `heimdall-mcp: source docs not found — ${what} under ${ROOT} · fix: set HEIMDALL_ROOT to a Heimdall checkout, or correct the server path in .mcp.json`
}
function nodeTooOldMessage() {
  return `heimdall-mcp: node 18 or newer required — running ${process.version} · fix: upgrade node, or point .mcp.json "command" at a newer binary`
}

// -------------------------------------------------------------------------------------------------
// BOOT SELF-CHECK
//
// Two independent checks, run once before the transport connects.
//
// 1. Node version (ADR-0002 C1/C4 "Node too old"). This is a genuine C1 "configError" — the process
//    cannot run correctly on an old runtime, there is nothing to degrade to, and the contract's own
//    literal string is used. Exits 78, per C1.
//
// 2. D4 doc-shape probes (ADR-0004's E1/§M6-locate/boundary-read/shelf-listing — the cheap,
//    locate-only entry points each spine module already exports) against the four source
//    substrates the five tools read: execution-modes.md §M8, execution-modes.md §M6,
//    docs/design/boundary-audit.json, and .claude/skills/*/references/standards.md. This is the
//    mechanism that makes "a shape break surfaces at boot rather than mid-conversation" true: the
//    stderr line for a moved/missing/malformed doc is written the moment the process starts,
//    before any client has sent a single tools/call.
//
//    DISCLOSED, DELIBERATE DIVERGENCE from the literal words of this task's own brief ("exits
//    non-zero ... if the source docs have moved"): a doc-shape probe failure here does NOT exit.
//    ADR-0002 §D2.4 C6 is unambiguous and repeated three times over ("Missing source docs never
//    exits", "the tool registry is static ... initialize and tools/list must succeed ... The server
//    therefore always completes initialize and tools/list, even with an unreadable source tree",
//    D2.5's own machine-readable bootContract.degradeNotDie.neverExitsOn: "missing or unreadable
//    source documents") and the reasoning is measured, not asserted: §6.1 of that ADR shows the SDK
//    client reports the identical "-32000 Connection closed" for every cause of a dead server, so
//    exiting on a missing doc would convert a one-line, in-band, actionable fix into an opaque
//    connection failure with the diagnosis only in a log the caller may never see. This file follows
//    the binding ADR over the brief's imprecise paraphrase: a probe failure is logged, legibly, once,
//    at boot (satisfying "surfaces at boot rather than mid-conversation" for anyone reading server
//    stderr) and the affected tool(s) then answer every call with isError:true and this same
//    diagnosis in band (ADR-0002 C6's actual mechanism), rather than the server refusing to start.
//    The one case that DOES exit is still exactly C1's set: Node too old, and — mandated but
//    unreachable under ADR-0001 verdict (c), since this file has no third-party import to fail to
//    resolve — a missing dependency on the reversal path (not applicable to this zero-dependency
//    server; recorded here only so a future reversal-path implementer sees where it would go).
// -------------------------------------------------------------------------------------------------

function runDocShapeProbes() {
  const probes = [
    {
      what: 'no "## M8." heading/fence found in execution-modes.md',
      label: '§M8 (route_node + estimate_phase mode/routing source)',
      run: () => locateM8(ROOT),
    },
    {
      what: 'no "## M6." heading found in execution-modes.md',
      label: '§M6 (estimate_phase pricing source)',
      run: () => locateM6Section(ROOT),
    },
    {
      what: 'docs/design/boundary-audit.json',
      label: 'boundary-audit.json (boundary_lookup source)',
      run: () => readBoundaryAudit(ROOT),
    },
    {
      what: '.claude/skills (standards_shelf source)',
      label: 'standards shelves (standards_shelf source)',
      run: () => listSkillsWithStandardsShelf(ROOT),
    },
  ]

  for (const probe of probes) {
    let result
    try {
      result = probe.run()
    } catch (e) {
      result = { ok: false, error: e && e.message ? e.message : String(e) }
    }
    if (!result || result.ok !== true) {
      const detail = (result && (result.error || result.file)) || 'unknown probe failure'
      stderrLine(
        `boot doc-shape probe failed — ${probe.label}: ${detail} · fix: set HEIMDALL_ROOT to a Heimdall checkout, or correct the server path in .mcp.json ` +
          `(non-fatal — ADR-0002 §D2.4 C6 degrade-not-die: initialize and tools/list still succeed; the affected tool(s) will answer isError:true with this same diagnosis)`
      )
    }
  }
}

function bootSelfCheck() {
  const major = parseInt(String(process.versions.node).split('.')[0], 10)
  if (!(Number.isFinite(major) && major >= 18)) {
    process.stderr.write(nodeTooOldMessage() + '\n')
    process.exit(78)
  }
  runDocShapeProbes()
}

// -------------------------------------------------------------------------------------------------
// The five tools — the static registry. Per ADR-0002 C6, "the tool registry is static — names,
// descriptions and hand-written JSON Schemas are literals in the source. Only the ANSWERS are
// parsed live." Nothing below reads a doc; every schema is a literal composed from the spine's own
// exported closed vocabularies (CANONICAL_KINDS, CANONICAL_MODES, NODE_SHAPES, SIZE_VALUES,
// GRADE_VALUES) plus this file's own PLANNER_VALUES, never from a document parsed at startup.
// -------------------------------------------------------------------------------------------------

// D3.2 citation schema — reused verbatim (mcp/tool-contracts.json D3.2_citation.schema) inside
// every result field and inside the shared error schema below.
const CITATION_SCHEMA = Object.freeze({
  type: 'object',
  required: ['file', 'section', 'startLine', 'endLine', 'sha256', 'resourceUri'],
  properties: {
    file: { type: 'string', description: 'Repo-relative POSIX path.' },
    section: { type: 'string', description: 'Markdown: the enclosing ATX heading, verbatim. JSON: an RFC 6901 pointer.' },
    startLine: { type: 'integer', minimum: 1 },
    endLine: { type: 'integer', minimum: 1 },
    sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
    excerpt: { type: 'string' },
    excerptTruncated: { type: 'boolean', default: false },
    resourceUri: { type: 'string', description: "heimdall:// URI of the same file, readable via this server's resources/read." },
  },
})

// D3.5 error schema — reused verbatim (mcp/tool-contracts.json D3.5_errorEnvelope.schema).
const ERROR_SCHEMA = Object.freeze({
  type: 'object',
  required: ['code', 'message', 'fix'],
  properties: {
    code: {
      type: 'string',
      enum: ['invalid_argument', 'unknown_mode', 'not_found', 'source_missing', 'source_unparseable', 'gate_unavailable', 'internal'],
    },
    message: { type: 'string' },
    fix: { type: 'string' },
    details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, issue: { type: 'string' } } } },
    fallback: { type: 'string', description: 'The manual procedure that answers this question with the server absent — same text as the call site fallback.' },
  },
})

const DEPRECATION_SCHEMA = Object.freeze({
  type: 'object',
  required: ['field', 'supplied', 'canonical', 'removedIn', 'citation'],
  properties: {
    field: { type: 'string', const: 'mode' },
    supplied: { type: 'string', enum: ['optimize', 'full'] },
    canonical: { type: 'string', enum: ['balanced', 'all-out'] },
    removedIn: { type: 'string', const: 'next major' },
    citation: CITATION_SCHEMA,
  },
})

// Wraps a per-tool `result` schema into the full ADR-0003 §D3.1 envelope. `result` itself is kept
// loosely typed for the four tools whose actual shape is a documented union (route_node's `width`
// structure per ADR-0006 §D6.1, boundary_lookup's outcome-discriminated result per ADR-0007 §D7) —
// this is a deliberate scope choice, not an oversight: ADR-0003 §D3.1 itself says "The envelope's
// if/then conditionals are draft 2020-12 and most clients will not enforce them. The server's own
// guarantee is what is normative; the schema is documentation with teeth only at the gate." The
// envelope-level fields below (ok/tool/authoringTimeOnly/serverVersion/citations/etc.) ARE exact —
// every S1-S5 handler's return shape was read to confirm this, byte for byte.
function envelopeOutputSchema(toolName, resultSchema) {
  return {
    type: 'object',
    required: ['ok', 'tool', 'authoringTimeOnly', 'serverVersion', 'citations'],
    properties: {
      ok: { type: 'boolean' },
      tool: { type: 'string', const: toolName },
      authoringTimeOnly: { type: 'boolean', const: true },
      serverVersion: { type: 'string', const: SERVER_VERSION },
      sourceRoot: { type: 'string', description: 'Absolute path of the repo root the answer was parsed from.' },
      result: { ...resultSchema, description: 'Present iff ok is true. ' + (resultSchema.description || '') },
      error: { ...ERROR_SCHEMA, description: 'Present iff ok is false.' },
      citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA, description: 'Required on BOTH branches — an error cites where the server looked.' },
      deprecations: { type: 'array', items: DEPRECATION_SCHEMA, default: [] },
      notes: { type: 'array', items: { type: 'string' }, default: [] },
    },
  }
}

const ROUTE_NODE_RESULT_SCHEMA = {
  type: 'object',
  description:
    "Amended by ADR-0006 §D6.1 relative to mcp/tool-contracts.json's stale route_node entry: width is a STRUCTURE (value/effective/shape/governingClause/cappedBy/m8WidthWouldSay/agreesWithM8/dispatch?), never a bare integer, and nodeShape is a REQUIRED input (never defaulted from taskType).",
  required: ['mode', 'planner', 'route', 'opts', 'width', 'dryLimit', 'modifierA', 'templateRule'],
  properties: {
    mode: { type: 'string', enum: CANONICAL_MODES, description: 'Canonical. Never an alias.' },
    planner: { type: 'string', enum: PLANNER_VALUES },
    route: {
      type: 'object',
      required: ['model', 'effort', 'pinning'],
      properties: {
        model: { type: ['string', 'null'], enum: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5', null] },
        effort: { type: ['string', 'null'], enum: ['medium', 'high', 'xhigh', 'max', null] },
        pinning: { type: 'string', enum: ['pinned', 'inherit'] },
      },
    },
    opts: { type: 'object', description: 'Exactly the keys optsFor() would set; omitted keys are ABSENT rather than null.' },
    width: {
      type: 'object',
      description: 'ADR-0006 §D6.1 width structure.',
      required: ['value', 'effective', 'shape', 'governingClause', 'cappedBy', 'm8WidthWouldSay', 'agreesWithM8'],
      properties: {
        value: { type: 'integer', enum: [1, 3, 5], description: 'The §M5/§M6-correct width.' },
        effective: { type: 'integer' },
        shape: { type: 'string', enum: NODE_SHAPES },
        governingClause: { type: 'object', properties: { text: { type: 'string' }, citation: CITATION_SCHEMA } },
        cappedBy: {},
        m8WidthWouldSay: { type: 'integer', description: "§M8's own bare WIDTH(kind) — disclosed cross-check only, never the tool's own answer (ADR-0006 §C1)." },
        agreesWithM8: { type: 'boolean' },
        dispatch: { type: 'string', description: 'Present when effective width >= 3.' },
      },
    },
    dryLimit: { type: 'integer', enum: [1, 2, 3] },
    modifierA: { type: 'string', enum: ['active', 'disabled-logged'] },
    dispatchRule: { type: 'string' },
    canonicalBlock: {
      type: 'object',
      properties: { text: { type: 'string' }, sha256: { type: 'string' }, citation: CITATION_SCHEMA },
      description: 'Present iff includeCanonicalBlock:true was supplied.',
    },
    templateRule: {
      type: 'string',
      const:
        'Authoring-time answer. Do NOT write these values into the template as literals: scripts/validate.mjs check 5 fails any bare model:/effort: literal outside the ROUTES block (CONTRIBUTING.md:77). Carry the canonical §M8 block verbatim and let optsFor(node, label) compute this at run time. Copy the block from execution-modes.md and prove it with `node scripts/validate.mjs`.',
    },
  },
}

const ESTIMATE_PHASE_RESULT_SCHEMA = {
  type: 'object',
  required: [
    'mode', 'compareTo', 'perNode', 'total', 'comparison', 'whatModeChanged', 'risks',
    'confirmationPrompt', 'requiresHumanConfirmation', 'bandRevision', 'calibrationWarning',
  ],
  properties: {
    mode: { type: 'string' },
    compareTo: { type: 'string' },
    perNode: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'taskType', 'items', 'width', 'agents', 'bandKind', 'tokensLow', 'tokensHigh', 'isUpperBound', 'citation'],
        properties: {
          label: { type: 'string' }, taskType: { type: 'string' },
          items: { type: 'integer' }, width: { type: 'integer', enum: [1, 3, 5] },
          agents: { type: 'integer' },
          multiplicandString: { type: 'string' },
          bandKind: { type: 'string', enum: ['scout / doc', 'implement', 'analyze / synthesize', 'verify / judge / critic', 'gating', 'planner', 'planner on Fable'] },
          sizeMultiplier: { type: 'number' },
          tokensLow: { type: 'integer' }, tokensHigh: { type: 'integer' },
          isUpperBound: { type: 'boolean' },
          citation: CITATION_SCHEMA,
        },
      },
    },
    total: { type: 'object', properties: { agents: { type: 'integer' }, phases: { type: 'integer' }, tokensLow: { type: 'integer' }, tokensHigh: { type: 'integer' } } },
    comparison: { type: 'object', properties: { mode: { type: 'string' }, agents: { type: 'integer' }, tokensLow: { type: 'integer' }, tokensHigh: { type: 'integer' }, ratioLow: { type: 'number' }, ratioHigh: { type: 'number' } } },
    whatModeChanged: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    agentGuidelineBreach: { type: 'object', properties: { exceeds: { type: 'boolean' }, guideline: { type: 'integer', const: 15 }, instruction: { type: 'string' } } },
    budgetRefusal: { type: 'object', properties: { refuses: { type: 'boolean' }, exits: { type: 'array', items: { type: 'string' } } }, description: 'Present iff budgetTokens was supplied.' },
    confirmationPrompt: { type: 'string' },
    requiresHumanConfirmation: { type: 'boolean', const: true },
    estimateBlock: { type: 'string' },
    bandRevision: { type: 'string' },
    calibrationWarning: { type: 'string' },
  },
}

const BOUNDARY_LOOKUP_RESULT_SCHEMA = {
  type: 'object',
  description:
    "Fully rewritten by ADR-0007 relative to mcp/tool-contracts.json's stale boundary_lookup entry (which described a scored matches[] array — ADR-0007 §4 measured that ranking as WRONG). Discriminated by result.outcome: 'exact' returns {outcome, matrixSize, authority, candidate, auditIntegrity}; 'candidates'|'unowned' return {outcome, query, queryDiscriminatingTerms, topDiscriminatingCount, dfMax, matrixSize, candidates[], separatingQuestions[], authority, auditIntegrity, decompositionSmell?}. No `matches`, no `against`, no `include` — see boundary_lookup.mjs's own ARCHITECTURE NOTE / DIVERGENCE comment.",
  required: ['outcome', 'matrixSize', 'authority', 'auditIntegrity'],
  properties: {
    outcome: { type: 'string', enum: ['exact', 'candidates', 'unowned'] },
    matrixSize: { type: 'integer', description: 'Live count of /matrix entries.' },
    authority: { type: 'string' },
    auditIntegrity: { type: 'object', description: "§D7.8 — the audit file's own debt summary, required on every answer." },
    candidate: { type: 'object', description: "Present iff outcome:'exact'." },
    candidates: { type: 'array', description: "Present iff outcome is 'candidates' or 'unowned'." },
    separatingQuestions: { type: 'array', description: '§D7.6 — one per adjacent pair in the shortlist.' },
    decompositionSmell: { description: "Present iff outcome:'unowned'." },
    query: { type: 'string' },
    queryDiscriminatingTerms: {},
    topDiscriminatingCount: {},
    dfMax: {},
  },
}

const STANDARDS_SHELF_RESULT_SCHEMA = {
  type: 'object',
  required: ['entries', 'unparsedSections', 'shelvesSearched', 'authorityNote'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        required: ['skill', 'section', 'parsed', 'citation'],
        properties: {
          skill: { type: 'string' }, section: { type: 'string' }, parsed: { type: 'boolean' },
          standard: { type: 'string' }, body: { type: 'string' }, edition: { type: 'string' },
          grade: { type: 'string', enum: [...GRADE_VALUES, 'unstated'] },
          role: { type: 'string' }, rawText: { type: 'string', description: 'Present when parsed is false.' },
          citation: CITATION_SCHEMA,
        },
      },
    },
    unparsedSections: { type: 'array', items: { type: 'object', required: ['skill', 'section', 'reason'], properties: { skill: { type: 'string' }, section: { type: 'string' }, reason: { type: 'string' } } } },
    shelfConfirmation: { type: 'object', properties: { confirmedOn: { type: 'string' }, recheckCadence: { type: 'string' }, openItems: { type: 'array', items: { type: 'string' } }, citation: CITATION_SCHEMA } },
    shelvesSearched: { type: 'integer' },
    authorityNote: { type: 'string' },
  },
}

const RUN_GATE_RESULT_SCHEMA = {
  type: 'object',
  description:
    "v1-scoped (see run_gate.mjs's own DIVERGENCE comment): spawns ONLY `node scripts/validate.mjs --json`, never scripts/smoke.mjs, so there is no runs[]/baseline shape here — result is the single validate.mjs run's parsed verdict, flat.",
  required: ['command', 'interpreter', 'scriptPath', 'exitCode', 'verdict', 'durationMs'],
  properties: {
    command: { type: 'string' }, interpreter: { type: 'string' }, scriptPath: { type: 'string' },
    exitCode: { type: 'integer' }, verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    timedOut: { type: 'boolean' }, timeoutMs: { type: 'integer' }, durationMs: { type: 'integer' },
    assertions: { type: 'integer' }, failureCount: { type: 'integer' }, warningCount: { type: 'integer' },
    failures: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' }, message: { type: 'string' }, citation: CITATION_SCHEMA } } },
    warnings: { type: 'array', items: { type: 'object' } },
    evidence: { type: 'string', description: "validate.mjs's own final summary line, verbatim." },
    evidenceSource: { type: 'string' },
    stdoutTruncatedByCap: { type: 'boolean' }, stderrTruncatedByCap: { type: 'boolean' },
  },
}

const TOOL_REGISTRY = Object.freeze([
  {
    name: 'route_node',
    title: 'Route a workflow node (§M3/§M8)',
    description:
      'Resolve the model, effort, verifier width and dry-limit a workflow node gets under a given mode, parsed live from loop-engine/references/execution-modes.md §M3 and §M8, with the file, section and line range cited for every value. Authoring-time only: this explains what the canonical ROUTES block will compute at run time. It does NOT replace the block — a routed template must still carry §M8 verbatim, and scripts/validate.mjs check 5 fails any bare model:/effort: literal outside it.',
    annotations: Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['taskType', 'nodeShape'],
      properties: {
        taskType: { type: 'string', enum: CANONICAL_KINDS, description: "The node's taskType. These ten are exactly the keys of every ROUTES[mode] map in §M8." },
        nodeShape: {
          type: 'string',
          enum: NODE_SHAPES,
          description: 'REQUIRED (ADR-0006 §D6.1.1) — never defaulted from taskType. §M5 DECIDED what width applies to; taskType:\'gating\' alone does not say whether this is a DECISION or a VERIFY shape.',
        },
        mode: { type: 'string', enum: CANONICAL_MODES, default: 'balanced', description: 'Run-level routing dial. Absent resolves to balanced silently (§M2:59).' },
        planner: { type: 'string', enum: PLANNER_VALUES, default: 'opus', description: "§M7a. Affects taskType:'planner' nodes and nothing else." },
        fableGate: { type: 'boolean', default: false, description: '§M7b. Legal only under mode all-out; accepted, ignored and reported as inert elsewhere.' },
        askIsThorough: { type: 'boolean', default: false, description: '§M5: under balanced, a standard verify/judge/critic widens 1→3 when the ask is thorough/audit/comprehensive.' },
        declaredLenses: { type: 'integer', minimum: 0, description: 'How many lenses the node declares.' },
        includeCanonicalBlock: { type: 'boolean', default: false, description: 'Return the §M8 block verbatim as live-parsed text plus its citation and sha256.' },
      },
    },
    outputSchema: envelopeOutputSchema('route_node', ROUTE_NODE_RESULT_SCHEMA),
    handler: (args, opts) => routeNode(args, opts),
  },
  {
    name: 'estimate_phase',
    title: "Price a phase's DAG (§M6 pre-flight arithmetic)",
    description:
      "Run §M6's deterministic pre-flight arithmetic over an authored DAG: agents per node, the low-high output-token band, the same DAG priced at the comparison mode, the ≤15-agent split check and the --budget refusal check. Returns the four-part table and the exact confirmation sentence. It does NOT ask the human and it cannot: the question belongs to the orchestrating session, and no agent may spawn before the answer.",
    annotations: Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['nodes'],
      properties: {
        mode: { type: 'string', enum: CANONICAL_MODES, default: 'all-out', description: 'The mode being priced.' },
        compareTo: { type: 'string', enum: CANONICAL_MODES, default: 'balanced', description: '§M6 prices the SAME DAG twice so the human sees the delta.' },
        planner: { type: 'string', enum: PLANNER_VALUES, default: 'opus', description: "Selects the 'planner on Fable' BAND row for the planner node." },
        budgetTokens: { type: 'integer', minimum: 1, description: "If set and the estimate's HIGH end exceeds it, the pre-flight refuses to start." },
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'taskType', 'nodeShape'],
            properties: {
              label: { type: 'string' },
              taskType: { type: 'string', enum: CANONICAL_KINDS },
              nodeShape: { type: 'string', enum: NODE_SHAPES, description: 'REQUIRED (ADR-0006 §D6.1.1), same rule as route_node.' },
              phase: { type: 'string' },
              fanOut: { oneOf: [{ type: 'integer', minimum: 1 }, { const: 'unknown' }], default: 1 },
              maxRounds: { type: 'integer', minimum: 1, description: "Required when fanOut is 'unknown'." },
              angles: { type: 'integer', minimum: 1, description: "Required when fanOut is 'unknown'." },
              size: { type: 'string', enum: SIZE_VALUES, default: 'standard' },
              askIsThorough: { type: 'boolean', default: false },
            },
          },
        },
      },
    },
    outputSchema: envelopeOutputSchema('estimate_phase', ESTIMATE_PHASE_RESULT_SCHEMA),
    handler: (args, opts) => estimatePhase(args, opts),
  },
  {
    name: 'boundary_lookup',
    title: 'Look up a skill boundary (boundary-audit.json)',
    description:
      "Answer 'which skill owns this, and what does it hand off to' from docs/design/boundary-audit.json — the 21-skill scope matrix, its rated overlaps with resolutions, and the approved description text — citing the RFC 6901 pointer and line range for every field. The audit outranks any plan or manifest (docs/design/README.md). Superseded per ADR-0007 §D7 relative to the original D3.6 wording: returns a ranked candidates[] shortlist under a speech-act rule (never a single scored 'owner' field), plus the required auditIntegrity summary of the audit file's own debt.",
    annotations: Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        skill: { type: 'string', description: 'A skill name as it appears in /matrix, e.g. loop-design.' },
        query: { type: 'string', description: 'Free text matched against scope, useInsteadWhen conditions, overlap risk and resolution.' },
        limit: { type: 'integer', minimum: 1, maximum: 21, default: 5 },
      },
      description: 'At least one of skill or query is required; the server reports a semantic invalid_argument (isError:true), not a schema violation, when both are absent — see boundary_lookup.mjs.',
    },
    outputSchema: envelopeOutputSchema('boundary_lookup', BOUNDARY_LOOKUP_RESULT_SCHEMA),
    handler: (args, opts) => boundaryLookup(args, opts),
  },
  {
    name: 'standards_shelf',
    title: "Query a skill's standards shelf",
    description:
      "Return what a skill's references/standards.md SAYS about a standard — body, edition, authority grade, role, and when the shelf last confirmed it — with the heading and line range cited. It never asserts that an edition is current: the shelves themselves warn they rot and must be re-checked on a cadence. Degrades to raw text with parsed:false for the shelves that carry no Markdown table (measured: loop-incident, loop-operate) rather than reporting them as having no standards.",
    annotations: Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        skill: { type: 'string', description: 'Omit to search all 21 shelves.' },
        query: { type: 'string', description: 'Case-insensitive match against standard name, body, and role text.' },
        grade: { type: 'string', enum: GRADE_VALUES, description: "The plugin's three authority grades." },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      description: 'At least one of skill or query is required; absence of both is a semantic invalid_argument (isError:true), not a schema violation — see standards_shelf.mjs.',
    },
    outputSchema: envelopeOutputSchema('standards_shelf', STANDARDS_SHELF_RESULT_SCHEMA),
    handler: (args, opts) => standardsShelf(args, opts),
  },
  {
    name: 'run_gate',
    title: 'Run a repo gate (validate.mjs, v1)',
    description: RUN_GATE_TOOL_DESCRIPTION, // exported by run_gate.mjs "for mcp/server.mjs's S7 tool
    // registration to use verbatim — the tool registry is static literals per ADR-0002 §D2.4/C6."
    annotations: RUN_GATE_ANNOTATIONS,
    inputSchema: { type: 'object', additionalProperties: false, description: `${RUN_GATE_SCOPE_NOTE} v1 takes no input properties: no gate selector, no verbose flag, no timeout override, no argument pass-through — any supplied property is refused at -32602.` },
    outputSchema: envelopeOutputSchema('run_gate', RUN_GATE_RESULT_SCHEMA),
    handler: (args, opts) => runGate(args, opts),
  },
])

// -------------------------------------------------------------------------------------------------
// JSON-RPC plumbing
// -------------------------------------------------------------------------------------------------

class RpcError extends Error {
  constructor(code, message, data) {
    super(message)
    this.code = code
    this.data = data
  }
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}

// Converts a tool handler's ADR-0003 §D3.1 envelope into the MCP tools/call result shape. Both
// structuredContent AND a content[0] text block are always returned (ADR-0003 §D3.1 —
// structuredContent is ignored by a 2024-11-05 client, so the text block is the compatibility
// floor). isError mirrors !envelope.ok exactly — a domain failure is a SUCCESSFUL JSON-RPC response
// carrying isError:true, never a JSON-RPC error object (ADR-0001 point 5, ADR-0003 §D3.5).
function toMcpToolResult(envelope) {
  return {
    content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    structuredContent: envelope,
    isError: envelope.ok !== true,
  }
}

function handleInitialize(params) {
  const requested = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : undefined
  // ADR-0001 point 2: echo the client's requested protocolVersion back verbatim when it is one of
  // the five frozen supported versions; otherwise advertise 2025-06-18.
  const protocolVersion = requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_ADVERTISE
  return {
    protocolVersion,
    capabilities: {
      tools: {}, // no listChanged — the registry is static for the process lifetime
      resources: RESOURCES_CAPABILITY, // {} — read-only, no subscribe/listChanged (ADR-0003 §D3.7)
    },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  }
}

function handleToolsList() {
  return {
    tools: TOOL_REGISTRY.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      // outputSchema is DELIBERATELY not transmitted here, even though it is built above and kept
      // on each TOOL_REGISTRY entry for documentation. Reason, found by exercising this server
      // during this task's own manual verification: ADR-0003 §D3.9's own gate requirement is
      // "Mode enum: tools/list advertises exactly ['lite','balanced','all-out'] for every mode
      // property and NOWHERE advertises 'optimize' or 'full' — assert by scanning the SERIALIZED
      // tools/list payload for those two strings." But §D3.3's own deprecationSchema (referenced
      // from every tool's outputSchema, since every result carries a deprecations[] array) declares
      // `supplied: { enum: ['optimize', 'full'] }` BY DESIGN — that is where the alias vocabulary is
      // documented for a caller reading the shape of a deprecation record. Sending outputSchema in
      // tools/list would put those two literal strings inside the very payload D3.9 scans and fail
      // its own assertion; keeping outputSchema off the wire (it is documentation, not something a
      // caller needs to construct a valid CALL with — only inputSchema is) resolves the conflict
      // without weakening either rule: the deprecationSchema still documents the alias shape for
      // envelopeOutputSchema()'s own internal use, and 'optimize'/'full' genuinely never reach the
      // wire in tools/list. Verified: node mcp/server.mjs with a tools/list request piped in and
      // grep -c optimize on the raw stdout line returns 0.
      annotations: t.annotations,
    })),
  }
}

async function handleToolsCall(params) {
  if (params === null || typeof params !== 'object' || Array.isArray(params) || typeof params.name !== 'string') {
    throw new RpcError(-32602, 'Invalid params: tools/call requires { name: string, arguments?: object }')
  }
  const entry = TOOL_REGISTRY.find((t) => t.name === params.name)
  if (!entry) {
    throw new RpcError(-32602, `Unknown tool: ${params.name}`)
  }
  const args = params.arguments === undefined || params.arguments === null ? {} : params.arguments
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new RpcError(-32602, `tools/call arguments for '${params.name}' must be an object`)
  }

  const raw = await entry.handler(args, { root: ROOT })

  // Every S1-S5 handler's validateInput() returns { protocolError: true, jsonRpcCode: -32602,
  // field, message } for a SHAPE violation and returns that object DIRECTLY as the handler's own
  // return value — "never the isError envelope" per each handler's own comment at this exact call
  // site. This is the D3.5 400/422 seam: shape violations are JSON-RPC errors, semantic failures
  // are the wrapped envelope.
  if (raw && raw.protocolError === true) {
    throw new RpcError(typeof raw.jsonRpcCode === 'number' ? raw.jsonRpcCode : -32602, raw.message, raw.field ? { field: raw.field } : undefined)
  }

  return toMcpToolResult(raw)
}

function handleResourcesList() {
  const idx = listResources(ROOT)
  if (!idx.ok) {
    // buildResourceIndex()'s own failure shape uses `error`, not `message` — mirrored here rather
    // than assuming a field name that is not always present (ADR-0005: never guess a shape).
    throw new RpcError(SUGGESTED_JSONRPC_ERROR_CODE, idx.error || idx.message || 'resources/list failed', { code: idx.code })
  }
  return { resources: idx.resources }
}

function handleResourcesRead(params) {
  if (params === null || typeof params !== 'object' || Array.isArray(params) || typeof params.uri !== 'string') {
    throw new RpcError(-32602, 'Invalid params: resources/read requires { uri: string }')
  }
  const r = readResource(ROOT, params.uri)
  if (!r.ok) {
    // D3.7 hardRules: "A missing file is an MCP resource error, NOT the isError tool envelope —
    // that envelope is a tools/call shape and does not exist on resources/read." resources.mjs
    // recommends -32002 (SUGGESTED_JSONRPC_ERROR_CODE) for this; it is a recommendation, not
    // something resources.mjs applies itself, so this file is what actually uses it.
    throw new RpcError(SUGGESTED_JSONRPC_ERROR_CODE, r.message || r.error || `could not read resource ${params.uri}`, { code: r.code })
  }
  return { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.text }] }
}

// Dispatches one already-parsed JSON-RPC message object. Returns the response object to write, or
// undefined for a notification (id absent or null — ADR-0001 point 3: "Notifications ... must never
// produce a response").
async function handleMessage(msg) {
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return jsonRpcError(null, -32600, 'Invalid Request')
  }
  const hasId = Object.prototype.hasOwnProperty.call(msg, 'id') && msg.id !== null
  const id = hasId ? msg.id : null
  const method = msg.method

  if (typeof method !== 'string') {
    return hasId ? jsonRpcError(id, -32600, 'Invalid Request: missing method') : undefined
  }

  if (method === 'notifications/initialized') {
    return undefined // swallowed unconditionally, per ADR-0001 point 3, even if a client mistakenly attaches an id
  }

  try {
    switch (method) {
      case 'initialize':
        return jsonRpcResult(id, handleInitialize(msg.params))
      case 'ping':
        return jsonRpcResult(id, {})
      case 'tools/list':
        return jsonRpcResult(id, handleToolsList())
      case 'tools/call':
        return jsonRpcResult(id, await handleToolsCall(msg.params))
      case 'resources/list':
        return jsonRpcResult(id, handleResourcesList())
      case 'resources/read':
        return jsonRpcResult(id, handleResourcesRead(msg.params))
      default:
        return hasId ? jsonRpcError(id, -32601, `Method not found: ${method}`) : undefined
    }
  } catch (e) {
    if (e instanceof RpcError) {
      return hasId ? jsonRpcError(id, e.code, e.message, e.data) : undefined
    }
    // An unexpected exception in a handler is OUR bug, not a caller error — logged to stderr
    // (never stdout) and reported as -32603 rather than crashing the whole stdio connection over
    // one bad request. Per api-design.md's own rule (ADR-0003 §D3.5 houseStyle), no stack is sent
    // to the caller.
    stderrLine(`internal error handling '${method}' — ${e && e.stack ? e.stack.split('\n')[0] : String(e)}`)
    return hasId ? jsonRpcError(id, -32603, 'Internal error') : undefined
  }
}

// -------------------------------------------------------------------------------------------------
// Framing (ADR-0001 point 1) — newline-delimited JSON, trailing \r tolerated, no Content-Length.
// STDOUT IS THE TRANSPORT: the only thing ever written to process.stdout in this file is one
// complete JSON-RPC message followed by '\n'. No child process's stdout is ever piped or inherited
// into this process's own stdout (run_gate.mjs's own spawn() call pipes the child explicitly and
// never sets stdio to 'inherit' — verified at mcp/lib/run_gate.mjs's spawn() call site).
// -------------------------------------------------------------------------------------------------

function writeMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

let inputBuffer = ''
let inFlightCount = 0
let stdinEnded = false

async function handleLine(line) {
  let parsed
  try {
    parsed = JSON.parse(line)
  } catch (e) {
    writeMessage(jsonRpcError(null, -32700, `Parse error: ${e.message}`))
    return
  }

  if (Array.isArray(parsed)) {
    // ADR-0001 point 3: "Accept a JSON-RPC batch array." Per JSON-RPC 2.0, the batch response is
    // itself a single JSON value (an array) — one line out for one line in, notifications omitted.
    if (parsed.length === 0) {
      writeMessage(jsonRpcError(null, -32600, 'Invalid Request: empty batch'))
      return
    }
    const responses = []
    for (const item of parsed) {
      const resp = await handleMessage(item)
      if (resp !== undefined) responses.push(resp)
    }
    if (responses.length > 0) writeMessage(responses)
    return
  }

  const resp = await handleMessage(parsed)
  if (resp !== undefined) writeMessage(resp)
}

function onStdinData(chunk) {
  inputBuffer += chunk
  let newlineIndex
  while ((newlineIndex = inputBuffer.indexOf('\n')) !== -1) {
    let line = inputBuffer.slice(0, newlineIndex)
    inputBuffer = inputBuffer.slice(newlineIndex + 1)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    if (line.trim() === '') continue
    // Not awaited here deliberately: handleLine is internally async (tools/call may spawn a child
    // process via run_gate), and awaiting it inside the synchronous 'data' handler would stall
    // reading further input while a slow tool call is in flight. Each line's own async work runs
    // independently; ordering of RESPONSES may interleave under concurrent calls, which is legal
    // JSON-RPC (every response carries its own correlating id). inFlightCount/maybeExitAfterEnd
    // below make sure a slow in-flight call (run_gate's spawn is the one that can take seconds)
    // is not silently dropped by an 'end' event that fires the instant the client's writable side
    // closes — a genuine defect this file had until it was caught by exercising run_gate through a
    // piped-EOF stdin during this task's own manual verification.
    inFlightCount++
    handleLine(line)
      .catch((e) => {
        stderrLine(`unhandled error processing a request line — ${e && e.stack ? e.stack.split('\n')[0] : String(e)}`)
      })
      .finally(() => {
        inFlightCount--
        maybeExitAfterStdinEnd()
      })
  }
}

// Clean shutdown (ADR-0002 §D2.4 C1: exit 0) waits for every already-dispatched request to finish
// before the process actually exits, so a slow in-flight tools/call (run_gate's child-process spawn
// can take up to GATE_TIMEOUT_MS) still gets its response written before stdout closes, rather than
// being silently dropped the instant the client's write side closes.
function maybeExitAfterStdinEnd() {
  if (stdinEnded && inFlightCount === 0) process.exit(0)
}

// -------------------------------------------------------------------------------------------------
// Lifecycle — clean shutdown when stdin closes (the client disconnected), and on the standard
// termination signals. Exit 0 in every clean-shutdown case, per ADR-0002 §D2.4 C1.
// -------------------------------------------------------------------------------------------------

function main() {
  bootSelfCheck()

  process.stdin.setEncoding('utf8')
  process.stdin.on('data', onStdinData)
  process.stdin.on('end', () => {
    stdinEnded = true
    maybeExitAfterStdinEnd()
  })
  process.stdin.on('error', (e) => {
    stderrLine(`stdin error, shutting down — ${e.message}`)
    process.exit(0)
  })
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
  // A malformed write to a closed stdout (client gone) should end the process quietly rather than
  // throw an uncaught EPIPE from inside process.stdout.write().
  process.stdout.on('error', (e) => {
    if (e && e.code === 'EPIPE') process.exit(0)
  })
}

main()
