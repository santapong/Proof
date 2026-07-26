# Authoritative Standards for Prior-Art and Candidate Evaluation

The objective signals this skill leans on so a build-vs-buy call rests on published standards rather than vibes. When you rate a candidate on `evaluation-criteria.md`'s axes — license, maturity, security/supply-chain, version discipline — cite the standard here instead of asserting from memory. Each entry names the issuing body, pins the edition current as of 2026, and maps to a specific step of the workflow. Where a standard is versioned continuously (a tool or a list), say **current release** rather than guess a number.

`where-to-look.md` tells you *where* to discover candidates; this file tells you *how to score what you find* against recognized frameworks.

**Read the authority grade before you cite.** Every standards shelf in this plugin uses the same three grades, with the same meanings — see `../../loop-integrate/references/standards.md` for the shelf where all three are in play:

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it — or, as this plugin applies the grade consistently, a **published specification on a versioned track under formal governance**. On this shelf: **SLSA** and the **SPDX specification**, graded identically to `../../loop-ship/references/standards.md` and `../../loop-review/references/standards.md`, plus **ISO/IEC 5962:2021** itself, which ratified **SPDX 2.2.1** — see the row below for why that is not the same as saying "SPDX 3.x is an ISO standard."
- **Authoritative — draft.** Real, citable working-group or committee output that **nothing has ratified**. On this shelf: **ISO/IEC DIS 5962**, the draft that would make SPDX 3.x ISO-adopted and **has not passed**.
- **Authoritative — no.** A scoring tool's output, a community-stewarded convention, or a curated landscape. On this shelf: **SemVer** (community-stewarded, with no issuing body), **OpenSSF Scorecard** and **Criticality Score** (tools' opinion scores), and the **CNCF Landscape** and ecosystem registries (curated surfaces and metadata, not specifications).

**The line the plugin draws:** a *versioned specification with a published governance and approval process* is **yes**; a *tool's score, a curated list, or a community awareness document* is **no**. Both can come from the same foundation — OpenSSF publishes SLSA (**yes**) and Scorecard (**no**) — so grade the artifact, not the logo.

The grade matters most on the axis this skill exists to serve. A build-vs-buy verdict rests on **measured properties of the candidate** — its license id, its release history, its provenance attestation — not on the pedigree of the scheme you measured them with. Cite the scheme, and let the measurement carry the recommendation. A **No**-graded signal like a low Scorecard is **supporting** evidence, never the whole reason to reject a candidate.

## License identity — SPDX

| Field | Value |
|---|---|
| **Standard** | SPDX License List + SPDX License Expression syntax |
| **Issuing body** | The SPDX project, hosted by the **Linux Foundation** |
| **Edition (2026)** | SPDX Specification **3.0.1** (Dec 2024; 3.0 was Apr 2024), with a **3.1 release candidate** that is not a pin. The **License List** ships on its own rolling number and is updated roughly quarterly — always resolve against the current release. **Same pin as `../../loop-ship/references/standards.md` and `../../loop-review/references/standards.md`; the three move together.** |
| **ISO status — state it precisely** | **ISO/IEC 5962:2021 covers SPDX 2.2.1 only.** Confirmed 2026-07-26 against the ISO catalogue and `spdx.dev`. **ISO/IEC DIS 5962** for SPDX 3.x is at the enquiry stage and **has not passed**, so **do not describe SPDX 3.x as ISO-adopted** and do not write the bare phrase "SPDX is ISO/IEC 5962:2021" — that sentence silently upgrades the version you are actually citing. When a requirement names ISO/IEC 5962:2021, it is naming **2.2.1**. |

**Maps to the license-compatibility axis.** When you score axis 3 in `evaluation-criteria.md`, do not eyeball "it's MIT-ish." Read the candidate's declared license as a canonical **SPDX identifier** (`MIT`, `Apache-2.0`, `BSD-3-Clause`, `GPL-3.0-only`, `AGPL-3.0-only`) and its `LICENSE`/`SPDX-License-Identifier` metadata. Compound cases use SPDX expression operators — `Apache-2.0 OR MIT` (dual-licensed, pick one), `GPL-2.0-or-later WITH Classpath-exception-2.0` (a carve-out that changes the obligation). A deprecated id (`GPL-3.0` without `-only`/`-or-later`) is a signal the metadata is stale. Reducing every candidate to an SPDX id is what makes the AGPL-network-service trap and copyleft obligations comparable across a shortlist.

## Supply-chain trust — SLSA provenance

| Field | Value |
|---|---|
| **Standard** | SLSA — Supply-chain Levels for Software Artifacts |
| **Issuing body** | **OpenSSF** (Open Source Security Foundation), Linux Foundation |
| **Edition (2026)** | SLSA **v1.2** (approved **24 Nov 2025**, backwards-compatible with v1.1); the Build track's L0–L3 ladder is unchanged from v1.0, and the Source track is now approved. **Four shelves carry this pin — here, `../../loop-ship/`, `../../loop-review/`, `../../loop-harness/` — and a bump moves all four in one commit.** |

**Maps to the security & supply-chain axis.** SLSA grades how trustworthy a build artifact's *origin* is, on **Build Levels L0–L3**: L1 = provenance exists; L2 = signed provenance from a hosted build service; L3 = hardened, non-falsifiable provenance. When a candidate is a shipped binary or package (not just source), check for a provenance attestation and treat its SLSA level as the supply-chain evidence for the "provenance and signing" sub-point in `evaluation-criteria.md`. Higher level = less "did this artifact really come from that repo?" risk. This is the **adoption-time** provenance read — taken before the code is written, as one axis of a build-vs-buy score; for the **ship-time** gate on the single artifact about to be promoted, see `../../loop-ship/references/supply-chain-gate.md`.

## Objective maturity/health — OpenSSF Scorecard & Criticality Score

| Standard | Issuing body | Edition (2026) | What it measures |
|---|---|---|---|
| **OpenSSF Scorecard** | OpenSSF / Linux Foundation | current release (continuously versioned tool) | 0–10 automated score across ~18 checks: Maintained, Code-Review, Branch-Protection, Signed-Releases, Dependency-Update-Tool, Vulnerabilities, Token-Permissions, Fuzzing, SAST, Pinned-Dependencies |
| **OpenSSF Criticality Score** | OpenSSF / Linux Foundation | current release | 0–1 influence/importance score from usage and dependency signals — how much the ecosystem *depends* on the project |

**Maps to the maturity axis (axis 2).** These convert "is it alive and trusted?" from opinion into numbers. Read **Scorecard** as the health signal — a low Maintained or Signed-Releases check corroborates a stale-project or weak-provenance concern; it complements, not replaces, the human read of release cadence and issue responsiveness. Read **Criticality Score** as the adoption/importance signal, a durable stand-in for the "dependents over raw stars" rule. Use both to rank the top two or three candidates before writing the verdict line.

## Version & stability discipline — Semantic Versioning

| Field | Value |
|---|---|
| **Standard** | Semantic Versioning (SemVer) |
| **Issuing body** | semver.org — specification authored by Tom Preston-Werner (community-stewarded) |
| **Edition (2026)** | **2.0.0** — stable and unchanged since 2013; no newer edition pending |

**Maps to maturity + lock-in.** `MAJOR.MINOR.PATCH` tells you how a dependency manages change: MAJOR = breaking, MINOR = additive, PATCH = fixes. Read a candidate's version history as evidence of discipline — a project still on `0.x` signals an unstable public API (SemVer says anything may break); frequent MAJOR bumps signal high upgrade churn (a real TCO cost per axis 6); long, clean MINOR/PATCH streaks signal stability. This also sets the constraint you would pin in a manifest (`^1.2` vs `~1.2`) and feeds the "upgrade/maintenance burden" you weigh in `build-vs-buy.md`. Note the ecosystem dialects: npm ranges, Python PEP 440, Go's SemVer-based module versioning, Rust's Cargo `^` defaults — all trace back to SemVer 2.0.0.

## Discovery sources — landscapes & registries

| Source | Steward | Role in this skill |
|---|---|---|
| **CNCF Landscape** | Cloud Native Computing Foundation (Linux Foundation) | Curated map of cloud-native tools by category with maturity tiers (Sandbox / Incubating / Graduated) — a fast survey of the field's real options |
| **TODO Group** landscape method | TODO Group (Linux Foundation) | The open-source-program-office approach to cataloguing and comparing tools; the pattern behind category "landscapes" generally |
| **npm** | OpenJS Foundation ecosystem | JS/TS registry — weekly downloads, last publish, dependents |
| **PyPI** | Python Software Foundation | Python registry — releases, maintained status (pair with pypistats) |
| **crates.io** | Rust Foundation | Rust registry — downloads, recent version, reverse deps |
| **Maven Central** | Sonatype | Java/Kotlin registry — latest version, usages |
| **pkg.go.dev** | Go team / Google | Go module index — imported-by, versions |

**Maps to Step 2 (check the boring options first).** Treat these as the *authoritative* discovery surfaces, not blogs or model memory. A category **landscape** (CNCF-style) gives you the shortlist of serious contenders for a capability; the **ecosystem registry** gives you each candidate's canonical metadata — version, license id, release recency, dependents — which is exactly the input to the SPDX, SemVer, and Scorecard reads above. See `where-to-look.md` for the full source order (stdlib and platform first).

## Edition discipline

Standards get revised; a mapping is only as good as the edition it names.

- **Pin the edition you map to** — SPDX Spec 3.0.1, SLSA v1.2, SemVer 2.0.0 — and don't silently mix editions across a shortlist.
- **Carry the authority grade with the citation.** SLSA and SPDX are graded *yes*; Scorecard, Criticality Score, SemVer, and the landscapes are graded *no*. A candidate is rejected because of a measured property — an AGPL obligation, an unmaintained repo, an unsigned artifact — not because a scheme has a logo.
- **Rolling artifacts** (Scorecard, Criticality Score, the SPDX License List, the CNCF Landscape) have no fixed number; always read the **current release** at evaluation time rather than caching a value. **Never invent a version for one of them.**
- **Re-check on a cadence.** SLSA v1.2 (Nov 2025) is the current pin on a live v1.x track — the Source track was approved in that revision and further tracks are drafted; the SPDX License List changes quarterly, and **ISO/IEC DIS 5962 resolving** is the live watch item that would change the ISO row above. Re-verify roughly every two quarters, and when a new edition lands, update the pins here before relying on them.
- **Verify, don't assert.** For any maturity, license, provenance, or version claim that decides a recommendation, confirm it against the primary source (repo, registry, attestation) via the `loop-research` skill — the same rule `evaluation-criteria.md` applies to the scoring axes. **If you cannot confirm it, write "unconfirmed as of \<date\>" in the verdict rather than asserting a number.** A build-vs-buy call that rests on a fabricated version is worse than one that rests on a stated unknown.
- **Confirmation log — 2026-07-26.** Verified against the primary source: **SPDX 3.0.1 (Dec 2024)** as the current specification with a 3.1 release candidate outstanding, and **ISO/IEC 5962:2021 as covering SPDX 2.2.1 only** with **ISO/IEC DIS 5962** unresolved — this pass corrected a row that pinned "SPDX Specification 3.0" while calling SPDX flatly "also ISO/IEC 5962:2021", which is precisely the version-laundering the row now warns against, and which put this shelf at odds with `loop-ship`'s and `loop-review`'s. Also verified: **SLSA v1.2** (approved 24 Nov 2025, Source track approved) and **SemVer 2.0.0** as unchanged since 2013 with no successor pending. **Not independently re-confirmed and therefore deliberately left unpinned:** **OpenSSF Scorecard** and **Criticality Score** (continuously released tools — read the current check set, do not cache it), the **SPDX License List** release number, and the **CNCF Landscape** and the ecosystem registries, all of which are living surfaces to be read at evaluation time by design.
