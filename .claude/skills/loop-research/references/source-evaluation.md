# Source Evaluation & Citations

How to judge whether a source can be trusted, what to do when sources conflict, and how to cite so a reader can verify any claim. Used during Step 2 (triage) and Step 3 (verification) of the methodology.

## Credibility checklist

Judge each source before trusting its claims:

- **Authority** — who published it, and are they in a position to know? Primary actor, domain expert, and peer-reviewed venue rank above anonymous blog and content farm. Check the author and the outlet, not just the headline.
- **Primary vs secondary** — a primary source *is* the evidence (the paper, the dataset, the spec, the filing, the original announcement). A secondary source *describes* it and can distort. Prefer primary; when using secondary, trace back to the primary before treating a claim as verified.
- **Recency** — is it current for a fast-moving topic? Stamp every claim with an as-of date. A correct-in-2021 fact can be wrong now.
- **Independence & corroboration** — two outlets repeating the same wire story are one source. Look for genuinely independent confirmation. Beware circular citation, where A cites B cites A.
- **Bias & incentives** — vendor pages, marketing, and advocacy have an axis to grind. Usable for the vendor's own claims about itself, weak for comparative or critical claims. Note the incentive.
- **Methodology (for data)** — for a benchmark, study, or survey: sample size, method, who funded it, and whether it's reproducible. A number without a method is an assertion.

Drop these outright: content-farm / SEO spam, undated pages on time-sensitive topics, AI-generated slop with no sourcing, and sources whose claims you cannot trace to anything primary.

## Handling contradictory sources

When credible sources disagree, do **not** silently pick one:

1. Check whether the disagreement is real or an artifact of date, definition, or scope (they may be answering slightly different questions).
2. Weight by the checklist above — primary and more-recent evidence outranks secondary and older.
3. If it remains genuinely contested, report it as contested: state each position, who holds it, and the evidence, and let the reader see the split. Contested-but-reported beats falsely-resolved.

## Source-failure catalogue

The checklist above rates a source in isolation. These seven patterns beat a checklist read because each one *looks* sourced — the failure is in what the packaging hides, and the fix is always a check you run by leaving the page (the Trace and lateral-reading moves in `standards.md`; this catalogue is what you are tracing *for*). The cost of skipping these checks is not one wrong sentence but a wrong report: a single laundered claim, cited confidently, poisons every conclusion that leans on it — and the reader cannot see which ones do.

| Failure | Why it passes a quick read | The check that kills it |
|---|---|---|
| **Citation-laundering chain** — blog cites blog cites a tweet that cites nothing | Volume reads as consensus: many pages, consistent wording, each with a citation | Follow every chain to its terminus and count **origins, not repetitions** — the corroboration rule (`methodology.md` Step 3) applied down the whole chain, not just one hop. A chain ending at a tweet, or at nothing, ends the claim with it |
| **Misattributed number** — a figure circulating attached to a paper that does not contain it | It carries a citation to a real paper, so it looks sourced; nobody opens the paper | Open the cited primary and find the figure *in it*. **Trace-to-primary-or-drop**: if the paper does not contain the number, the number has no source — drop it, however many pages cite it |
| **Vendor benchmark as marketing** — self-published comparative numbers | Charts, tables, and a methodology page look like measurement | Ask who ran it, who wins, and whether an uninterested party reproduced it. Self-published comparative numbers are **claims by an interested party, never measurements** — the checklist's bias bullet, applied to benchmarks without exception |
| **Laundered press release (churnalism)** — coverage that adds no verification | A reputable outlet's byline reads as independent confirmation | Diff the article against the press release. If every fact is in the release and none was independently checked, it is **the release wearing a byline** — count it once, as the vendor |
| **Selection bias in roundups** — "state of X" posts, top-N lists | Breadth mimics a survey: many entries, confident ranking | Demand the inclusion rule. **What got excluded decides the conclusion**; a roundup with no stated selection method is curation presented as measurement |
| **Recency-authority confusion** — newest treated as truest | Fresh dates and saturated coverage read as the current state of knowledge | A weeks-old term with heavy SEO and no primary evidence is a signal **against**, not for. Check what predates the wave and whether a primary source exists at all |
| **Confident preprint** — unreviewed, uncorroborated, cited as settled | Paper formatting, precise numbers, and assertive prose read as established science | Check review status and independent corroboration. Unreviewed plus uncorroborated is **one unverified claim in academic dress** — cite as a preprint with a date, never as settled |

Two of these fall to one rule: laundering chains and misattributed numbers both die the moment you hold the primary and read it — nothing is verified until then. The confident preprint is the counter-case: there you *are* holding the primary, and it is still one unverified claim — holding the primary is necessary, never sufficient. The vendor benchmark and the laundered release fall to the incentive question the checklist already asks; the catalogue's addition is that **packaging does not launder the incentive away** — a chart is still the vendor talking, a byline is still the vendor talking.

## Recording degraded claims

A claim that fails a kill check but is load-bearing gets neither silently upgraded nor silently dropped — it is carried **in degraded form, labeled**, so the reader can weigh it and a later pass knows exactly what would upgrade it. The discipline is **unverified-as-of-date**: write what you checked, what you found, and when.

| Surviving form | What to write down |
|---|---|
| Many repeaters, one traceable origin | "Single-origin claim (traced N repetitions to one source: \<origin\>); no independent corroboration as of \<date\>" |
| Figure absent from its cited primary | Drop the figure and record the negative: "a figure circulates attributed to \<primary\>; \<primary\> does not contain it (checked \<date\>)" — this stops the next researcher re-laundering it |
| Vendor-only numbers | "Vendor-reported; no independent measurement found as of \<date\>" — attribute, never assert |
| Coverage that adds no verification | Cite the press release directly, dated; do not also cite the coverage — that double-counts one source |
| Preprint only | "Preprint, unreviewed; no independent replication found as of \<date\>" |
| Claim younger than the evidence it needs | "Emerging as of \<date\>; primary evidence not yet located" — an open question for the completeness critic (`methodology.md` Step 5), not a finding |

This is the same discipline `standards.md` applies to its own edition pins ("current edition, unconfirmed as of \<date\>"): a stated non-confirmation is a usable research finding. A confident repetition makes your report the next link in someone else's laundering chain.

## Citation format

Cite so any claim can be checked:

- Inline: a short attribution plus a link — `(Source Title, publisher, 2026-03 — URL)`.
- Keep a source list mapping each citation to its URL and access date.
- Attribute opinions and predictions to their holder ("X argues…", "Y projects…"), never as bare fact.
- Quote sparingly and exactly when wording matters; otherwise paraphrase and cite.

The test: a reader should be able to click through from any claim in the report to the source that supports it, and find the claim actually supported there.
