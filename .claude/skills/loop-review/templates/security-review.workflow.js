// Template: SECURITY REVIEW — finder-per-category → dedup barrier → adversarial verify.
// A specialization of the workflow skill's parallel fan-out pattern with the OWASP/CWE
// categories, severity model, and false-positive suppression pre-wired.
// The barrier is earned per harness policy H2: the same weakness surfaces from several
// category lenses, so dedup needs ALL finder output at once (and lets us early-exit on zero).
//
// Model/effort come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { target: "...", scope: "...", mode: "optimize", gating: false } })
// input.target — what to review (a diff, a PR, a path, a repo). Used in every finder prompt.
// input.scope  — one-line scope note (e.g. "only changed lines in git diff main...HEAD").
// input.mode   — 'optimize' (default) or 'full' (execution-modes.md §M2). Full mode runs the
//                adversarial verify at WIDTH('verify') diverse lenses instead of one skeptic.
// input.gating — true when this review blocks a release. Widens the verify fan-out to 5 lenses
//                under full mode (§M5). It widens only — the skeptics stay on the `verify` route.

export const meta = {
  name: 'security-review', // EDIT ME
  description: 'Fan out one finder per vuln category, dedup across all lenses, then adversarially verify each survivor', // EDIT ME
  phases: [
    { title: 'Find', detail: 'one finder per OWASP / vuln category' },
    { title: 'Verify', detail: 'one skeptic per deduped finding, prompted to refute it' },
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
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : 1)
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// No DRY_LIMIT: this template has no loop-until-dry stage (§M8 — omit what you do not use).
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: one finder per category from SKILL §4. Diversity beats redundancy (harness policy
// H4): each finder hunts a DIFFERENT weakness class, not the same code from N identical angles.
// Trim categories that cannot apply to this target (e.g. no crypto in a static-site diff) and
// log the trim below rather than running empty finders.
const FINDERS = [
  { key: 'injection', prompt: 'Injection: SQL, NoSQL, OS command, LDAP, and template injection. Trace each tainted source (request, file, env, third party) to its dangerous sink (query, exec, deserializer, template). Tag CWE-89/78/77/79/94/20; OWASP A03.' },
  { key: 'access-control', prompt: 'Broken access control / authorization: IDOR, missing or incorrect authorization checks, privilege escalation, path traversal, CSRF. Tag CWE-862/863/639/22/352; OWASP A01.' },
  { key: 'auth-session', prompt: 'Authentication & session management: missing auth on critical functions, weak session handling, fixation, broken password reset. Tag CWE-287/306/384/620/640; OWASP A07.' },
  { key: 'crypto', prompt: 'Cryptographic failures: broken/weak algorithms, bad or predictable randomness, misused primitives, hard-coded crypto keys, weak password hashing. Tag CWE-327/326/331/321/916; OWASP A02.' },
  { key: 'ssrf', prompt: 'Server-side request forgery: user-controlled outbound destinations reaching an internal network or metadata endpoint without an allow-list. Tag CWE-918; OWASP A10.' },
  { key: 'deserialization', prompt: 'Insecure deserialization / data-integrity failures: untrusted data fed to a deserializer, unsigned updates, unverified data authenticity. Tag CWE-502/345/494; OWASP A08.' },
  { key: 'secrets', prompt: 'Hard-coded secrets & credential leakage: API keys, passwords, tokens, private keys committed in source or config; credentials in logs. Tag CWE-798/321/522; OWASP A07/A02.' },
  { key: 'validation-encoding', prompt: 'Input validation & output encoding: reflected/stored XSS, path traversal, open redirect, unrestricted file upload. Confirm a context-correct encoding or allow-list is missing at the sink. Tag CWE-79/22/601/434; OWASP A03/A01.' },
  { key: 'misconfiguration', prompt: 'Security misconfiguration: missing/loose security headers, permissive CORS, debug flags in prod, insecure defaults, XXE, directory listing. Tag CWE-16/611/732/1004; OWASP A05.' },
  { key: 'components', prompt: 'Vulnerable & outdated components (SCA): dependencies with known CVEs, unmaintained packages, pinned-vulnerable versions in manifests/lockfiles. Tag CWE-1104/937; OWASP A06.' },
  { key: 'logging', prompt: 'Security logging & monitoring failures: absent logging of security events, sensitive data written to logs, log injection, fail-open error handling. Tag CWE-778/117/532; OWASP A09.' },
  // EDIT ME: add project-specific lenses (e.g. framework-specific auth, tenant isolation, a
  // house crypto wrapper) or drop rows that cannot apply to this target.
]

// Finders return raw candidate findings — their final text is a return value, not prose (H3).
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' }, // short weakness name
          detail: { type: 'string' }, // the source→sink trace that makes it exploitable
          location: { type: 'string' }, // file:line or file:symbol
          category: { type: 'string' }, // OWASP Top 10 id, e.g. "A03:2021"
          cwe: { type: 'string' }, // single most-specific CWE id, e.g. "CWE-89"
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          confidence: { type: 'number' }, // finder's prior; the verify stage sets the real gate
        },
        required: ['title', 'detail', 'location', 'category', 'cwe', 'severity', 'confidence'],
      },
    },
  },
  required: ['findings'],
}

// Adversarial verdict: re-derive exploitability from scratch and default to refuted (H4).
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' }, // true only if a concrete source→sink exploit path was re-derived
    confidence: { type: 'number' }, // 0..1 — how sure the skeptic is in isReal
    reason: { type: 'string' }, // what path was proven, or why it was refuted
  },
  required: ['isReal', 'confidence', 'reason'],
}

// The false-positive bar (SKILL §5). EDIT ME if the user set a different threshold.
const MIN_CONFIDENCE = 0.8

// EDIT ME: the declared refutation lenses. Each attacks a candidate finding a DIFFERENT way (H4);
// five are declared so a gating review can reach width 5 without inventing a lens at run time.
// Mode picks how MANY run, never WHICH exist — adding a sixth is a decomposition change (§M5).
const VERIFY_LENSES = [
  { key: 'source-to-sink', prompt: 'Re-derive the taint path yourself, hop by hop, from the untrusted source to the dangerous sink. Refute if any hop does not actually carry attacker-controlled data into the next.' },
  { key: 'existing-mitigation', prompt: 'Hunt for a mitigation the finder missed: a parameterized query, a context-correct encoder, framework auto-escaping, an allow-list, a validating middleware, or a guard earlier in the call chain. One effective mitigation on the path refutes the finding.' },
  { key: 'reachability', prompt: 'Attack reachability rather than the flaw: is this code registered, routed, exported, and callable by an untrusted principal at all? Dead code, a test fixture, an unregistered handler, or a path gated behind an admin-only boundary refutes it.' },
  { key: 'trust-boundary', prompt: 'Attack the SOURCE: is it genuinely attacker-controlled, or is it configuration read at boot, an internal-only caller, or data already inside the tenant boundary? A source the attacker cannot influence refutes the finding.' },
  { key: 'classification', prompt: 'Attack the classification: does the reported CWE and severity match what the code actually permits, and is this the same weakness another candidate already reports at the same location? A misclassified or duplicate finding is not a finding at this bar.' },
]

// Gating reviews block a release, so their verify fan-out widens to 5 under full mode (§M5).
// This changes WIDTH only — the skeptics stay on the `verify` route, per §M3.
const VERIFY_WIDTH = WIDTH(input && input.gating ? 'gating' : 'verify')

// BARRIER (harness policy H2): wait for every finder, because the same weakness surfaces from
// multiple category lenses and dedup needs the full result set. This is also what lets us
// early-exit when nothing was found instead of spinning up an empty verify stage.
const sweeps = await parallel(
  FINDERS.map((f) => () =>
    agent(
      `Security review target: ${input.target}\nScope: ${input.scope || 'as given by the target'}\n\n` +
        `${f.prompt}\n\n` +
        `Report ONLY findings with a concrete, reachable source→sink path — a pattern match with no ` +
        `exploit path is not a finding. Return raw data conforming to the schema.`,
      optsFor({ taskType: 'analyze', phase: 'Find', schema: FINDINGS_SCHEMA }, `find:${f.key}`),
    ),
  ),
)

// .filter(Boolean): a skipped or dead finder resolves to null (harness policy H5).
const all = sweeps.filter(Boolean).flatMap((s) => s.findings)

// Dedup in plain JS — never spend an agent on it (loop policy L3). Key on location+title so the
// same weakness reported by two lenses collapses to one candidate before the expensive verify.
const key = (f) => `${f.location}::${f.title}`
const deduped = [...new Map(all.map((f) => [key(f), f])).values()]
log(`${all.length} raw candidates from ${FINDERS.length} finders → ${deduped.length} after dedup [mode=${MODE}]`) // no silent caps (H6)

// Early-exit: the other legitimate use of the barrier (H2). Nothing to verify.
if (deduped.length === 0) {
  return { confirmed: [], note: 'no candidate findings from any category' }
}

// Adversarial verify (harness policy H4): independent skeptics per candidate, prompted to
// REFUTE it and default to isReal=false when the exploit path is unproven. Width is mode-resolved
// (§M5): one skeptic in optimize, three diverse lenses in full, five when the review is gating —
// and a candidate now dies on a MAJORITY refute at ⌈N/2⌉ rather than on a single verdict.
const lenses = VERIFY_LENSES.slice(0, VERIFY_WIDTH)
log(`verify: ${deduped.length} candidates × ${lenses.length} lens(es) = ${deduped.length * lenses.length} skeptic(s)`)
const verified = await parallel(
  deduped.map((f) => async () => {
    // Sequential INSIDE the thunk: candidates already run in parallel, so this bounds concurrency
    // (H6) without adding a barrier — no cross-candidate dependency exists, so H2 is not engaged.
    const verdicts = []
    for (const lens of lenses) {
      const v = await agent(
        `You are a skeptical reviewer trying to REFUTE a reported vulnerability. Re-derive its ` +
          `exploitability from the source yourself — do not trust the finder.\n\n` +
          `Finding: ${f.title} [${f.category} / ${f.cwe}, severity=${f.severity}]\n` +
          `Location: ${f.location}\n` +
          `Claimed path: ${f.detail}\n\n` +
          `${lens.prompt}\n\n` +
          `Set isReal=true ONLY if you can re-derive a concrete, reachable source→sink exploit path. ` +
          `If the input is already sanitized, the sink is safe, the code is unreachable, or you are ` +
          `unsure — set isReal=false. Report your confidence in isReal as 0..1.`,
        optsFor({ taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA }, `verify:${lens.key}:${f.title}`),
      )
      if (v) verdicts.push({ ...v, lens: lens.key })
      else log(`verify lens ${lens.key} died on ${f.title} @ ${f.location} — counted as an abstention, never as a confirmation (H5)`)
    }
    return { ...f, verdicts }
  }),
)

// Keep only findings the skeptics confirmed with high confidence — the §5 bar. Majority refute
// kills at ⌈N/2⌉ refutes, never a literal 2, which is silently wrong the moment width becomes 5
// (§M5). Confidence is the MINIMUM across the lenses that voted: one shaky confirmation must not
// hide behind two confident ones when the bar is a false-positive bar.
const survivors = verified.filter(Boolean)
const stands = (f) => {
  if (!f.verdicts || f.verdicts.length === 0) return false
  const threshold = Math.ceil(f.verdicts.length / 2)
  const refutes = f.verdicts.filter((v) => !v.isReal).length
  const confidence = Math.min(...f.verdicts.map((v) => (typeof v.confidence === 'number' ? v.confidence : 0)))
  return refutes < threshold && confidence >= MIN_CONFIDENCE
}
const confirmed = survivors.filter(stands)

// Log everything dropped, never truncate silently (harness policy H6).
const dropped = survivors.filter((f) => !stands(f))
log(`${confirmed.length}/${deduped.length} findings confirmed at confidence ≥ ${MIN_CONFIDENCE} across ${lenses.length} lens(es)`)
for (const f of dropped) {
  const votes = (f.verdicts || []).map((v) => `${v.lens}: isReal=${v.isReal} conf=${v.confidence} — ${v.reason}`).join(' | ') || 'no verdict returned'
  log(`dropped ${f.title} @ ${f.location} — ${votes}`)
}

return { confirmed }
