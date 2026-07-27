# Authoritative standards — the frameworks this skill leans on

The named, external references behind the house rules in the other files. When a design decision needs an authority to cite — in an ADR, a review, or a quality gate — pull it from here rather than from memory, and cite the **edition**. This skill's opinions (monolith-first, per-domain consistency, cache-aside) are house style; the standards below are the industry baselines those opinions are calibrated against. Each entry: the framework, its issuing body, the edition current as of 2026, and how it lands in this skill's workflow.

## Authority grades (read first)

Every standards shelf in this plugin uses the same three grades, with the same meanings. Carry the grade with the citation.

- **Authoritative — yes.** A recognized standards body, government agency, or licensed framework owner **ratified and published** it. Cite as a normative reference. On this shelf: **ISO/IEC 25010:2023**, the **TOGAF Standard**, **OpenAPI**, and **AsyncAPI**.
- **Authoritative — draft.** Real, citable working-group or committee output that **nothing has ratified**. Name it as a draft with its revision and status. *No entry on this shelf carries this grade* — OpenAPI 4.0 "Moonwalk" would, if it existed yet, and it does not.
- **Authoritative — no.** A book, a named theorem, a house style, a vendor framework, or a community template. Influential, and not a specification — cite as attributed doctrine, never *"as required by"*. On this shelf: **arc42**, **C4**, the **Google SRE books**, **CAP/PACELC**, **DDD/CQRS/event sourcing**, and the **AWS Well-Architected Framework**.

A design decision may rest on an *authoritative: no* source, but the decision's justification has to be a stated cost or requirement, not the citation. "CAP says so" is not an argument; "money must not go stale, so this domain sits in CAP's C column and pays the latency" is.

## Edition discipline (read second)

Standards get revised, and a mapping keyed to a stale edition quietly rots. Rules:

- **Cite the edition, always** — "ISO/IEC 25010:2023," not "ISO 25010." A characteristic count or a pillar name that shifted between editions makes a design doc look sloppy and breaks cross-review consistency.
- **Map to one edition per artifact.** Don't mix the ISO 25010:2011 eight-characteristic model with the 2023 nine-characteristic one inside a single NFR table (see the note under ISO/IEC 25010).
- **Re-check on a cadence** — roughly annually, and whenever an ADR cites a spec as load-bearing. Future TOGAF/AWS revisions are moving targets; the pins below were verified against their primary sources on **2026-07-26**, and the confirmation log at the end of this file records what was and was not confirmed.

## arc42 + TOGAF — architecture description and EA method

| Standard | Body | Edition (2026) | Role in this skill |
|---|---|---|---|
| **arc42** | arc42 (Starke/Hruschka), open | **v9 (current)** — v8 was Feb 2022; v9 is what `arc42.org/download` ships as of 2026-07-26. Section numbering is stable across the two, so a v8-keyed mapping still lands, but cite v9 | Documentation **template** for step 8: 12 sections (context, constraints, solution strategy, building blocks, runtime, deployment, crosscutting, decisions, quality, risks). |
| **TOGAF Standard** | The Open Group | **10th Edition (2022)**, with **Technical Corrigendum 1 applied May 2025**. Confirmed current 2026-07-26 — no 11th edition | Enterprise-architecture **method** (the ADM) — the wider governance frame when a design spans an org, not one system. |
| **C4 model** | Simon Brown | living (unversioned) — cite it as current with a retrieval date, never invent a version | The **diagram** notation, already used in `templates/c4-context.md` / `c4-container.md`. |

**How they compose.** C4 gives the pictures; **arc42 gives the prose around them** — drop your C4 Context and Container diagrams into arc42 sections 3 and 5, and your ADRs into section 9. arc42 is the complementary template the C4 templates slot into. Reach for **TOGAF's ADM** only at enterprise scale (multiple systems, capability planning); for a single-system design it is heavier than the step-8 artifacts this skill emits. Cross-ref: `architecture-patterns.md` (style selection feeds arc42 §4 "solution strategy").

## ISO/IEC 25010 — the software product quality model

The **issuing body is ISO/IEC** (JTC 1/SC 7), under the **SQuaRE** family (ISO/IEC 2501n). It is the canonical taxonomy of *non-functional* quality — the vocabulary `nfr.md` operates in.

**Edition discipline here matters.** The widely-cited **2011** edition defined **8** product-quality characteristics. The current **ISO/IEC 25010:2023** revision reorganized to **9**: it added **Safety** (with subcharacteristics operational constraint, risk identification, fail safe, hazard warning, safe integration), renamed *Usability → Interaction Capability* and *Portability → Flexibility*, and kept the rest. **Nine characteristics and those three changes confirmed against the ISO catalogue entry on 2026-07-26.** Map to **:2023** and note it; if a stakeholder's checklist still uses the 2011 eight, translate rather than mix.

| ISO/IEC 25010:2023 characteristic | Where it lives in `nfr.md` |
|---|---|
| **Performance Efficiency** | Latency SLIs, scalability, capacity — the "numbers" intake |
| **Reliability** | Availability math (nines), RTO/RPO, SLOs & error budgets |
| **Security** | Threat-modeled via the **loop-review** skill (not asserted) |
| **Maintainability** | Modularity, ADRs, build-vs-buy, operational surface |
| **Compatibility** | Interop / co-existence — API & event contracts (below) |
| **Interaction Capability** (was Usability) | Frontend UX — `frontend.md`, Core Web Vitals |
| **Flexibility** (was Portability) | Adaptability, install/replace — lock-in and the coarse delivery shape (`deployment.md`). **IaC / immutable infrastructure moved out of this skill in v1.0.0** — it lives in `../../loop-ship/references/rollout-strategies.md` |
| **Functional Suitability** | Does it meet the brief — the requirements intake gate |
| **Safety** (new in :2023) | Fail-safe / hazard limits — only for safety-relevant systems |

Use it as the **checklist axis** in step 7: for each characteristic that matters to the brief, name a number and a mechanism. It complements, not replaces, the AWS pillars below — 25010 is the vocabulary, Well-Architected is the review lens.

## Google SRE — SLI/SLO/error-budget rigor

Two books from **Google (O'Reilly)**: *Site Reliability Engineering* (**1st edition, 2016** — "the SRE book") and *The Site Reliability Workbook* (2018, the applied companion). **Authoritative: no** — practitioner doctrine, cited as such. A **2nd edition of the SRE book is announced for 3 November 2026**; until it ships, cite the 2016 edition. `../../loop-operate/references/standards.md` carries the full edition watch, and this entry moves with it.

**This entry maps to what `nfr.md` actually retains, which is the design-time half only.** The v1.0.0 migration moved the measurement half of the SLO apparatus into `loop-operate`, so cite these books here for exactly four things: **defining an SLI** as `good / valid events`, measured where the user feels it; **defining an SLO and an SLA** and keeping the internal SLO **stricter than the SLA**; setting the target **from what users need and below 100%**, never at 100%; and the **error budget** as the shared currency that turns "how much can we break to move fast?" into arithmetic. All four are answerable before launch with no telemetry in hand, which is the seam.

**Everything downstream of a live metric belongs to `loop-operate`, and this file does not restate it.** The burn-rate constants, the multi-window multi-burn-rate table, and the *symptom, not cause* rule live in **`../../loop-operate/references/alerting.md` §3–§4**, with the SLO model itself in **`../../loop-operate/references/slo-model.md`**. Point there rather than reproducing them — a second copy of the burn-rate table is a second thing to keep current. When a design's reliability *target* is contested, cite the Workbook's "Implementing SLOs" chapter; when the argument is about *alerting on* that target, it is not a design-time argument.

## CAP + PACELC — the consistency trade-off theorems

Not committee standards but the **named theorems** the per-domain consistency policy in `backend.md` rests on — cite them so a trade-off reads as principled, not arbitrary.

| Theorem | Origin | What it forces |
|---|---|---|
| **CAP** | Brewer (2000), proved by Gilbert & Lynch (MIT, 2002) | Under a network **P**artition, choose **C**onsistency *or* **A**vailability — never both. |
| **PACELC** | Daniel Abadi (2010) | Completes CAP: **P**→**A**/**C**; **E**lse (no partition) → **L**atency/**C**onsistency. Even healthy, strong consistency costs latency. |

Use them to **classify each store and each domain**: Postgres synchronous replication is **PC/EC** (favors consistency, pays latency); a Dynamo-style store is **PA/EL**. Money/inventory/auth → the C columns; feeds/counts/search → the A/L columns. If you can't say how stale a read may be, the domain isn't designed. See `backend.md` "CAP and PACELC."

## OpenAPI + AsyncAPI — the contract standards

The machine-readable contract formats that make `api-design.md`'s "design the contract first" concrete. Both live under the **Linux Foundation**.

| Standard | Body | Edition (2026) | Covers |
|---|---|---|---|
| **OpenAPI Specification** | OpenAPI Initiative | **3.2.0** (19 Sep 2025) is the current feature release. **3.1.x** (3.1 aligns with JSON Schema) remains the widely-published baseline — most existing specs and most tooling are still on it | Synchronous **request/response** APIs — REST/HTTP contracts. |
| **AsyncAPI Specification** | AsyncAPI Initiative | **3.1.0** (31 Jan 2026) is the current minor, with no breaking changes from **3.0.0** (Nov 2023), which remains the widely-published baseline | **Event-driven / message** contracts — Kafka, MQ, WebSocket channels. |

**Which one do you author against?** Design a *new* contract against the current release — **OpenAPI 3.2.0** (hierarchical tags, first-class streaming, custom HTTP methods; a zero-breaking migration from 3.1) or **AsyncAPI 3.1.0**. Stay on the 3.1.x / 3.0.0 baseline when the toolchain the team already runs has not caught up, and record that as a stated constraint rather than leaving the version unexplained.

**Edition watch:** OpenAPI **4.0 ("Project Moonwalk")** is in development and **has not shipped** — re-confirmed 2026-07-26, there is no 4.0 release. Do not present 3.2.0 as an interim toward something you can already use.

**Cross-reference — the design-time and consumer-time pins move together.** `../../loop-integrate/references/standards.md` carries the same two specs from the *consumer* side, where the rule is the opposite of this one: never upgrade a **provider's** published spec version on paper. This file says author against the current release; that file says validate against whatever the provider actually publishes. Both are right, and they must not drift to different version numbers.

**Map by interaction shape:** the synchronous API from step 4 gets an **OpenAPI** doc; the events and queues from `backend.md` (outbox, broker, event-driven style) get an **AsyncAPI** doc. Contract-first means the spec is the source of truth (codegen, mock, validate from it), and its versioning obeys the same additive-change discipline `api-design.md` prescribes.

## DDD, CQRS, and event-driven/event-sourcing patterns

Established **named patterns**, not standards bodies — cite the canonical sources so the vocabulary is unambiguous.

- **Domain-Driven Design (DDD)** — Eric Evans, *Domain-Driven Design* (2003); *bounded context*, *aggregate*, *ubiquitous language*. In this skill, the **bounded context is the unit of a service** (`architecture-patterns.md`) and the aggregate is the transaction/consistency boundary (`backend.md`).
- **CQRS** — Greg Young / Udi Dahan. Split the write model from the read model; see `backend.md` "CQRS." Reach for it only when one model genuinely can't serve both sides.
- **Event Sourcing** — persist the event log as the source of truth, derive state by replay. Pairs with CQRS and the **outbox**; justified for ledgers/audit where a replayable history is a requirement, not by default (see the event-driven failure modes in `architecture-patterns.md`).

These are the patterns behind steps 2–3; treat them as tools with a cost, invoked against a named requirement — the same premature-complexity discipline the skill applies everywhere.

## AWS Well-Architected Framework + Lenses

**Issuing body: AWS**; continuously updated (no fixed edition — cite the year you reviewed it). The **six pillars** — Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, **Sustainability** (added 2021) — are the review lens already indexed in `nfr.md`.

Beyond the pillars, the framework ships **Lenses** — pillar questions re-specialized for a workload class. Apply the lens that matches the system under design instead of the generic pillars alone:

| Lens | Use when designing… |
|---|---|
| **Serverless** | Lambda/functions-first architectures |
| **SaaS** | multi-tenant products (tenant isolation, per-tenant cost) |
| **Data Analytics** | pipelines, lakes, warehouses |
| **Machine Learning** | training/inference systems |
| **IoT / Financial Services / others** | domain-specific compliance and scale |

The pillars are cloud- and vendor-neutral in spirit — read "AWS" as "your platform." Run the design past the pillar questions in step 7, and pull the matching lens for the workload-specific ones; the point is to let a pillar's question *change the design*, per `nfr.md`'s warning against treating it as a compliance ritual.

## Re-check cadence and confirmation log

Re-verify these pins annually and whenever an ADR cites one as load-bearing. Live edition risks to watch: **OpenAPI 4.0** (Moonwalk, still unreleased), the next **ISO/IEC 25010** and **TOGAF** revisions, rolling **AWS Well-Architected** updates, and the **SRE book 2nd edition** due 3 Nov 2026. Update the table, re-map the affected cross-reference, and never mix editions inside one design doc.

**Confirmed against the primary source on 2026-07-26:** ISO/IEC 25010:2023 (nine characteristics; Safety added; Usability→Interaction Capability; Portability→Flexibility), TOGAF 10th Edition 2022 + Technical Corrigendum 1 (May 2025), arc42 **v9** (this pin was corrected from a stale v8), OpenAPI **3.2.0**, AsyncAPI **3.1.0**, and the absence of any OpenAPI 4.0 release.

**Not independently re-confirmed in this pass, and flagged rather than asserted:** the AWS Well-Architected pillar set is cited here as "six pillars, Sustainability added 2021" — AWS revises this continuously with no dated edition, so **read the current pillar page before quoting a pillar list**, exactly as the entry says. The CAP/PACELC/DDD/CQRS attributions are fixed historical citations (Brewer 2000, Gilbert & Lynch 2002, Abadi 2010, Evans 2003) and do not age.
