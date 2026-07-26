# Authoritative standards — the frameworks a review cites

`owasp-cwe.md` is the *tagging* taxonomy (OWASP category + CWE id + ASVS control) and `severity-model.md` is the *scoring* model (CVSS band × confidence). This file is the wider standards shelf a review reaches past those two: the process frameworks, supply-chain provenance schemes, attack-pattern taxonomies, compliance regimes, and adjacent OWASP lists you name when a finding needs an authority beyond "the code is wrong here."

Cite from this file, not from memory — editions drift, and a fabricated version number or a stale control id makes a report look sloppy. When you are unsure of an exact edition, name the standard and write "current edition" rather than invent a number. Every entry below is pinned to the edition current **as of 2026-07**; see the closing edition-discipline note for the re-check cadence and the confirmation log.

**Authority grades — the plugin's three, identical on every standards shelf here.** Carry the grade with the citation.

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it. On this shelf: **NIST SSDF / SP 800-53**, **SLSA**, **SPDX**, **CycloneDX (ECMA-424)**, **in-toto**, **CVSS v4.0**, **PCI-DSS**, **HIPAA**, **GDPR**, **SOC 2**, and **MITRE ATT&CK / CAPEC / CWE**. A finding may rest on one of these on its own.
- **Authoritative — draft.** Real, citable committee output that **nothing has ratified**. Name the revision and status every time. On this shelf: the **HIPAA Security Rule 2025 NPRM**, which is a *proposed* rule and binds nobody.
- **Authoritative — no.** Community guidance, tooling, or a vendor's list — influential and not a specification. On this shelf: the **OWASP lists and Cheat Sheets** (a foundation's community consensus, not a ratified standard) and **OpenSSF Scorecard** (a tool's opinion score). Tag from them freely; do not phrase a finding as *"in violation of OWASP."*

The OWASP grade is the one people get wrong. The Top 10 is the single most cited artifact in this skill and it is still a **community awareness document**. It is the right tagging taxonomy; it is not a rule the code can breach.

## Process frameworks — NIST

The **NIST Secure Software Development Framework (SSDF)** and **NIST SP 800-53** are the "what does mature look like" backdrop. You do not tag individual findings with them the way you tag CWE; you invoke them when a finding is really a *process* gap (no dependency-patch process, no build integrity, no secrets management) and the reader needs a recognized control to point remediation at.

| Standard | Body | Edition (2026) | How it maps to this skill |
|---|---|---|---|
| **SSDF — SP 800-218** | NIST | **v1.1** (Feb 2022); **SP 800-218A** extends it to generative-AI / dual-use foundation models and is **FINAL — published 26 July 2024**, not draft (confirmed against NIST CSRC 2026-07-26: draft 29 Apr 2024 → final 26 Jul 2024). Cite it as published guidance when the diff touches an AI model pipeline | When findings cluster into a systemic gap (§3 phase-1 context shows no patch cadence, no code integrity, secrets in source), name the SSDF practice group — **PO** (Prepare Org), **PS** (Protect Software), **PW** (Produce Well-Secured Software), **RV** (Respond to Vulnerabilities) — as the remediation frame. `PW.4`/`PW.5` back secure-coding findings; `PS.1`/`PS.2` back the supply-chain section below; `RV` backs the SCA/known-CVE flow in `severity-model.md`. |
| **SP 800-53** | NIST | **Rev. 5** (with control updates through Rev. 5.1.1) | The control catalog to cite for a regulated codebase. Map a finding to its control family: **AC** (Access Control) for authz findings, **IA** (Identification & Authentication) for auth, **SC** (System & Communications Protection) for crypto/TLS, **SI** (System & Information Integrity) for input validation and integrity, **AU** (Audit & Accountability) for logging findings, **SA**/**SR** (System & Services Acquisition / Supply Chain) for dependency and provenance findings. |

## Software supply-chain — provenance & inventory

The A06 "vulnerable & outdated components" sweep (see `vulnerability-playbooks.md`) is where these appear. They answer three questions a dependency finding raises: *what is in the build* (SBOM), *can I trust how it was built* (SLSA + signing), and *how healthy is the project* (Scorecard).

The same standards are cited from three different lifecycle moments across this plugin, and this section is the **audit-time dependency-health** read — is this component safe to use, scoped to a diff or a repo, producing a finding with a severity. For the **ship-time** read — a binary pass/fail on one artifact about to be promoted — see `../../loop-ship/references/supply-chain-gate.md`; for the **adoption-time** read, `../../loop-scout/references/standards.md`. Do not run one moment's check and report it as another's.

| Standard | Body | Edition (2026) | How it maps to this skill |
|---|---|---|---|
| **SLSA** | OpenSSF | **v1.2** (approved **24 Nov 2025**; Source track promoted to approved; backwards-compatible with v1.1. Build track, levels **L0–L3**). Four shelves in this plugin carry this pin — here, `loop-ship`, `loop-scout`, `loop-harness` — and they move in lockstep | The provenance ladder. When a finding is "artifact built with no verifiable provenance," phrase remediation as a target SLSA build level: **L1** provenance exists, **L2** signed by a hosted builder, **L3** hardened, non-forgeable builder. Escalate integrity findings (OWASP A08) toward L2/L3. |
| **SBOM — SPDX** | Linux Foundation / ISO | **SPDX 3.0.1** (Dec 2024; 3.0 was Apr 2024). **2.2.1 remains the only ISO-adopted edition** (ISO/IEC 5962:2021); ISO/IEC **DIS 5962** for SPDX 3.0 is at the enquiry stage and has **not** passed, so do not call 3.x ISO-adopted. 2.3 (2022) is still widely deployed. Same pin as `../../loop-ship/references/standards.md` and `../../loop-scout/references/standards.md` — the three move together | The inventory format an SCA finding assumes exists. If none does, the finding is "no SBOM" — recommend generating SPDX or CycloneDX in CI. |
| **SBOM — CycloneDX** | OWASP / Ecma International | **v1.7** (released **Oct 2025**; ratified as **ECMA-424, 2nd edition, December 2025**). Write the Ecma edition's own date — the spec release and the Ecma ratification are two months apart | The OWASP-native SBOM; richer for vulnerability (VEX) and dependency-relationship data. Prefer it when the report already speaks OWASP. |
| **OpenSSF Scorecard** | OpenSSF | current edition (continuously released checks) | A per-dependency health signal (branch protection, pinned deps, maintained, dangerous-workflow). Use a low Scorecard as *supporting* evidence to raise an "unmaintained component" (CWE-1104) finding — never as the finding by itself. |
| **Sigstore / in-toto** | OpenSSF / CNCF | Sigstore **GA, continuously released — no single version number across cosign/Fulcio/Rekor; cite it as current and pin the client your pipeline runs**. **in-toto attestation v1.2.0** (18 Mar 2026) — the same pin `../../loop-ship/references/standards.md` carries | The signing + attestation layer under SLSA. Cite `cosign`/Sigstore for "artifacts are unsigned" and in-toto for "no build attestation." These are the concrete *how* behind a SLSA-L2+ remediation. |

## Secrets — detection taxonomy & remediation anchors

The hardcoded-secrets category in `vulnerability-playbooks.md` finds them; this pins how to classify and how to fix. There is no single ISO "secrets standard," so anchor severity to blast radius and remediation to the OWASP Cheat Sheets.

- **Detection taxonomy** — classify each hit by *type* (cloud key, DB credential, signing/private key, OAuth token, generic high-entropy string) and *blast radius* (test/dummy vs. live production credential). Per `severity-model.md`, a live secret granting production access is Critical; a dummy in a fixture is excluded. **CWE-798** (hardcoded credentials) and **CWE-321/-256/-522** (crypto key / plaintext storage / insufficiently protected credentials) are the tags — see `owasp-cwe.md`.
- **Remediation anchor** — the **OWASP Cheat Sheet Series** (current edition, continuously updated) is the canonical fix reference: the *Secrets Management*, *Cryptographic Storage*, and *Password Storage* cheat sheets. Point the "how to fix" line at the relevant sheet (rotate the exposed credential, move to a secrets manager, purge from git history) rather than restating advice.

## CVSS v4.0 vector-string grammar

`severity-model.md` uses the CVSS v4.0 *bands* as shared vocabulary and its layered nomenclature (**CVSS-B / -BT / -BTE**). This section is the full **vector-string grammar** for the cases where a vector already ships (dependency CVEs) or where a reviewer wants to justify a band precisely. **FIRST CVSS v4.0** (Nov 2023) is the current specification.

A vector is `CVSS:4.0` followed by slash-delimited metric groups. **Base metrics are mandatory:**

`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N`

| Group | Metric | Values |
|---|---|---|
| **Exploitability** | AV Attack Vector · AC Attack Complexity · AT Attack Requirements · PR Privileges Required · UI User Interaction | AV: N/A/L/P · AC: L/H · AT: N/P · PR: N/L/H · UI: N/P/A |
| **Vulnerable system impact** | VC · VI · VA (Confidentiality/Integrity/Availability) | H/L/N |
| **Subsequent system impact** | SC · SI · SA | H/L/N |
| **Threat** (optional) | E Exploit Maturity | X/A/P/U |
| **Environmental** (optional) | modified base (MAV…MSA) + CR/IR/AR requirements | per-metric / H/M/L |
| **Supplemental** (optional, informational) | S Safety, AU Automatable, R Recovery, V Value Density, RE Response Effort, U Provider Urgency | per-metric |

The example above scores an unauthenticated, no-interaction, network RCE at full impact — CVSS-B ≈ 9.3, Critical. **Do not compute a vector for every source finding** (`severity-model.md` assigns bands by judgment); reproduce or verify a vector only when a CVE supplies one, or to defend a contested band.

## Compliance cross-maps — regulated findings

When the codebase is in a regulated domain, a finding lands harder if it names the regime it breaches. Map, do not moralize — one clause reference is enough.

| Regime | Body | Edition (2026) | Map a finding when it touches… |
|---|---|---|---|
| **PCI-DSS** | PCI SSC | **v4.0.1** (2024; v3.2.1 retired 2024). Confirmed current 2026-07-26 — **no v4.0.2 exists**. Note the timeline: every future-dated v4.x requirement became **mandatory on 31 March 2025**, so "future-dated, not yet required" is no longer a valid deferral | cardholder data — Req. 3 (stored PAN/crypto), Req. 6 (secure development), Req. 8 (auth), Req. 10 (logging). |
| **HIPAA Security Rule** | HHS (45 CFR §164.302–318) | **the existing rule is what binds.** The **NPRM published 6 Jan 2025** is still *proposed* — confirmed 2026-07-26: comment closed March 2025, ~4,700 comments under review, and OMB's Unified Agenda (RIN 0945-AA22) now targets **July 2027** for final action, slipped from a spring-2026 target. **Cite the current rule; cite the NPRM only as a proposal, never as a requirement** | ePHI — access control §164.312(a), audit §164.312(b), transmission security §164.312(e). |
| **SOC 2** | AICPA | **TSP Section 100, Trust Services Criteria (2017) with revised points of focus (2022)** — confirmed current 2026-07-26. The 2022 revision changed the points of focus, **not the criteria**; the five categories are unchanged since 2017 | the Security/Common Criteria (CC-series) — most findings map to CC6 (logical access) and CC7 (system operations). |
| **GDPR** | EU (Reg. 2016/679) | in force | personal data — Art. 32 (security of processing), Art. 25 (data protection by design), Art. 33/34 (breach). |

## Attack-pattern taxonomies — MITRE

CWE (in `owasp-cwe.md`) names the *weakness*; these name the *attacker behavior* that exploits it. Add them when a finding's exploit path benefits from a recognized adversary reference — optional, not required tagging.

| Taxonomy | Body | Edition (2026) | Use for |
|---|---|---|---|
| **ATT&CK** | MITRE | current release (versioned ~2×/yr) | Naming the technique an exploited finding enables (e.g. `T1190` Exploit Public-Facing Application, `T1552` Unsecured Credentials for a secrets finding). Frames impact in defender language. |
| **CAPEC** | MITRE | **v3.9** — confirmed current on `capec.mitre.org` 2026-07-26 | Naming the *attack pattern* that abuses a weakness (e.g. CAPEC-66 SQL Injection). CAPEC entries link directly to their CWEs, so it bridges the exploit story back to the tag. |

## Adjacent OWASP lists — beyond the web Top 10

The Top 10 in `owasp-cwe.md` covers server-side web. When the changed code is an API, an LLM feature, or a mobile app, that list undershoots — reach for the domain-specific list and tag from it instead of forcing a web category.

| List | Edition (2026) | Reach for it when the diff is… |
|---|---|---|
| **OWASP API Security Top 10** | **2023** — confirmed still the current published list on 2026-07-26; no 2026 refresh has been published | a REST/GraphQL API — covers BOLA (API1, object-level authz / IDOR), broken authentication (API2), BOPLA (API3), unrestricted resource consumption (API4). Prefer over web A01 for object-level authz on API routes. |
| **OWASP Top 10 for LLM Applications** | **2025** (published 18 Nov 2024 by the OWASP GenAI Security Project; ids run `LLM01:2025`–`LLM10:2025`) — confirmed current 2026-07-26. Same pin as `../../loop-autopilot/references/standards.md` | an LLM/GenAI feature — prompt injection (LLM01), sensitive-info disclosure (LLM02), supply chain (LLM03), insecure output handling, excessive agency. |
| **OWASP MASVS** | **v2.1.0** (18 Jan 2024) — confirmed current 2026-07-26; 8 categories, 24 controls, MASVS-PRIVACY added in 2.1.0 | a mobile app — the mobile analog of ASVS; cite MASVS categories (STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE) as the positive-control anchor the way `owasp-cwe.md` cites ASVS. |

## CWE relationships beyond the Top 25

The Top 25 in `owasp-cwe.md` is a *prevalence-ranked shortlist*, not the whole taxonomy. When a weakness isn't in it, navigate **CWE View-1000 (Research Concepts)** — MITRE's full hierarchical view — to find the precise child id. Prefer the most specific **Base** or **Variant** weakness over a **Class**-level parent (e.g. CWE-89 SQLi over its parent CWE-943, over the class CWE-74 Injection). Cite the specific id you land on; note the parent only if it clarifies the category roll-up. This is the same "prefer specific over generic" rule as `owasp-cwe.md`'s tagging rules, applied outside the shortlist.

## Edition discipline

Standards get revised, and a report that mixes editions or cites a retired one reads as careless. Rules:

- **Cite the edition you mapped to, in the finding** — "PCI-DSS 4.0.1 Req. 6", "CVSS:4.0 vector", "SLSA v1.2 L2" — never a bare "PCI" or "CVSS."
- **Do not mix editions inside one report.** Tag from **one** OWASP web Top 10 edition per report and name which. Whichever you choose, keep every companion mapping on its 2026-current edition listed here; don't half-upgrade.
- **OPEN — the OWASP web Top 10 2025 has shipped, and `owasp-cwe.md` still teaches the 2021 categories.** Confirmed 2026-07-26: `owasp.org/www-project-top-ten` states *"The most current released version is the OWASP Top 10 2025"* and publishes it at `owasp.org/Top10/2025/`. (Secondary reporting puts the announcement at OWASP Global AppSec Washington DC in Nov 2025 and final publication in Jan 2026; the *release status* comes from OWASP's own page, the dates do not.) The 2025 edition adds categories and consolidates others, so the 2021 ids in `owasp-cwe.md` do not map across one-to-one. **Until `owasp-cwe.md` is migrated, state in the report which edition you tagged from** — this shelf will not pretend the refresh is still pending, and it will not silently re-key a taxonomy that lives in another file.
- **Watch the live revisions** flagged above: the **HIPAA Security Rule NPRM** (final action now targeted July 2027), **ISO/IEC DIS 5962** resolving so SPDX 3.x becomes ISO-adopted, the next **OWASP API Security Top 10** and **MASVS** revisions, and the annual MITRE ATT&CK/CWE re-releases. **SP 800-218A is no longer a watch item — it went final on 26 July 2024** and this shelf was wrong to carry it as a draft.
- **Re-check this shelf on a cadence** — at minimum when starting a review for a new regulated client, and otherwise roughly twice a year. When an edition here goes stale, update the row and the closing note together; do not leave a pinned version behind that a reader will trust as current.
- **Confirmation log — 2026-07-26.** Verified against the primary source: SLSA v1.2, SPDX 3.0.1 + unresolved ISO DIS, CycloneDX v1.7 / ECMA-424 2nd ed. **December 2025** (corrected from Oct 2025), in-toto **v1.2.0, 18 Mar 2026**, SP 800-218A **final** (corrected from draft), **CVSS v4.0 (1 Nov 2023) with no successor published**, PCI-DSS 4.0.1, SOC 2 TSC 2017/2022, HIPAA NPRM still proposed, CAPEC v3.9, OWASP API Top 10 2023, OWASP LLM Top 10 2025, MASVS v2.1.0, and the release of the OWASP web Top 10 2025. **Not re-confirmed in this pass and therefore not restated with new precision:** SP 800-53 Rev. 5's exact update level (cited here as "through Rev. 5.1.1" — check the CSRC release history before quoting a control revision), MITRE ATT&CK's current release number (deliberately unpinned; it re-releases about twice a year), and OpenSSF Scorecard's check set (a continuously released tool — read the current checks, do not cache them).
