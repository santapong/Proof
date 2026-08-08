# P1 — Discovery playbook

The deliverable is `venture/01-discovery.md`: evidenced personas and a ranked pain list,
each pain something specific people demonstrably have, not something the idea needs them
to have. The node runs the standard five-step loop (`lifecycle.md` §3); this file
supplies its questions, cast, evidence bar, and document skeleton. Evidence discipline is
`loop-research`'s law throughout: cited, graded, adversarially checked.

## 1. The questions the plan step scopes

- **Who hurts?** Candidate personas from the brief — then widened: who else has this job?
  A persona is a *context + job*, not a demographic ("solo consultant invoicing monthly",
  never "millennials").
- **What do they do about it today?** The current workaround IS the competitor and prices
  the pain: what it costs them in time/money/risk is the ceiling of what a solution is
  worth. A pain with no workaround is usually a pain nobody feels.
- **How do we know?** Every pain needs `evidence[]` — forum threads, reviews of adjacent
  tools, job postings, pricing pages of the workaround, public complaints. Jobs-to-be-done
  is the interview frame the researchers apply to found evidence: what job was the person
  hiring a workaround to do?

## 2. Research mandates (disjoint by construction)

All-out casts five researchers, one mandate each — the mandates are the anti-research-
theater device, so keep them disjoint even at smaller widths (balanced: pick three):

1. **Complaint mining** — forums, reviews, issue trackers where the pain is stated
   unprompted, in the sufferer's words.
2. **Workaround pricing** — what the current alternatives (including spreadsheets and
   interns) cost; the substitute economy around the pain.
3. **Adjacent-tool autopsy** — reviews and churn complaints of tools near the space:
   what do their users say is missing or broken?
4. **Demand signals** — search/interest proxies, job postings that name the task,
   community size around the topic.
5. **Disconfirming sweep** — evidence the pain is already solved, shrinking, or tolerated;
   this mandate exists to lose gracefully and MUST be filled before any other at width ≥ 2.

## 3. Discuss cast

- **The sufferer** — argues from inside the persona: is this how the pain actually feels,
  and would I bother switching?
- **The anthropologist** — argues from the evidence only: which claimed pains have
  observational support and which are the founder's projection?
- **The economist** — argues willingness-to-pay: severity is what people *do* (spend,
  switch, hack around), not what they *say*.

## 4. Severity ranking and the state slice

Severity per pain = frequency × cost-of-workaround × evidence grade, argued not computed —
but each factor must be stated. The slice writes `personas[]`, `pains[]` (schema in
`state-contract.md`), and every willingness-to-pay guess into `assumptions[]` with an
owner. The document skeleton: personas → per-pain sections (statement, evidence, current
workaround and its cost, severity argument) → ranked table → the assumption ledger →
what GATE-1 is being asked.

## 5. Discovery failures — the catalogue

| Failure — drawback first | Signal | Intervention |
|---|---|---|
| **Solution in search of a problem.** The brief's idea silently becomes the search query, and discovery only finds pains the idea already answers. | Every ranked pain maps 1:1 onto a feature of the brief; the disconfirming mandate returned thin or was skipped. | Re-run research with the idea redacted from the prompts — mandates get the persona and job, not the solution. |
| **Persona fiction.** Personas invented at the plan step survive to the document without ever being evidenced — a demographic with a name is not a persona. | `personas[]` entries whose `jobs[]` cite no `evidence[]`; the sufferer panelist argues from stereotype, not quotes. | Kill any persona with zero unprompted-complaint evidence; a persona the complaint-mining mandate cannot find does not exist yet. |
| **Survivorship evidence.** Evidence gathered only from people loud in public channels — the enthusiasts — while the silent majority tolerates or churns invisibly. | All evidence traces to the same two communities; adjacent-tool autopsy and demand-signal mandates disagree with complaint mining. | Weight the disagreement into the severity argument explicitly; downgrade severity where only enthusiasts complain. |
| **Severity by volume.** Ranking pains by how much evidence was found rather than by cost — a cheap, frequent annoyance out-ranking a rare, expensive disaster because it googles better. | The ranked table's order tracks `evidence[].length`, not the stated frequency × cost argument. | Re-argue the ranking with the economist lens; evidence grade gates *confidence in* a rank, never the rank itself. |
