# Security & configuration standards for the harness

The authoritative standards a harness is built *against*. A Claude Code harness is a security boundary and a piece of automation config — so it answers to the same established frameworks as any least-privilege system, hardened baseline, or CI/CD pipeline. This file names each standard, pins the edition to design against as of 2026, and maps it to a concrete step in this skill. The other references tell you *how* to write the config; this one tells you *what good looks like* and *whose rules you are following*.

Cite the edition, don't reinvent the principle. Where a standard cross-cuts a specific pillar, the mapping points at `permissions.md`, `hooks.md`, `mcp.md`, or `automation-loops.md`.

**Read the authority grade before you cite.** Every standards shelf in this plugin uses the same three grades, with the same meanings — see `../../loop-integrate/references/standards.md` for the shelf where all three are in play:

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it — or, as this plugin applies the grade consistently, a **published specification on a versioned track under formal governance**. Cite it as a normative reference: *"per NIST SP 800-207"*. On this shelf: **NIST SP 800-207 / 800-207A**, **NIST SP 800-57**, **CWE**, and **SLSA** — the same grade `../../loop-ship/references/standards.md`, `../../loop-review/references/standards.md`, and `../../loop-scout/references/standards.md` give SLSA, and the four must not diverge.
- **Authoritative — draft.** Real, citable working-group or committee output that **nothing has ratified**. Name it as a draft with its revision and status. *No entry on this shelf carries this grade* — but see the Twelve-Factor entry, whose official successor is being drafted in the open and is **not** yet citable.
- **Authoritative — no.** Community consensus, a foundation's guidance list, or a widely adopted manifesto. Influential, and not a specification — cite as attributed practice, never *"in violation of"*. On this shelf: **CIS Benchmarks and Controls** (a non-profit's consensus baselines), the **OWASP Secrets Management Cheat Sheet** and **OWASP CI/CD Top 10** (a foundation's community guidance), and **The Twelve-Factor App** (a manifesto).

**The line the plugin draws, stated once so it is not re-litigated per shelf:** a *versioned specification with a published governance and approval process* is **yes** (SLSA, OpenTelemetry, SPDX, in-toto); a *community awareness list, cheat sheet, or consensus baseline* is **no** (every OWASP list, every CIS document). Both can come from a foundation. The difference is whether there is a spec with a version number and a process behind it, not who publishes it.

The grade people get wrong here is **CIS**. A CIS Benchmark is the best-argued hardened baseline available for most platforms and it is still a consensus document — "does not meet CIS Benchmark §x" is a defensible gap statement, "violates CIS" is not.

## Least Privilege & Zero-Trust — the design principle behind allow/deny/ask

| | |
|---|---|
| **Standard** | Principle of Least Privilege (POLP); **NIST SP 800-207, *Zero Trust Architecture*** |
| **Issuing body** | NIST (National Institute of Standards and Technology), U.S. Dept. of Commerce |
| **Edition (2026)** | **SP 800-207 (August 2020)** — current, confirmed against NIST CSRC on 2026-07-26 with **no revision and no successor announced**. Complemented by **SP 800-207A (September 2023)**, which extends the model to access control in cloud-native applications; it is a companion, not a replacement. |
| **Authoritative** | **Yes** — published federal special publications. |

POLP and zero-trust are the *why* behind the whole permission model. **Never trust by default; grant the narrowest capability that lets the work proceed; verify at every boundary.** In this skill that is literal: the `deny` list is the never-trust floor, `allow` is an explicit, minimal grant (not `Bash(*)`), `ask` is per-action verification for anything irreversible, and `defaultMode` must never be `bypassPermissions`. See `permissions.md` — "keep the allow-list tight and specific" *is* least privilege. A PreToolUse guard hook (`hooks.md`) is the boundary re-verification zero-trust demands even for allowed tools.

## CIS Benchmarks & Controls — hardened configuration baselines

| | |
|---|---|
| **Standard** | **CIS Benchmarks** (per-platform config baselines) and **CIS Critical Security Controls** |
| **Issuing body** | Center for Internet Security (CIS) |
| **Edition (2026)** | **CIS Controls v8.1** (2024) is current — confirmed against `cisecurity.org` on 2026-07-26; **there is no v9**. v8.1 realigned the mappings to **NIST CSF 2.0** and added its *Govern* function; the 18 Controls decompose into 153 Safeguards across Implementation Groups IG1–IG3. Benchmarks are versioned *per technology* and revised continuously — always pull the latest benchmark for the specific OS/tool, **never a memorized version number**. |
| **Authoritative** | **No** — CIS is a non-profit publishing community-consensus baselines, not a ratifying standards body. Cite a Safeguard as a named baseline the config does or does not meet; do not phrase a gap as a violation of a standard. |

CIS gives the "secure default" posture the harness should encode. Map its ideas onto config, don't just cite them: no default-permissive settings, remove unused capability, log security-relevant actions. Concretely — `settings.json` ships `settings.local.json` gitignored (CIS Control 3, data protection), the `deny` floor blocks credential-file reads (Control 6, access management), a PostToolUse/Stop hook can log actions (Control 8, audit log). For MCP servers you enable, apply the vendor's CIS Benchmark to the *server's* host, not just the client config.

## The 12-Factor App — config in the environment

| | |
|---|---|
| **Standard** | **The Twelve-Factor App**, Factor III *Config* (and Factor X *Dev/prod parity*) |
| **Issuing body** | Originated by Adam Wiggins / Heroku (2011); the canonical community reference |
| **Edition (2026)** | The original twelve factors at `12factor.net` remain the citable reference; **there is still no published versioned revision.** Confirmed 2026-07-26: an **official successor manifesto is being drafted in the open** at `github.com/twelve-factor/twelve-factor` (work lands on a `next` branch and is intended to eventually replace the 12factor.net text). **It has not shipped — cite `12factor.net`, and cite the draft only as work in progress, never as an edition.** Third-party "beyond 12-factor" writings are commentary and are not that successor. |
| **Authoritative** | **No** — a manifesto by a vendor's co-founder, adopted by consensus. Enormously influential; nobody ratified it. |

Factor III — **strict separation of config from code, config lives in the environment** — is exactly what makes the harness portable and secret-safe. This is why `.mcp.json` uses `${VAR}` / `${VAR:-default}` expansion instead of literal URLs and tokens (`mcp.md`), and why `settings.json` carries an `env` block for non-secret config while machine-specific values go in gitignored `settings.local.json`. When you review a harness, a hardcoded token or endpoint in a committed file is a Factor III violation — flag it and move it to the environment.

## Secrets management — never in source, always in env/secret-store

| | |
|---|---|
| **Standard** | **OWASP Secrets Management Cheat Sheet**; **NIST SP 800-57** (key management); CWE-798 *Use of Hard-coded Credentials* |
| **Issuing body** | OWASP Foundation; NIST |
| **Edition (2026)** | OWASP cheat sheet — **current maintained edition, continuously updated with no dated version to pin; write "current edition" rather than invent a number.** **NIST SP 800-57 Part 1 Rev. 5 (May 2020)** is the current published edition — a **Rev. 6 initial public draft** circulated Dec 2025 with comment closed Feb 2026 and is **not** in force. CWE per the `loop-review` skill's `owasp-cwe.md`. Same pins as `../../loop-integrate/references/standards.md`, which cites both for the credential-lifecycle angle; the two files move together. |
| **Authoritative** | **Yes** for NIST SP 800-57 and CWE; **no** for the OWASP cheat sheet — a foundation's community guidance, which is the best remediation reference on this question and is still attributed advice. |

The rule the harness enforces mechanically: **secrets never appear in a committed file, in source, or in a prompt — they resolve at runtime from the environment or a secret store.** Two layers implement it here: (1) *prevention* — `${VAR}` expansion in `.mcp.json` and `env`, gitignored `settings.local.json` for real values (`mcp.md`); (2) *containment* — the `deny` list blocks `Read(.env)`, `Read(**/.env*)`, `Read(**/.ssh/**)`, `Read(**/.aws/**)`, `Read(**/secrets/**)`, backed by a PreToolUse `guard-secrets.sh` hook as belt-and-suspenders (`permissions.md`, `hooks.md`). A hard-coded credential is CWE-798 — cross-reference the `loop-review` skill when auditing a harness that touches real code.

## OWASP CI/CD Security Top 10 — risks for the automation layer

| | |
|---|---|
| **Standard** | **OWASP Top 10 CI/CD Security Risks** |
| **Issuing body** | OWASP Foundation |
| **Edition (2026)** | **2022 edition** (CICD-SEC-1 … CICD-SEC-10) — first published Oct 2022 and confirmed on 2026-07-26 as **still the current published list**; no refresh has shipped. |
| **Authoritative** | **No** — an OWASP community awareness list, the same grade `../../loop-review/references/standards.md` gives every OWASP list. Tag from it freely; never phrase a finding as *"in violation of OWASP."* |

The moment a harness runs *unattended* — Routines, headless `claude -p`, GitHub Actions (`automation-loops.md`) — it is a CI/CD pipeline and inherits these risks. Map the ones the harness controls:

| Risk | Harness control |
|---|---|
| **CICD-SEC-1** Insufficient Flow Control | Routines default to pushing only `claude/`-prefixed branches; never auto-merge |
| **CICD-SEC-2** Inadequate IAM | least-privilege `allow`; scoped tokens for MCP/Actions |
| **CICD-SEC-4** Poisoned Pipeline Execution | `--bare` headless runs (skip hooks/MCP/CLAUDE.md) for untrusted-input CI |
| **CICD-SEC-6** Insufficient Credential Hygiene | env-only secrets, gitignored local settings (see secrets section) |
| **CICD-SEC-7** Insecure System Configuration | CIS-hardened baseline; no `bypassPermissions` |
| **CICD-SEC-10** Insufficient Logging | Stop/PostToolUse logging hooks; audit unattended runs |

## SLSA — provenance for what the automation produces

| | |
|---|---|
| **Standard** | **SLSA — Supply-chain Levels for Software Artifacts** |
| **Issuing body** | OpenSSF (Open Source Security Foundation) / Linux Foundation |
| **Edition (2026)** | **SLSA v1.2** (approved **24 Nov 2025**; Source track promoted to approved; backwards-compatible with v1.1), Build track levels **L0–L3**. (The pre-1.0 four-level scheme is superseded — do not cite "SLSA 4".) |
| **Authoritative** | **Yes** — a versioned specification on a published track with a formal approval process, graded identically on all four shelves that carry it. Cite the level as a requirement you set; attribute OpenSSF as the body. |

**Four shelves in this plugin carry this pin and they move in lockstep** — this file, `../../loop-ship/references/standards.md`, `../../loop-review/references/standards.md`, and `../../loop-scout/references/standards.md`. A future SLSA bump is a four-file commit or it is a drift defect: three skills quoting three levels for the same artifact is worse than all four quoting a dated one.

When the harness *builds or releases* artifacts through automation, SLSA governs how you prove where they came from. Aim for **Build L2+** on anything automation ships: a hosted, trusted build (a Routine or GitHub Action, not a developer laptop) that emits signed **provenance** attesting the source and build steps. In this skill that shapes `automation-loops.md` choices — prefer a durable, isolated runner over an ad-hoc local `/loop` for release-producing work, and have the pipeline generate provenance rather than trusting an unattested artifact.

## Edition discipline

Standards get revised; a harness cited against a stale edition drifts from what auditors and tools expect. Rules:

- **Pin the edition you designed against** (done per-section above) and record it in the harness's own notes when you ship one.
- **Re-check on a cadence** — roughly annually, or when a section's issuing body publishes a new edition. Watch especially: OWASP CI/CD Top 10 (a refresh would re-key the mapping table), CIS Benchmarks (revised per-platform, continuously), and SLSA (**v1.2** is the current pin; the Source track was approved in that revision and the track expansion is still active).
- **Never mix editions inside one harness or one review.** If you update to a newer edition, re-map every affected section, the same discipline `owasp-cwe.md` applies to the OWASP Top 10 2021→2025 transition.
- **Carry the authority grade with the citation.** Four of the six entries here are graded *no*. A harness gap is defended by the capability it leaves open, not by the acronym attached to it.
- **Name-don't-fabricate.** If unsure of an exact version, cite the standard and "current edition" rather than inventing a number — and if you could not confirm it, write "unconfirmed as of \<date\>" rather than asserting one. An honest non-confirmation is a usable citation; a fabricated version poisons the whole shelf.
- **Confirmation log — 2026-07-26.** Verified against the primary source: **CIS Controls v8.1** as current with **no v9** (`cisecurity.org`), **NIST SP 800-207 (Aug 2020)** with no revision or successor and **SP 800-207A (Sep 2023)** as its companion, the **OWASP CI/CD Top 10 2022 edition** as still the current published list, **SLSA v1.2** (approved 24 Nov 2025, Source track approved), **NIST SP 800-57 Part 1 Rev. 5** as the edition in force with Rev. 6 still an initial public draft, and the **Twelve-Factor App's successor manifesto as a live but unpublished draft** on `github.com/twelve-factor/twelve-factor` (this pass corrected an entry that implied no successor work existed at all). **Not independently re-confirmed and therefore named without new precision:** the CIS Benchmarks are per-technology and continuously revised — pull the current one for the platform in front of you and do not cache a number here; the OWASP Secrets Management Cheat Sheet is continuously updated with no version to pin; and CWE ids are owned by `../../loop-review/references/owasp-cwe.md`, which carries the release cadence.
