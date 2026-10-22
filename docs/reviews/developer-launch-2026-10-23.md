# Proof developer launch review

Reviewed 23 October 2026. Source baseline: freshly fetched `origin/develop`
`1000b9aabcab4b27386aa71b3b917e1ab4e7894e`, separate from released `main`
`5cab8ff8196914804be6809d3c90e6c0ac79cbad`. Work is isolated in
`feat/proof-onboarding-review`; canonical checkout and existing installations
remain unchanged. The user explicitly chose Proof-only names with no aliases.

## Product fit

The implementation is an engineering-skill framework: 26 source skills, shared
boundaries/policies, Workflow templates, source-reading MCP tools and generated
reduced host packs. Its first-use story foregrounded orchestration and legacy
names. That obscured the owner's simpler purpose: help people develop useful
software with a repeatable, reviewable method.

The revised starting point is a goal, constraints and observable success. A
guide chooses a bounded next skill; developer review and ordinary idea-intake
examples show different results. This is a documentation/design change, not a
user-comprehension study or proof that every person/task is supported.

## Findings and disposition

| Finding | Impact | Candidate change |
| --- | --- | --- |
| Proof product, old skill namespace | Inconsistent discovery and identity | Canonical `proof-*` names in active skill/API sources; no aliases; explicit migration |
| Plugin and project invocation presented alike | Wrong command after installation | Distinguish `/proof:proof-guide`, project `/proof-guide` and Codex `$proof-guide` |
| Published main differs from integration | GitHub install does not install this candidate | Candidate source-load path and version-specific warning |
| Codex pack destination was stale | Current discovery expects another directory | `.agents/skills`, with source/check scope recorded |
| Packs retained a Claude-only frontmatter key | Plain skill/API upload can reject metadata | Omit `argument-hint` from packs; keep it for canonical Claude source validation |
| Generated README equated target with working host | Packaging mistaken for installed acceptance | Qualify target versus discovery/tools/execution evidence |
| Roadmap contained old counts and host dates | Support expectations can exceed evidence | Current direction/status with historical design pointers |
| Renamed routing labels invalidate old artifacts | Silent reinterpretation would hide the break | Preserve inputs/results; derive a v4 training fixture; retain frozen evaluation guards |

Model routing and security methods are not replaced just to look newer. The
review source already pins OWASP Top 10:2025 and ASVS 5.0; a newer model catalog
alone does not demonstrate better Proof behavior or account access.

## Current technology source checks

- [Claude Code skills](https://code.claude.com/docs/en/skills): plugin namespacing,
  command identity, portable versus Claude-only frontmatter.
- [Dynamic workflows](https://code.claude.com/docs/en/workflows): a documented
  host capability following host permissions. No paid workflow was run here.
- [OpenAI Build skills](https://learn.chatgpt.com/docs/build-skills): current
  `.agents/skills` paths, `$` invocation and discovery boundaries.
- [Agent Skills format](https://agentskills.io/specification): directory/name
  agreement, common frontmatter and packaged resources.
- [Claude model catalog](https://platform.claude.com/docs/en/models/overview):
  newer families are published. Routing pins remain unchanged; availability and
  a model migration were not tested.
- [MCP versioning](https://modelcontextprotocol.io/specification/versioning): the
  current protocol is newer than this project's supported handshake set. A new
  advertised version needs its required discovery/version behavior and tests;
  the local smoke check exercises the existing supported protocol.
- [OWASP 2025](https://owasp.org/Top10/2025/): the named review taxonomy is a real
  published awareness document, not application certification.

This is selective review, not certification of every citation, skill, model or host.

Current OpenAI documentation also bounds the initial skill-metadata context and
can shorten descriptions when many skills are installed. The explicit first-skill
path avoids assuming that every long description is always visible. Natural
host discovery/selection still needs a real-session check; the earlier synthetic
study does not justify a wholesale description rewrite in this naming pass.

## Agensi evidence and launch gate

The user authorized reading the email. **Agensi x Proof**, dated 17 October 2026
Asia/Bangkok, invites repackaging individual skills. It is outreach, not approval
or an installed-host test. Private email content/headers are not stored here.

No standalone archive/listing was supplied to this local review, and no accepted
listing was observed. Before a launch claim, prepare the selected standalone
distribution, verify its dependencies/metadata, perform an installed-host example
and record the actual submission/listing result. The owner chooses price/terms
and publication; the invitation alone does not settle those decisions.

## Verification and remaining limits

Baseline structural, generated-pack and strict manifest checks passed. The
initial rename exposed a reference filename that also needed moving; it was
fixed rather than suppressing the validator. A derived training fixture keeps
existing statistical records intact.

During candidate preparation, the beta version bump initially left tool-handler
envelopes on the previous version. A new identity/schema consistency check
reproduced that introduced mismatch; all five handlers were corrected. The
negative and corrected logs are retained. This was an unshipped candidate
regression, not an existing defect attributed to the released v3 baseline.

`scripts/test-public-names.mjs` copies source to a disposable directory, starts
the real stdio server from another working directory, checks canonical names
and resource content, rejects old names/root settings, and tests missing-source
errors and a generated Codex copy. It makes no provider calls. This is a local
protocol/package smoke test, not the separate SDK golden-query gate or native
host-model acceptance.

Full checks and preservation results are in
`developer-launch-checks-2026-10-23.json`. Raw logs remain under ignored
`dist/launch-review-20261023/`. No native hosted-agent outcome, marketplace
approval, measured quality gain or token saving is claimed.
