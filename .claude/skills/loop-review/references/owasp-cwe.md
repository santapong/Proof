# OWASP, CWE & ASVS — the standards mapping

The tagging taxonomy for the review. Every finding that clears the reporting bar in `severity-model.md` gets a three-part label before it goes in the report:

1. **OWASP Top 10 category** — the class of failure, for the human skimming the report ("this is an access-control problem").
2. **CWE id** — the precise weakness, for dedup, trend tracking, and linking to a remediation reference.
3. **ASVS control** — the positive control that *fixes* it, so the report points at what right looks like instead of only what's wrong.

Tag from this file, not from memory. The categories drift year to year and a wrong id makes findings look sloppy and breaks cross-review consistency. `vulnerability-playbooks.md` tells you how to *find* each weakness; this file tells you how to *name* it.

## OWASP Top 10:2025 — the category axis

**Edition.** **OWASP Top 10:2025**, announced November 2025 at Global AppSec Washington DC and published as **final in January 2026**. Confirmed against `owasp.org/Top10/2025/` on **2026-07-26**. It supersedes the 2021 edition, which this file previously carried as its baseline. Reproduce these ids and names verbatim.

| ID | Category |
|---|---|
| **A01:2025** | Broken Access Control |
| **A02:2025** | Security Misconfiguration |
| **A03:2025** | Software Supply Chain Failures |
| **A04:2025** | Cryptographic Failures |
| **A05:2025** | Injection |
| **A06:2025** | Insecure Design |
| **A07:2025** | Authentication Failures |
| **A08:2025** | Software or Data Integrity Failures |
| **A09:2025** | Security Logging and Alerting Failures |
| **A10:2025** | Mishandling of Exceptional Conditions |

**Tag against 2025, and never mix editions inside one report.** If a client's tooling, auditor, or compliance mapping still keys on 2021 — many do, and that is a legitimate reason to dual-tag — write both explicitly (`A05:2025 Injection / A03:2021 Injection`) rather than an unsuffixed `A03`, which is ambiguous across editions and is exactly how a cross-review trend line silently corrupts.

**What moved from 2021 → 2025**, because the renumbering catches out reviewers who learned the old list:

| Change | Detail |
|---|---|
| **Two new categories** | **A03:2025 Software Supply Chain Failures** (broader than 2021's *Vulnerable and Outdated Components*, which it absorbs) and **A10:2025 Mishandling of Exceptional Conditions** |
| **SSRF absorbed** | 2021's dedicated *A10 SSRF* folded into **A01:2025 Broken Access Control** |
| **Injection renumbered** | **A03:2021 → A05:2025.** The single most common mis-tag; XSS and SQLi move with it |
| **Misconfiguration promoted** | *A05:2021 → **A02:2025*** |
| **Renames** | *Identification and Authentication Failures* → **Authentication Failures**; *Software and Data Integrity Failures* → **Software or Data Integrity Failures**; *Security Logging and Monitoring Failures* → **Security Logging and Alerting Failures** |
| **Unchanged at #1** | **A01 Broken Access Control**, in both editions |

Older still: 2017's *A4 XML External Entities (XXE)* folded into Security Misconfiguration in 2021, and 2017's *A7 XSS* folded into Injection — so an XSS finding tags **A05:2025**, not a category of its own.

## OWASP ASVS 5.0 — the positive-control checklist

The Top 10 is a list of what goes wrong; the **Application Security Verification Standard (ASVS) 5.0** is the list of what "correct" looks like — testable requirements, organized into chapters, gated by three assurance levels (**L1** opportunistic / L2 standard for most apps / **L3** high-assurance). Use it to phrase the *fix* on a finding and to run a positive sweep ("is this control present?") rather than only a negative one ("is this bug present?").

ASVS 5.0 renumbered its chapters. Map each OWASP category to the ASVS chapter(s) that supply its positive control:

| OWASP category (2025) | ASVS 5.0 chapter(s) — the control to verify present |
|---|---|
| A01:2025 Broken Access Control | V8 Authorization (deny-by-default, enforce at the trust boundary), V7 Session Management. **Also SSRF** since 2025 absorbed it: V2 Validation (allow-list outbound destinations), V4 API and Web Service |
| A02:2025 Security Misconfiguration | V13 Configuration (hardening, headers, no debug/defaults in prod), V5 File Handling |
| A03:2025 Software Supply Chain Failures | V15 Architecture (dependency inventory, provenance, patch process, no unmaintained components), V13 Configuration. Pairs with the SLSA/SBOM pins in `standards.md` |
| A04:2025 Cryptographic Failures | V11 Cryptography (approved algorithms, key management, secure random), V12 Secure Communication (TLS), V14 Data Protection |
| A05:2025 Injection | V1 Encoding and Sanitization (context-correct output encoding), V2 Validation and Business Logic (parameterized queries, allow-list input) |
| A06:2025 Insecure Design | V15 Secure Coding and Architecture (threat modeling, secure-by-default, defense in depth), V2 business-logic limits |
| A07:2025 Authentication Failures | V6 Authentication, V7 Session Management, V9 Self-contained Tokens, V10 OAuth and OIDC |
| A08:2025 Software or Data Integrity Failures | V1/V2 (safe deserialization), V15 Architecture (verify integrity of updates, CI/CD, and untrusted data) |
| A09:2025 Security Logging and Alerting Failures | V16 Security Logging and Error Handling (log security events, no sensitive data in logs, fail closed) |
| A10:2025 Mishandling of Exceptional Conditions | V16 Error Handling (fail closed, no sensitive detail in error responses), V2 Business Logic (handle the error path, not only the happy path) |

You do not need to cite an exact ASVS requirement number in every finding; naming the chapter and the control ("ASVS V8 — enforce authorization server-side, deny by default") is enough to point the reader at the fix.

## CWE Top 25 (2025) — the weakness taxonomy

**Edition.** The **2025 CWE Top 25 Most Dangerous Software Weaknesses**, published **11 December 2025** by CISA with MITRE/HSSEDI, drawn from roughly 39,000 CVEs disclosed between June 2024 and June 2025. Confirmed against `cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html` on **2026-07-26**.

The list is the precise-id axis. Tag the CWE that names the *specific* weakness, then roll it up to its OWASP category. **The roll-up column below is 2025 ids** — note that Injection is **A05:2025**, not the A03 it was in 2021. These are the ~15 you will reach for most often:

| CWE | Name | Rolls up to |
|---|---|---|
| **CWE-79** | Improper Neutralization of Input During Web Page Generation (XSS) — **#1 in 2025** | A05:2025 |
| **CWE-89** | SQL Injection — **#2** | A05:2025 |
| **CWE-352** | Cross-Site Request Forgery (CSRF) — **#3** | A01:2025 |
| **CWE-862** | Missing Authorization — **#4** | A01:2025 |
| **CWE-787** | Out-of-bounds Write — **#5** | (memory-safety; no direct OWASP web category) |
| **CWE-78** | OS Command Injection | A05:2025 |
| **CWE-77** | Command Injection | A05:2025 |
| **CWE-94** | Code Injection | A05:2025 |
| **CWE-20** | Improper Input Validation | A05:2025 (cross-cuts) |
| **CWE-22** | Improper Limitation of a Pathname to a Restricted Directory (Path Traversal) | A01:2025 |
| **CWE-863** | Incorrect Authorization | A01:2025 |
| **CWE-284** | Improper Access Control — **new in 2025** | A01:2025 |
| **CWE-639** | Authorization Bypass Through User-Controlled Key — **new in 2025** | A01:2025 |
| **CWE-434** | Unrestricted Upload of File with Dangerous Type | A06:2025 / A02:2025 |
| **CWE-287** | Improper Authentication | A07:2025 |
| **CWE-306** | Missing Authentication for Critical Function | A07:2025 |
| **CWE-798** | Use of Hard-coded Credentials | A07:2025 / A04:2025 |
| **CWE-502** | Deserialization of Untrusted Data | A08:2025 |
| **CWE-918** | Server-Side Request Forgery (SSRF) | A01:2025 — SSRF lost its dedicated category in 2025 |
| **CWE-770** | Allocation of Resources Without Limits or Throttling — **new in 2025** | A10:2025 |
| **CWE-125** | Out-of-bounds Read | (memory-safety; no direct OWASP web category) |
| **CWE-416** | Use After Free | (memory-safety) |
| **CWE-120 / -121 / -122** | Classic / stack-based / heap-based buffer overflow — **new in 2025** | (memory-safety) |

The memory-safety entries (CWE-125, -787, -416, plus CWE-119/-476/-190) dominate the CWE Top 25 because it spans all software, not just web apps — they have no clean OWASP Top 10 home. Tag them with the CWE id alone and note "memory safety (C/C++/unsafe)" in the finding; do not force an OWASP category that does not fit.

**SANS is not a separate list.** "SANS Top 25" and "CWE Top 25" are the same lineage — the list originated as the *CWE/SANS Top 25 Most Dangerous Software Errors* and is now maintained by MITRE as the **CWE Top 25 Most Dangerous Software Weaknesses**. If a user or tool says "SANS Top 25", they mean this list. Do not tag a finding twice or present them as two standards.

## OWASP ↔ CWE cross-map

When you have the OWASP category but need a specific CWE (or want to sanity-check a roll-up), use this. It lists the CWEs OWASP itself maps to each 2021 category — pick the one that matches the exact weakness, not just the first row.

| OWASP category | Common mapped CWEs |
|---|---|
| **A01 Broken Access Control** | CWE-22 Path Traversal, CWE-352 CSRF, CWE-862 Missing Authorization, CWE-863 Incorrect Authorization, CWE-639 Authorization Bypass Through User-Controlled Key (IDOR), CWE-284 Improper Access Control, CWE-200 Sensitive Info Exposure, CWE-269 Improper Privilege Management |
| **A02 Cryptographic Failures** | CWE-327 Broken/Risky Crypto Algorithm, CWE-326 Inadequate Encryption Strength, CWE-331 Insufficient Entropy, CWE-321 Hard-coded Crypto Key, CWE-916 Weak Password Hash, CWE-798 Hard-coded Credentials |
| **A03 Injection** | CWE-79 XSS, CWE-89 SQLi, CWE-78 OS Command Injection, CWE-77 Command Injection, CWE-94 Code Injection, CWE-20 Improper Input Validation, CWE-116 Improper Encoding/Escaping of Output |
| **A04 Insecure Design** | CWE-73 External Control of File Name/Path, CWE-209 Sensitive Info in Error Message, CWE-256 Plaintext Credential Storage, CWE-522 Insufficiently Protected Credentials, CWE-602 Client-Side Enforcement of Server-Side Security, CWE-434 Unrestricted Upload |
| **A05 Security Misconfiguration** | CWE-16 Configuration, CWE-611 XXE, CWE-732 Incorrect Permission Assignment, CWE-1004 Sensitive Cookie Without HttpOnly, CWE-548 Directory Listing Exposure |
| **A06 Vulnerable and Outdated Components** | CWE-1104 Use of Unmaintained Third-Party Components, CWE-937 OWASP Top Ten Known Vulnerable Components, CWE-1035 (SCA class) |
| **A07 Identification and Authentication Failures** | CWE-287 Improper Authentication, CWE-306 Missing Authentication for Critical Function, CWE-798 Hard-coded Credentials, CWE-384 Session Fixation, CWE-620 Unverified Password Change, CWE-640 Weak Password Recovery, CWE-521 Weak Password Requirements |
| **A08 Software and Data Integrity Failures** | CWE-502 Deserialization of Untrusted Data, CWE-345 Insufficient Verification of Data Authenticity, CWE-494 Download of Code Without Integrity Check, CWE-829 Inclusion of Functionality from Untrusted Control Sphere, CWE-565 Reliance on Cookies Without Integrity |
| **A09 Security Logging and Monitoring Failures** | CWE-778 Insufficient Logging, CWE-117 Improper Output Neutralization for Logs (log injection), CWE-223 Omission of Security-relevant Information, CWE-532 Insertion of Sensitive Information into Log File |
| **A10 Server-Side Request Forgery** | CWE-918 SSRF |

## Tagging rules

- **One primary CWE per finding.** Pick the most specific weakness that describes the root cause. If a bug is both "missing check" and "wrong check", it is one or the other — decide, don't tag both.
- **Roll the CWE up to exactly one OWASP category** using the cross-map. When a CWE legitimately spans two (e.g. CWE-798 hard-coded credentials is both A07 and A02), pick the one that matches the *impact in this codebase* and mention the other in prose.
- **Prefer the specific over the generic.** Use CWE-89 (SQLi) over CWE-20 (Improper Input Validation) when the sink is a SQL query; reserve CWE-20 for validation gaps with no more specific sink.
- **Cite ASVS as the remediation anchor**, not as a category — it belongs in the "how to fix" line of the finding, pointing at the control that would have prevented it.
- **Do not invent ids.** If nothing here fits, look up the exact CWE rather than approximating; a plausible-but-wrong id is worse than "CWE: (unmapped — see description)".
