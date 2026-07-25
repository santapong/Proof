# Incident-Response Standards — the authoritative shelf

The frameworks behind this skill's declare → mitigate → reproduce → recover → learn loop. `incident-command.md` tells you *how* to declare and staff, `mitigation-playbook.md` *how* to stop the bleeding, `reproduction-timeline.md` *how* to build the two artifacts handed to `loop-debug`, and `postmortem.md` *how* to write the deliverable. This file names the standard each of those rests on, pins the edition to cite, **states plainly whether it is authoritative**, and maps it to where it earns its keep here.

**Read the authority grade before you cite.** This shelf mixes two different kinds of source and they are cited differently:

- **Authoritative — yes.** A published specification, government doctrine, or licensed practice framework issued by a standards body. Cite it by name and edition as a normative reference: *"per NIST SP 800-61 Rev. 3"*.
- **Authoritative — no.** An influential practitioner book or vendor documentation set. It is the best available description of a practice, and it is *not* a specification. Cite it as attributed doctrine: *"following the Google SRE Book's incident-management model"*, never *"as required by"*. Do not launder a vendor's opinion into a standard by dropping the attribution.

Every entry is pinned to the edition current **as of 2026**; the closing edition-discipline note carries the re-check cadence and the two live transitions this shelf is sitting on top of.

## NIST SP 800-61 — the incident lifecycle

**Standard.** *NIST SP 800-61, Incident Response Recommendations and Considerations for Cybersecurity Risk Management*.
**Edition.** **Revision 3 (April 2025)**, which supersedes Revision 2's *Computer Security Incident Handling Guide*. Rev. 3 is a re-framing, not a re-issue: the guidance is restructured around **NIST Cybersecurity Framework (CSF) 2.0**'s six functions — **Govern, Identify, Protect, Detect, Respond, Recover** — rather than Rev. 2's four-phase handling cycle. Cite the revision explicitly; a bare "NIST 800-61" now reads as Rev. 2 to anyone who learned it before 2025.
**Publisher.** NIST (U.S. Department of Commerce).
**Authoritative: yes** — a published federal special publication.

**Maps to the skill.** This is the backbone of `SKILL.md`'s ordering. Declare and stand up command is **Respond**; mitigation is **Respond**; the reproduction and timeline are the evidence products **Respond** hands forward; de-escalation is **Recover**; the postmortem and its action items are **Govern** and **Identify** — which is the whole point of Rev. 3's re-framing and the reason this skill treats incident preparation as continuous risk management rather than a one-off runbook. The action items in `postmortem.md` that hand alert and runbook work to `loop-operate` are **Detect**- and **Protect**-function work being routed to the skill that owns it.

**Scope caveat worth stating.** 800-61 is written for *cybersecurity* incidents. This skill covers a wider class — a bad deploy, capacity exhaustion, a dependency outage — where there is no adversary at all. The lifecycle transfers cleanly; the security-specific containment/eradication vocabulary does not, and `mitigation-playbook.md` uses operational lever names instead.

## Google SRE Book, chapters 14 and 15 — IMAG and blameless postmortems

**Source.** *Site Reliability Engineering: How Google Runs Production Systems*, ch. **14 "Managing Incidents"** and ch. **15 "Postmortem Culture: Learning from Failure"**.
**Edition.** **2016 print edition (O'Reilly)**, with a continuously updated web edition at `sre.google/sre-book`. Cite the chapter, and note the web edition when the wording you are relying on may have been revised.
**Publisher.** Google — a vendor practice book, not a standards body.
**Authoritative: no.** This is influential practitioner doctrine and it is cited as such. It is the most widely adopted description of software incident command in existence, which is a fact about adoption, not about normative status.

**Maps to the skill.** Chapter 14 is the source of **IMAG** — Incident Management at Google — the Incident Commander / Operations Lead / Communications Lead split that `incident-command.md` runs, together with the *declare early* principle in `SKILL.md` §1. Chapter 15 is the source of the blameless-postmortem culture rules in `postmortem.md`: systemic language, psychological safety as the mechanism that keeps timelines honest, and the postmortem as a learning artifact rather than a report card.

**Honesty requirement — there is no confirmed second edition, do not cite one.** A listing for *"Site Reliability Engineering, 2nd Edition"* carrying **ISBN 979-8-341607675** surfaces in search. It **could not be confirmed** against Google's own book listing at `sre.google/books`, and the `979-8` ISBN prefix is atypical for O'Reilly's Google SRE titles. **Cite the 2016 first edition and the web edition only.** If a genuine second edition is later confirmed through Google's or O'Reilly's own listing, update this entry and the citations in `incident-command.md` and `postmortem.md` in the same commit. Recording the non-confirmation here is deliberate: a fabricated edition number is exactly the kind of error that makes a whole standards shelf untrustworthy.

## ICS under NIMS — the origin of the role split

**Standard.** The **Incident Command System (ICS)**, the command-and-control component of the **National Incident Management System (NIMS)**.
**Edition.** **NIMS 3rd edition (2017 doctrine)**; the introductory course is **ICS-100, IS-0100.c, 2025 revision**.
**Publisher.** FEMA / U.S. Department of Homeland Security.
**Authoritative: yes** — published national doctrine with a formal course and certification path.

**Maps to the skill.** ICS is the **origin standard** that IMAG derives from, and `incident-command.md` cites it *first*, for the formal role definitions, before layering the software specialization on top. That ordering matters: the rule that **the Incident Commander holds every function not explicitly delegated** is an ICS rule, not a Google invention, and it is the single most load-bearing rule in this skill's role model. ICS's Command/Operations/Planning/Logistics/Finance structure is deliberately *not* reproduced wholesale — a software incident collapses it to IC plus Operations plus Communications, and `incident-command.md` says so rather than pretending the full structure applies.

## PagerDuty Incident Response Documentation — the worked example

**Source.** *PagerDuty Incident Response Documentation* — the open-sourced internal training material at `github.com/PagerDuty/incident-response-docs`, rendered at `response.pagerduty.com`.
**Edition.** **Continuously updated and unversioned.** Cite it as *"PagerDuty Incident Response Documentation, current"* **with a retrieval note** — the date you read it. **Never invent a version number for it.**
**Publisher.** PagerDuty, Inc. — vendor practitioner documentation.
**Authoritative: no.**

**Maps to the skill.** This is the concrete worked example layered under the ICS/SRE-book theory: severity-matrix shapes, per-role checklists, and status-update templates in `incident-command.md`. Treat it as a starting template to adapt to the org's own severity ladder, not as a definition of what a severity means.

## Amazon Correction of Error — the postmortem deliverable shape

**Source.** Amazon's **Correction of Error (CoE)** process.
**Edition.** **Unversioned internal practice.** It is described externally in Bryar & Carr, *Working Backwards* (2021), and in the **AWS Cloud Operations blog**; there is no published specification to pin.
**Publisher.** Amazon / AWS — vendor internal practice.
**Authoritative: no.**

**Maps to the skill.** CoE is the shape of `postmortem.md`'s deliverable: forward-looking corrective actions with owners, the **forced 5-whys that must terminate at a systemic or infrastructure cause** rather than at a person, and the explicit *has this recurred, and why did the last fix not hold* field. Where the SRE book supplies the culture rules, CoE supplies the document structure.

## ITIL — the formal incident-versus-problem boundary

**Standard.** **ITIL Incident Management** and **Problem Management** practice guides.
**Edition.** **ITIL 4 Foundation (2019)** is the edition this skill's boundary was drawn against. **ITIL (Version 5) Foundation published 12 February 2026**, and PeopleCert states that roughly **40% of ITIL 4 content is retained** — so the practice-guide *wording* below should be **re-verified against Version 5 material** rather than treated as settled.
**Publisher.** PeopleCert (formerly AXELOS) — licensed framework.
**Authoritative: yes**, with the live-transition caveat above attached to every citation.

**Maps to the skill — cited once, for one thing.** ITIL supplies the formal authority for why `loop-incident` and `loop-debug` are two skills rather than one: **incident management restores service now; problem management eliminates the underlying error.** That is exactly the line `SKILL.md` §4 draws when it hands off the reproduction and the timeline and stops short of naming a root cause. This file cites ITIL for that boundary and does **not** reproduce its practice guides — the operational content of this skill comes from the sources above, not from ITIL.

## OpenTelemetry — the timeline evidence layer

**Standard.** The **OpenTelemetry Specification** — traces, metrics, logs, and the **OTLP** wire protocol.
**Edition.** Core specification at **stable 1.x** — the identical pin `../../loop-debug/references/standards.md` already carries — plus **Semantic Conventions 1.43.0** for the attribute names this skill correlates on.
**Publisher.** CNCF.
**Authoritative: yes.**

**Maps to the skill.** `loop-debug` uses this pin for single-process evidence reading; this skill applies **the same pin at incident scale** — correlating traces, logs, and metrics *across services* by trace and request id in `reproduction-timeline.md`, which is what makes the merge barrier in `templates/incident-reconstruction.workflow.js` mechanically possible at all.

**Propagation obligation.** Because the pin is shared, it must move together. When `loop-debug`'s standards file advances its OpenTelemetry edition, this entry advances in the same commit, and vice versa. Two skills citing two different OTel editions while reading the same telemetry is a drift defect, not a difference of scope.

**Precondition, stated because the workflow depends on it.** Everything above assumes the target service is instrumented. `reproduction-timeline.md` carries the honest degradation path for when it is not; do not read a Semantic Conventions pin as a claim that the attributes exist in the system you are looking at.

## CVSS v4.0 — reused from `loop-review`, not reforked

**Standard.** **CVSS v4.0**.
**Edition.** **CVSS v4.0 (FIRST, November 2023).**
**Publisher.** FIRST.
**Authoritative: yes.**

**Maps to the skill — by pointer.** `incident-command.md`'s severity matrix uses CVSS bands as its **technical-impact axis**, and it gets them by pointing at **`../../loop-review/references/severity-model.md`**, which already carries the band table. The vector-string grammar lives in `../../loop-review/references/standards.md`. **Neither is reproduced here.** A second copy of a severity ladder is a second thing to keep current, and the two skills labelling the same defect differently is worse than either labelling it imperfectly.

What this skill *adds* rather than copies is a **non-CVSS operational/blast-radius axis** — percentage of users affected, SLA breach, data loss, revenue — because a production incident frequently has **no CWE at all**. A capacity exhaustion or a dependency outage is not a vulnerability, and scoring it on a vulnerability scale alone produces a severity that everyone in the channel disagrees with.

**Soft-coupling risk, stated explicitly.** This cross-reference is a real dependency with no shared home. **A future CVSS edition bump in `loop-review` must propagate here on the same cadence**, or the two skills' severity labels silently diverge — `loop-review` reporting a v5 band while an incident channel reports a v4 one, with no error anywhere to catch it. Whoever bumps `loop-review`'s severity model checks this file in the same commit.

## Edition discipline

A shelf that mixes editions, or that cites a retired one, reads as careless — and in an incident channel a careless citation gets the whole assessment discounted. Rules:

- **Cite the edition you mapped to**: "NIST SP 800-61 Rev. 3", "ICS-100 IS-0100.c (2025)", "CVSS v4.0", "SRE Book ch. 14 (2016)". Never a bare "NIST", "ICS", or "CVSS".
- **Carry the authority grade with the citation.** An authoritative-no source is attributed, never asserted as a requirement. This is the difference between a defensible incident record and an opinion with a logo on it.
- **Never invent a version for an unversioned source.** PagerDuty's docs and Amazon's CoE have none — cite them as *current* with a retrieval date. Never cite an unconfirmed *Site Reliability Engineering, 2nd Edition*; see the non-confirmation recorded above.
- **Three live transitions to watch**, each of which invalidates part of this file when it lands:
  1. **ITIL (Version 5)**, published 12 Feb 2026 — re-verify the incident/problem practice-guide wording against Version 5 material and update the entry above with what actually changed.
  2. **NIST SP 800-61 Rev. 3 freshness** — Rev. 3 is recent (April 2025) and its CSF 2.0 alignment will attract companion publications; re-check that Rev. 3 is still current and that no CSF profile supersedes the mapping used here.
  3. **The `loop-review` CVSS coupling** — re-check that `../../loop-review/references/severity-model.md` still pins CVSS v4.0 every time this file is reviewed. It is the one entry here that can go stale without anyone editing this file.
- **Re-check this shelf roughly twice a year**, and additionally after any real incident where a citation was contested. When an edition here goes stale, update the entry and this closing note together; a pinned version left behind is worse than no pin, because a reader will trust it.
