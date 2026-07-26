# Research Standards — authoritative frameworks for evidence and rigor

The named standards behind this skill's judgement calls. `methodology.md` gives the sweep → read → verify → synthesize procedure and `source-evaluation.md` gives the credibility checklist; this file pins the **established frameworks** those steps operationalize, so a reviewer can say "we rated this source with CRAAP" or "this review follows PRISMA" instead of appealing to taste. Apply from this file, not from memory — the mnemonics are stable but the reporting standards (PRISMA, OCEBM) carry edition numbers, and citing the wrong edition makes a review look sloppy.

Each entry names the framework and its issuing body, pins the current edition as of 2026, **states plainly whether it is authoritative**, and maps it to a specific step of the methodology.

**Read the authority grade before you cite.** Every standards shelf in this plugin uses the same three grades, with the same meanings — see `../../loop-integrate/references/standards.md` for the shelf where all three are in play:

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it. *No entry on this shelf carries this grade*, and that is worth saying out loud: **nothing on this shelf is a ratified standard.** Research methodology has no ISO.
- **Authoritative — draft.** Real, citable working-group or committee output that **nothing has ratified**. *No entry on this shelf carries this grade either.*
- **Authoritative — no.** A reporting guideline maintained by a research consortium, an academic centre's appraisal table, or a teaching mnemonic. **PRISMA** and **GRADE** are the strongest of these — consensus reporting guidelines with named author groups, formal revision processes, and journal-level adoption, which is much more than the rest of the shelf has and still is not ratification. **OCEBM** is a university centre's table. **CRAAP** and **SIFT** are pedagogical mnemonics with a single named originator each.

The practical consequence: **cite these as the named method you applied, never as a rule the source breached.** "This claim sits at OCEBM level 4" is a defensible weighting; "this source violates PRISMA" is not a finding. What carries a research claim is the evidence and the trail, and these frameworks are the discipline that produces both.

## Source-credibility: the CRAAP test

**Framework.** The **CRAAP Test** — Currency, Relevance, Authority, Accuracy, Purpose. **Issuing body:** Sarah Blakeslee, Meriam Library, California State University, Chico (introduced 2004). **Edition:** a stable pedagogical mnemonic, not a versioned standard; there is no numbered revision to track — **do not invent one.**
**Authoritative: no** — a library-instruction mnemonic with a single originator.

**Maps to Step 2 (deep-read & triage).** CRAAP is the per-source scorecard you run while extracting claims — it is the named form of the `source-evaluation.md` credibility checklist. Run all five before trusting a source's claims:

| Letter | Question | Kills a source when… |
|---|---|---|
| **Currency** | When was it published / updated? | undated on a time-sensitive topic, or stale relative to the question |
| **Relevance** | Does it actually address the sub-question, at the right depth and audience? | tangential or shallow |
| **Authority** | Who published it, and are they positioned to know? | anonymous, no credentials, content farm |
| **Accuracy** | Is it evidence-backed and traceable to a primary source? | unsourced assertions, uncheckable claims |
| **Purpose** | Why does it exist — inform, sell, persuade? | undisclosed commercial or advocacy incentive |

CRAAP judges a page **in isolation**; pair it with SIFT below, which judges a source by leaving it.

## Verification: SIFT and lateral reading

**Framework.** **SIFT — the Four Moves** (Stop, Investigate the source, Find better coverage, Trace claims to the original), built on the **lateral reading** research from the Stanford History Education Group (Wineburg & McGrew). **Issuing body:** Mike Caulfield (SIFT, 2019); lateral-reading evidence base from Stanford. **Edition:** current, unversioned method — cite by name and originator with a retrieval date.
**Authoritative: no** — a media-literacy method, with a real empirical evidence base behind lateral reading specifically.

**Maps to Step 3 (adversarial verification).** SIFT is the *how* of refutation. Where CRAAP reads a source top-to-bottom, **lateral reading** means leaving the source and opening new tabs to check who is behind it and whether the claim holds up elsewhere — the operational move behind "corroboration" and "primary confirmation" in the methodology.

| Move | In this skill |
|---|---|
| **Stop** | before quoting, pause — do you know this source? is the claim load-bearing? |
| **Investigate the source** | read laterally: what do *other* sources say about this outlet/author, not what it says about itself |
| **Find better coverage** | seek independent, higher-quality corroboration; two outlets on one wire story count as one |
| **Trace** | follow the claim back to the **primary** source; secondary summaries routinely distort |

## Evidence hierarchy: levels of evidence

**Framework.** The **levels-of-evidence pyramid** — formalized as the **OCEBM Levels of Evidence**. **Issuing body:** Centre for Evidence-Based Medicine, University of Oxford. **Edition:** the **2011 "Levels of Evidence 2"** table, published as **document version 2.1**, is still the current version — confirmed against `cebm.ox.ac.uk` on **2026-07-26**, where the 2011 table and its introductory and explanation documents remain the ones CEBM hosts. Cite it as *"OCEBM 2011 Levels of Evidence (table v2.1)"*. The concept generalizes beyond clinical questions to any evidence ranking.
**Authoritative: no** — a university centre's appraisal heuristic, explicitly designed as a fast heuristic alongside (not instead of) critical appraisal. Use it to *weight* a claim, never to disqualify a source by tier alone.

**Maps to Steps 2–3 (extract and weight claims).** When two sources conflict, this is the tiebreak `source-evaluation.md` invokes as "primary and more-recent evidence outranks secondary and older." Rank the *evidence type* behind a claim, not the confidence of its author:

| Tier | Evidence type (research) | Generalized analogue (any topic) |
|---|---|---|
| **Strongest** | systematic review / meta-analysis | multiple independent primary sources in agreement |
| ↑ | randomized controlled trial | controlled experiment / benchmark with disclosed method |
| ↑ | cohort / observational study | field data, real-world usage at scale |
| ↑ | case series, single report | single anecdote, one deployment |
| **Weakest** | expert opinion, editorial | a pundit's take, a vendor's marketing |

A high-tier source outranks a low-tier one *on the same question*; note the tier when you record a claim so weighting is explicit at synthesis.

## Systematic-review reporting: PRISMA

**Framework.** **PRISMA — Preferred Reporting Items for Systematic reviews and Meta-Analyses.** **Issuing body:** the PRISMA Group, hosted by the **EQUATOR Network** at `prisma-statement.org`. **Edition:** **PRISMA 2020** (published 2021), which superseded the original 2009 statement — confirmed still current on **2026-07-26**, with the **27-item checklist**, an expanded checklist, an abstracts checklist, and flow diagrams for new and updated reviews. Extensions exist for specific review types (living systematic reviews among them) and are additions to PRISMA 2020, not successors to it.
**Authoritative: no** — a consensus reporting guideline from a named author group, not a ratified standard. It is the strongest source on this shelf and journals do require it; that is adoption, not ratification.

**Maps to the whole methodology when depth = literature review.** PRISMA is the reporting discipline for the `templates/research.workflow.js` path: it makes a review **reproducible** by documenting how sources were found, screened, and excluded. The **PRISMA flow diagram** (records identified → screened → excluded with reasons → included) is the auditable form of the Step 5 completeness critic — it turns "we searched broadly" into a countable trail. Adopt its spirit, not clinical bureaucracy: record search angles used (Step 1), inclusion/exclusion reasons at triage (Step 2), and the final included-source count. This is how a market or literature review answers "what did you leave out and why."

## Certainty of a body of evidence: GRADE

**Framework.** **GRADE — Grading of Recommendations, Assessment, Development and Evaluation.** **Issuing body:** the **GRADE Working Group** (methodology maintained via the GRADE Handbook and GRADEpro). **Edition:** a continuously maintained methodology rather than a numbered edition; cite "current GRADE guidance" with a retrieval date, and **never invent a version number for it.**
**Authoritative: no** — a working group's consensus methodology. Widely mandated by guideline developers, and still not a ratified standard.

**Maps to Step 4 (synthesize) — the confidence note.** Levels-of-evidence rates a *single* source; **GRADE rates the whole body** of evidence behind a conclusion, which is exactly what the "confidence & disagreement" section of the output report needs. Rate each headline conclusion **High / Moderate / Low / Very Low**, starting from the evidence tier and downgrading for:

- **Risk of bias** — weak methods or conflicted sources
- **Inconsistency** — sources disagree (report as *contested*, don't average away)
- **Indirectness** — evidence answers a nearby but different question
- **Imprecision** — small samples, wide ranges, single data point
- **Publication bias** — the sceptical/critical sweep angle came back empty (suspicious, not reassuring)

The GRADE rating is what distinguishes a verified-but-thin claim from a well-established one in the final synthesis.

## How this maps to the skill

| Step | Standard applied |
|---|---|
| 1 Sweep | PRISMA (record search angles for the audit trail) |
| 2 Read & triage | **CRAAP** (per-source score), levels-of-evidence (tier the source) |
| 3 Verify | **SIFT / lateral reading** (refute by leaving the source), levels-of-evidence (weight conflicts) |
| 4 Synthesize | **GRADE** (rate certainty of each conclusion) |
| 5 Completeness | PRISMA flow (what was excluded and why) |

## Edition discipline

Reporting standards get revised; the mnemonics do not. **PRISMA 2020 replaced the 2009 statement — cite the year, and never mix 2009 and 2020 checklists in one review.** OCEBM's current table is the **2011** revision (document version 2.1). CRAAP, SIFT, and GRADE are living or unversioned — cite them by name and date-check on adoption. Re-verify the PRISMA and OCEBM editions on a roughly annual cadence (EQUATOR Network for PRISMA, CEBM for OCEBM); when a new edition lands, update this file and the map above before running the next review, and do not straddle editions within a single report. See `source-evaluation.md` for the credibility checklist these frameworks formalize and `methodology.md` for the step-by-step procedure they slot into.

- **Carry the authority grade with the citation.** Nothing here is ratified. Name the method you applied — *"weighted with OCEBM 2011"*, *"screened and reported per PRISMA 2020"* — and let the evidence carry the claim.
- **Never invent a version for an unversioned source.** CRAAP, SIFT, and GRADE have none. This is the skill that *teaches* verification; a fabricated edition number here discredits every other file in it.
- **Say "unconfirmed" out loud.** If you cannot confirm an edition against its issuing body, write *"current edition, unconfirmed as of \<date\>"* in the output rather than asserting a number. A stated non-confirmation is a usable research finding; a confident fabrication is the exact failure this skill exists to catch in other people's sources.

**Confirmation log — 2026-07-26.** Verified against the primary source: **PRISMA 2020** as still the current statement (`prisma-statement.org` / the 2021 publication; 27-item checklist, abstracts checklist, and flow diagrams; extensions supplement rather than supersede it), and the **OCEBM 2011 Levels of Evidence table, document version 2.1**, as the version CEBM Oxford still hosts. **Not independently re-confirmed and therefore named without new precision:** **CRAAP** (Blakeslee, 2004), **SIFT** (Caulfield, 2019) and the Stanford lateral-reading evidence base, and **current GRADE guidance** — all three are unversioned or continuously maintained, so there is no edition to confirm and the honest pin is the name plus the date you read it.
