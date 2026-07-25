# Authoritative standards — the shelf a release gate cites

## Why this shelf is gate-time

Several standards below are also cited by three sibling skills, and the difference between those citations is the *question being asked*, not the standard. `loop-scout` cites provenance at **adoption time** — should we take a dependency on this at all, before any code exists — as one axis of a build-vs-buy score. `loop-review` cites it at **audit time** — is this dependency healthy across a diff or a repo — and produces a finding with a severity and a remediation. `loop-harness` cites it for the **automation's own outputs** — does the loop that ships things prove where its artifacts came from. This shelf is **gate time**: one artifact, one moment, one pass-or-fail answer immediately before promotion. Every entry below is therefore mapped to a *check* rather than to a concept, and where a sibling already owns the deeper explanation, this file points at it rather than re-deriving it.

Cite from this file, not from memory. When you are unsure of an exact edition, name the standard and write "current edition" rather than invent a number. Pins below are current as of **2026-07**; see the closing edition-discipline note for the re-check cadence and for what this release reconciled.

## Delivery-performance measurement — DORA

| Field | Value |
|---|---|
| **Standard** | DORA — *Accelerate State of DevOps Report*, the Four Keys |
| **Issuing body** | The DORA research program (Google Cloud) |
| **Edition (2026)** | **2025 annual edition.** The core four keys — deployment frequency, lead time for changes, change failure rate, failed deployment recovery time — are stable. The 2025 report **pilots a fifth metric, Rework Rate**, plus a **Reliability quasi-metric** that is reported without being treated as a peer of the four. The recovery metric was **renamed from MTTR in the 2024 report**. |
| **Authoritative?** | **No.** This is an annual research publication with an industry survey behind it, not a ratified standard from a standards body. It is the best available empirical frame for delivery performance and it is cited widely enough to function as a shared vocabulary — but it has no normative force, its tiers move between editions, and a report is not a specification. Cite it as evidence, never as a requirement. |

**Maps to `dora.md`'s per-release instrumentation.** This skill tags each shipped change with the fields that let the four keys be *derived* from a stack of release records. Two disciplines are load-bearing and are stated in `dora.md` as well as here, because the failure they prevent is common:

- **Re-check the report year before quoting any tier number.** Elite/high/medium/low boundaries shift release to release and the number of clusters has itself changed across editions. "Elite is under one hour" is only true with a year attached. Prefer your own trend line to any published band.
- **Do not re-derive `loop-audit`'s framing.** `../../loop-audit/references/standards.md` already claims change failure rate as part of that skill's reason to exist, reasoning about risk in a diff. This shelf instruments what actually happened per release; the two are complements, and duplicating the framing would put two definitions of the same metric in one plugin.

## The ship-time supply-chain gate cluster

Five standards, each mapped to **one concrete check** in `supply-chain-gate.md`. Nothing here is a general explainer — the ladders, the format comparisons, and the dependency-health reasoning belong to `../../loop-review/references/standards.md` and `../../loop-scout/references/standards.md`.

| Standard | Issuing body | Edition (2026) | Authoritative? | The one check it governs |
|---|---|---|---|---|
| **SLSA** — Supply-chain Levels for Software Artifacts | OpenSSF / Linux Foundation | **v1.2** (approved **Nov 2025**); the Build track's **L0–L3** ladder is unchanged from v1.0, and the **Source track is now approved** rather than draft | **Yes** — a specification with a versioned, published track | Check 1: does the artifact carry a provenance attestation whose declared build level meets the floor (**L2** for anything a pipeline ships, **L3** where the blast radius would justify a canary)? |
| **CycloneDX** | OWASP / Ecma International | **v1.7** (**ECMA-424, 2nd edition**, Oct 2025) | **Yes** — an Ecma International standard | Check 2: does an SBOM exist for *this digest*, and what does its diff against the previous release introduce? |
| **SPDX** | Linux Foundation / ISO | **3.0.1** (Dec 2024). **UNCONFIRMED:** ISO/IEC **5962:2021** formally covers SPDX **2.2.1** only; an ISO submission for 3.x is understood to be pending and this shelf could **not** confirm ISO adoption of 3.0 or 3.0.1. Do not describe SPDX 3.x as ISO-adopted. | **Yes** for the specification itself; the *ISO status of 3.x* is unconfirmed and is flagged rather than asserted | Same check as CycloneDX — the alternative format for it. **Match whichever your pipeline already emits**; do not introduce a second format at gate time. |
| **in-toto Attestation Framework** | in-toto / CNCF | **v1.2.0** (Jan 2026) | **Yes** — a versioned specification under CNCF governance | Check 1's envelope: does the attestation's `subject` digest match the artifact being promoted, byte for byte? This is the concrete format SLSA provenance is carried in. |
| **Sigstore** — cosign / Fulcio / Rekor | OpenSSF / Linux Foundation | **GA, continuously released.** There is no single meaningful version number across the three components — **cite it as "current"** and pin the client version your pipeline actually runs. Do not invent a Sigstore release number. | **Yes** — a production implementation with a public transparency log, though an implementation rather than a specification | Check 3: does the signature verify against the expected identity *and* is there a transparency-log inclusion proof where policy requires one? |

**The floor is a policy decision, not a standard.** SLSA defines the ladder; which rung your gate demands is yours to set and to write into `release-gates.md` §1 dimension 5. A gate that verifies provenance exists without checking it against a declared floor is checking that a file is present.

## Process framing — NIST SSDF

| Field | Value |
|---|---|
| **Standard** | NIST Secure Software Development Framework, **SP 800-218** |
| **Issuing body** | NIST |
| **Edition (2026)** | **v1.1** (Feb 2022). **SP 800-218A** (generative-AI / dual-use foundation models) **remains draft as of last check — verify final status before citing.** This is the same caveat `../../loop-review/references/standards.md` already carries; it is cross-referenced here rather than re-derived. |
| **Authoritative?** | **Yes** — a published NIST framework. Note that it is a *process* framework, not a technical specification: it tells you which practices to have, not how to implement one. |

**Maps to the gate as evidence, not as a check.** You do not run an SSDF check on an artifact. You cite the practice groups when someone asks what the release pipeline *is* in compliance terms: **PS** (Protect Software) covers the provenance and signing checks above, **PW** (Produce Well-Secured Software) covers the CI stage of `release-gates.md` §3, and **RV** (Respond to Vulnerabilities) covers the SBOM-diff and advisory-exception flow. A release process that produces the records in §5 sign-off is producing SSDF evidence as a by-product, which is the cheapest form of audit readiness available.

## Opinionated practice — named, and not mistaken for standards

Both entries below are **`authoritative: false`**. They are influential, they are the source of vocabulary this skill uses daily, and they are *books and websites*, not ratified standards. Cite them for the idea, never as a requirement, and never in the same register as SLSA or Ecma-424.

- **Continuous Delivery**, Jez Humble & David Farley — **1st edition, 2010** (Addison-Wesley). This shelf **could not confirm that a 2nd edition exists**; cite the 1st edition or cite it without an edition, and do not manufacture a later one. It is the source of the **deploy-vs-release distinction** and of **build-once-promote-many**, both of which this skill operationalizes in `rollout-strategies.md` and `release-gates.md` §3. The book predates containers, managed Kubernetes, and modern flag platforms — take the principles and ignore the tooling chapters.
- **Trunk-Based Development** (trunkbaseddevelopment.com, Paul Hammant) — a **continuously maintained reference site with no formal edition**; there is no version to pin, so cite it as current and quote it sparingly. It is the branching discipline that feature-flag release management assumes. `../../loop-design/references/deployment.md` and `release-gates.md` §3 both name it; this skill reaches for it only when a release-gate finding traces back to a long-lived branch.

## Cross-reference map

Four other shelves in this plugin cite standards that also appear here. Each owns a different question; **none of them re-derives another's ladder**, and neither does this one.

| File | Owns | Do not duplicate |
|---|---|---|
| `../../loop-design/references/deployment.md` | The **design-time** delivery decision — does this system need flags and backward-compatible schema evolution designed in — recorded as an ADR. It is a short stub; the mechanics moved into this skill in v1.0.0. | The rollout mechanics, the Risk → strategy table, and the flag taxonomy now live in `rollout-strategies.md`. |
| `../../loop-review/references/standards.md` | **Audit-time dependency health** — SLSA and SBOM read as a finding about whether a component is safe to use, diff- or repo-scoped, with a severity. Also the SP 800-218A draft caveat and the full CVSS vector grammar. | The SLSA build-level ladder explanation and the severity model. This shelf maps SLSA to a pass/fail floor and stops. |
| `../../loop-scout/references/standards.md` | **Adoption-time provenance** — SLSA as one axis of a build-vs-buy evaluation, alongside SPDX license identity, SemVer, and OpenSSF Scorecard. | License compatibility and project-health scoring. Neither is a gate question. |
| `../../loop-harness/references/standards.md` | The **automation's own** build provenance — proving where artifacts produced by an unattended loop came from, plus OWASP CI/CD Top 10 and CIS Benchmarks. | The CI/CD threat taxonomy. This shelf checks one artifact; that one hardens the machine that built it. |

## Edition discipline

- **Cite the edition you checked against, in the release record** — "SLSA v1.2 Build L2", "CycloneDX 1.7 (ECMA-424 2nd ed.)", "in-toto attestation v1.2.0" — never a bare "SLSA" or "SBOM."
- **Do not mix editions across one gate.** If the provenance check is keyed to SLSA v1.2, the attestation format, the SBOM format, and the sibling shelves' pins all move with it.
- **RECORDED — the v1.0.0 SLSA reconciliation.** This release moved SLSA from **v1.0 (2023) to v1.2 (approved Nov 2025)** in a single pass across **four** files: this shelf, `../../loop-review/references/standards.md`, `../../loop-scout/references/standards.md`, and `../../loop-harness/references/standards.md`. Before that pass the plugin carried three files pinned to v1.0 and would have gained a fourth pinned differently — a drift that reads to a user as three skills disagreeing about a standard. **Future SLSA bumps move all four in lockstep, in one commit, or the drift returns.** The same release moved CycloneDX from **v1.6 to v1.7** in `loop-review`'s shelf and this one; SPDX was deliberately **not** advanced past its existing pin in the sibling shelves, because its ISO status is unconfirmed (above) and half-upgrading is worse than not upgrading.
- **EXPLICITLY NOT CITED.** A claim surfaced during research about a "unified CycloneDX/SPDX format coming in 2026" could **not** be confirmed against either project's published output and is **not cited anywhere in this plugin**. It is recorded here so that a later pass working from a stale search cache recognizes it as already-evaluated-and-rejected rather than as a new finding. If it becomes real, it arrives with a published specification and a version number; until then it does not exist for citation purposes.
- **Re-check this shelf on a cadence** — at minimum before a release into a regulated environment, and otherwise roughly twice a year. Watch specifically: the next annual DORA report (which may promote or drop Rework Rate), **SP 800-218A** moving from draft to final, SPDX 3.x's ISO submission resolving, and SLSA's track expansion beyond Build and Source. When an edition here goes stale, update the row *and* this note together.
