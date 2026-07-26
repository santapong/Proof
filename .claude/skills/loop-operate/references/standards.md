# Operations standards — the authoritative shelf

The sources behind this skill's define → instrument → alert → remediate → escalate loop. `slo-model.md` gets its vocabulary from the first two entries, `alerting.md` its taxonomy from the next three, `observability.md` its naming layer from OpenTelemetry, and `autonomy-and-rollback.md` its validation framing from the chaos manifesto. This file names each source, pins the edition to cite, **states plainly whether it is authoritative**, and maps it to the exact section where it earns its keep.

**Read the authority grade before you cite.** Every standards shelf in this plugin uses the same three grades, with the same meanings. This shelf is unusually lopsided and pretending otherwise would be dishonest: **most of reliability engineering's canon is practitioner doctrine, not specification.**

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it. Cite it as a normative reference: *"per OpenTelemetry Semantic Conventions v1.43.0"*, *"ISO/IEC 20000-1:2018 clause 8"*. Exactly two entries here qualify.
- **Authoritative — draft.** Real, citable working-group or committee output that **nothing has ratified**. Name it as a draft with its revision and status. *No entry on this shelf carries this grade.*
- **Authoritative — no.** An influential practitioner book, a personal essay, a community manifesto, a community project, or a vendor research programme. It is the best available description of a practice and it is **not** a specification. Cite it as attributed doctrine: *"following the SRE Workbook's multi-window multi-burn-rate design"*, never *"as required by"*. The four golden signals, RED, USE, and the burn-rate table are all in this category — universally adopted, and still someone's opinion with a good track record.

Every entry is pinned to the edition current **as of 2026**; the closing edition-discipline note carries the re-check cadence and names the shortest-cycle entry on the shelf.

## Site Reliability Engineering — the SLI/SLO/error-budget origin

**Source.** *Site Reliability Engineering: How Google Runs Production Systems*, eds. Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Richard Murphy.
**Edition.** **1st edition, 2016 (O'Reilly)**, with a continuously updated web edition at `sre.google/sre-book`. Cite the chapter; note the web edition when the wording you rely on may have been revised.
**Publisher.** O'Reilly / Google — a vendor practice book, not a standards body.
**Authoritative: no.** Influential practitioner doctrine, cited as such. Its near-universal adoption is a fact about the industry, not about normative status.

**Maps to the skill.** This is the origin of the SLI / SLO / error-budget vocabulary that `slo-model.md` §1–§3 is built on, and of the **four golden signals** (chapter 6, "Monitoring Distributed Systems") that open `alerting.md` §1. The error-budget-as-shared-currency framing — the thing that turns "how much can we break to move fast?" into arithmetic — is this book's contribution and is why `slo-model.md` §4 treats the policy rather than the number as the operative artifact.

**Edition watch — a second edition is confirmed and announced, but has not shipped.** O'Reilly's own catalogue carries *Site Reliability Engineering, **2nd Edition***, eds. **Betsy Beyer, Chris Jones, Christof Leng, David Huska, Jennifer Petoff, Niall Richard Murphy**, as an **Early Release** ebook — **ISBN 979-8-341607675** — with the print edition, **ISBN 979-8-341607682**, 771 pp., dated **3 November 2026**. Confirmed against O'Reilly's listing on **2026-07-26**. `sre.google/books` shows only the 2016 edition; that is expected for an unpublished book and is not evidence against the edition.

**Until it ships, cite the 2016 first edition and the web edition.** An Early Release is unpaginated and its chapter numbering is still moving, so a chapter citation against 2e may not survive to print. This edition watch is recorded identically in `../../loop-incident/references/standards.md`; when the print edition lands on 3 Nov 2026, both entries and every chapter citation they govern update in the same commit.

**RECORDED AND REJECTED — the `979-8` prefix argument.** An earlier draft of this shelf treated the `979-8` ISBN prefix as evidence the 2e listing was not genuine. That reasoning was **fabricated and is deleted**: `979-8` is simply the ISBN range Bowker has issued to United States publishers since 2020, as the `978` stock ran down. It carries no signal about a listing's authenticity. Recorded so nobody reinstates it from a stale note — inventing a heuristic to justify a non-confirmation is the same class of error as inventing an edition number.

## The Site Reliability Workbook — the implementation chapters

**Source.** *The Site Reliability Workbook: Practical Ways to Implement SRE*, eds. Betsy Beyer, Niall Richard Murphy, David K. Rensin, Kent Kawahara, Stephen Thorne.
**Edition.** **1st edition, 2018 (O'Reilly)**; web edition at `sre.google/workbook`.
**Publisher.** O'Reilly / Google.
**Authoritative: no.** Same grade and same reason as the SRE Book.

**Maps to the skill — this is the single most load-bearing source here.** Two chapters do the work:

- **"Implementing SLOs"** grounds `slo-model.md` §2's target-setting rules — set from what users need and from historical performance, keep the internal SLO stricter than the SLA, one SLO per critical user journey.
- **"Alerting on SLOs"** is the **direct source of the multi-window multi-burn-rate table** in `alerting.md` §4, including the specific burn-rate/window pairs (14.4 over 1h with a 5m short window, 6 over 6h, 1 over 3d) and the 1/12 short-window convention. That chapter builds the design through six successive iterations, each fixing a named failure of the previous one; when the table's constants need adapting to a different compliance window or a low-traffic service, **read the derivation rather than scaling the constants by intuition**.

## My Philosophy on Alerting — symptom, not cause

**Source.** *My Philosophy on Alerting*, Rob Ewaschuk — originally an internal Google document, public since roughly **2012**.
**Edition.** **No formal version.** Cite it by author and title with a retrieval note; never invent a version number for it.
**Publisher.** None — a personal essay by a Google SRE, and the acknowledged precursor the SRE Book itself cites.
**Authoritative: no.**

**Maps to the skill.** Two rules, both in `alerting.md`: **page on what users feel, not on causes** (§3, with the red/green worked examples), and the paging bar — a page must be **actionable, urgent, and real** (§5). `on-call-triage.md` inherits the second one as its demotion test. This essay is the reason cause-based alerts appear in this skill only as dashboard panels and runbook steps.

## The RED Method and The USE Method — the two working taxonomies

**Sources.** *The RED Method* (Rate, Errors, Duration) — **Tom Wilkie**, introduced **2015** (Prometheus London meetup, Weaveworks; the canonical write-up is now hosted by **Grafana Labs**). *The USE Method* (Utilization, Saturation, Errors) — **Brendan Gregg**, published **2012**, maintained as a reference page.
**Edition.** **Neither has a formal version.** Cite by author, name, and year of introduction.
**Authoritative: no** — both are practitioner methods, and both are excellent.

**Maps to the skill.** `alerting.md` §2's side-by-side table and its selection rule: **RED for the SLO, USE for the diagnosis.** RED's unit of analysis is the request, so it produces the SLIs that page; USE's unit is the resource, so it produces the signals a runbook's success check and an operator's diagnosis read. Neither covers pipelines, and `alerting.md` says so rather than forcing one on them.

## OpenTelemetry Semantic Conventions — the telemetry naming layer

**Standard.** **Semantic Conventions for OpenTelemetry** — the attribute, metric, and resource naming specification.
**Edition.** **v1.43.0 (3 July 2026)** for the stable main specification, semver-governed. Confirmed against `opentelemetry.io/docs/specs/semconv` on **2026-07-26**; it supersedes v1.42.0 (12 June 2026).
**Publisher.** OpenTelemetry (CNCF).
**Authoritative: yes** — a published, versioned specification under formal governance. The only entry on this shelf that is a specification in the strict sense alongside ISO/IEC 20000-1.

**Maps to the skill.** `observability.md` §4 makes OTel the default instrumentation choice and pins these conventions as the naming layer that the runbook and rollback templates emit telemetry under, so this skill's health signals compose with whatever OTel-native backend the operator runs instead of inventing a private scheme. W3C Trace Context propagation is what makes `observability.md` §3's single-correlation-ID requirement work across service boundaries at all.

**Three caveats, all of which change how you cite it:**

1. **Confirm the exact minor before citing.** Semantic Conventions releases land at a **near-monthly cadence**. The pin above was confirmed on 2026-07-26 and will not be current for long — treat it as a starting point for verification, not as a durable fact.
2. **The GenAI conventions split into their own repository.** If you are instrumenting an LLM-backed service, the attributes are no longer in the main convention set.
3. **Propagation obligation — three skills pin this spec.** `../../loop-incident/references/standards.md` for cross-service timeline correlation, `../../loop-debug/references/standards.md` for single-process evidence reading, and this file for `observability.md`'s naming layer. **When any of the three advances its pin, the other two advance in the same commit — and so does `observability.md`, which restates the pin at the point of use.** Two skills reading the same telemetry while citing two different convention versions is a drift defect, not a difference of scope. Do not assert here what the other files currently record — read them. A claim about a sibling file's contents is false the moment that file is edited, which is how a 1.42/1.43 gap opened between this shelf and the very file it delegates to.

**A pinned convention is not a claim that the attributes exist in your system.** It says what to emit. `observability.md` §5 is the checklist that tells you what actually is emitted.

## Principles of Chaos Engineering — the steady-state hypothesis

**Source.** *Principles of Chaos Engineering*, the community manifesto at `principlesofchaos.org`, originated at Netflix.
**Edition.** **No formal version**; cite the current text with a retrieval note.
**Publisher.** The chaos-engineering community — a manifesto, not a standards body.
**Authoritative: no.**

**Maps to the skill.** `autonomy-and-rollback.md` §2 borrows its experimental framing for the **chaos-drill oracle** at the SUSTAIN rung: define a **steady-state hypothesis in terms of the SLI** (an external, user-visible measure, explicitly not internal attributes), introduce a real-world event, compare control and experimental behaviour, and treat a difference as the finding. That framing is the only mechanism in this skill that produces a **measured** rather than assumed runbook-trust number, which is exactly why the honest-status section can say what it does not know: without a live service and a drill programme, the trust numbers are defaults, not measurements.

## ISO/IEC 20000-1 — the service-management process backdrop

**Standard.** **ISO/IEC 20000-1**, *Information technology — Service management — Part 1: Service management system requirements*.
**Edition.** **2018 (3rd edition)**, plus **Amendment 1:2024**. Confirmed current on 2026-07-26 — ISO reviewed and confirmed the 2018 edition in 2023 and has published no 4th edition.
**Publisher.** ISO/IEC.
**Authoritative: yes** — a certifiable international management-system standard.

**Maps to the skill — as a process frame, not a per-alert tag.** This plays the same role here that **NIST SSDF** plays in `../../loop-review/references/standards.md`: you do not tag an individual alert or runbook with a clause, you invoke it when the gap is **organizational** and the reader needs a recognized control to point remediation at. Three places it applies:

- **Service level management** is the formal home of the error-budget policy in `slo-model.md` §4 — the requirement that service targets be agreed, documented, monitored, and reviewed with the parties who depend on them, which is what turns a waiver into a recorded decision rather than an argument.
- **Incident and service-request management** is where the `on-call-triage.md` → `loop-incident` handoff and the on-call maturity implied by `alerting.md` §5 sit; the standard's insistence on documented, agreed procedures is the formal backing for "a page must have a runbook."
- **Change management and the service-management system's continual-improvement obligation** back the SUSTAIN rung's drift reviews.

Use it when an organization needs the practice framed as a certifiable management system. Do not use it to derive a burn-rate threshold; it says nothing about one.

## Implementing Service Level Objectives — the practitioner depth

**Source.** *Implementing Service Level Objectives: A Practical Guide to SLIs, SLOs, and Error Budgets*, Alex Hidalgo.
**Edition.** **1st edition, 2020 (O'Reilly)**.
**Publisher.** O'Reilly — a single-author practitioner book.
**Authoritative: no.**

**Maps to the skill.** Supplements `slo-model.md` where the SRE Book and Workbook only sketch: **error-budget policy templates** and their stakeholder sign-off structure, choosing targets for services whose users are other services, dependency-inherited budgets (what to do when a shared dependency spends your budget for you), and the reliability-stack framing that keeps an SLO from becoming a vanity metric. Cite it for policy shape; cite the Workbook for alert math.

## DORA — the Four Keys, reused not re-derived

**Source.** **DORA** (DevOps Research and Assessment), now part of Google Cloud; published annually as the **State of DevOps Report**.
**Edition.** The **current annual report** is the moving edition; the Four Keys are the stable metric set beneath it. **The 2024 report renamed "Time to Restore Service" (MTTR) to *Failed Deployment Recovery Time*.** When quoting a benchmark or a cluster threshold, cite the specific annual report you pulled it from — the boundaries move year to year.
**Publisher.** DORA / Google Cloud — a research programme, not a standards body.
**Authoritative: no.**

**Maps to the skill — by pointer.** `../../loop-autopilot/references/standards.md` already carries the full Four Keys table and `../../loop-ship/references/dora.md` owns per-release instrumentation; **neither is reproduced here.** The single thing this skill adds is the connection worth naming: **Failed Deployment Recovery Time is exactly the metric the SCALE-rung automatic rollback in `autonomy-and-rollback.md` §3 exists to minimize.** An autonomous revert that fires in ninety seconds instead of a page that wakes someone in fifteen minutes is a change to that one number and to no other. If you are justifying SCALE to anyone, that is the metric to justify it in, and the honest-status section is the caveat that goes with it.

## Edition discipline

A shelf that mixes editions, or that cites a retired one, reads as careless — and an ops recommendation that cites carelessly gets discounted along with the threshold it was defending. Rules:

- **Cite the edition you mapped to**: "SRE Workbook (2018), *Alerting on SLOs*", "OpenTelemetry Semantic Conventions v1.43.0", "ISO/IEC 20000-1:2018". Never a bare "SRE book" or "OTel".
- **Carry the authority grade with the citation.** Most of this shelf is doctrine, and doctrine is attributed, never asserted as a requirement. "The Workbook's burn-rate table" is defensible; "the standard burn-rate thresholds" is not — there is no such standard.
- **Never invent a version for an unversioned source.** Ewaschuk's essay, RED, USE, and the chaos manifesto have none. Cite them as current with a retrieval date. **Do not cite *Site Reliability Engineering, 2nd Edition* for a page or chapter number until it ships on 3 Nov 2026** — see the edition watch recorded above.
- **OpenTelemetry Semantic Conventions is the shortest-cycle entry on this shelf** and the one most likely to be stale when you read it. Its near-monthly cadence means the pin above should be treated as a *starting point for verification*, not as a fact — and its three-way coupling with `loop-incident` and `loop-debug` means a bump is never a single-file edit.
- **ISO/IEC 20000-1:2018 (3rd edition) confirmed current on 2026-07-26** — reviewed and confirmed by ISO in 2023, with **Amendment 1:2024** (Feb 2024) layered on top rather than a 4th edition. Cite the amendment explicitly if you are relying on text it changed.
- **Re-check this shelf roughly twice a year**, and additionally after any real incident where a citation was contested or a threshold was disputed. When an edition here goes stale, update the entry and this closing note together; a pinned version left behind is worse than no pin, because a reader will trust it.

**Confirmation log — 2026-07-26.** Verified against the primary source: ***Site Reliability Engineering, 2nd Edition*** as a **real, announced O'Reilly title** — Early Release ebook **ISBN 979-8-341607675**, print **ISBN 979-8-341607682**, 771 pp., **3 Nov 2026**, editors Beyer/Jones/Leng/Huska/Petoff/Murphy (this pass replaced a fabricated non-confirmation and **deleted the invented `979-8`-prefix heuristic** — see the rejected-argument note above); **OpenTelemetry Semantic Conventions v1.43.0 (3 Jul 2026)**, which **corrected this file's stale v1.42.0 pin that had been asserted as current in the same paragraph that recorded a newer one elsewhere**, and which now matches `loop-incident` and `loop-debug`; and **ISO/IEC 20000-1:2018 (3rd ed.) + Amendment 1:2024** as current with no 4th edition. **Not independently re-confirmed in this pass, and deliberately left unpinned rather than given invented precision:** **Ewaschuk's alerting essay**, the **RED** and **USE** methods, the **Principles of Chaos Engineering** manifesto, and the **current DORA annual report** — none has a version to confirm, so the honest pin is the name, the originator, and the date you read it. The **SRE Book (2016)**, the **SRE Workbook (2018)** and **Hidalgo (2020)** are fixed bibliographic facts. **If you cannot confirm an edition, write "unconfirmed as of \<date\>" rather than asserting one** — this shelf shipped both failure modes at once, a stale pin called current and a non-confirmation stated as a fact, and they are the same error wearing different clothes.
