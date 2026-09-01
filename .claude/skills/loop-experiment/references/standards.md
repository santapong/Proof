# Standards shelf

The authorities this skill reasons from, graded on the plugin's three levels. **The grade is about provenance of authority, not quality** — a "No" row can be better guidance than a "Yes" row and still be somebody's opinion.

| Grade | Meaning |
|---|---|
| **Yes** | A standards body ratified and published it |
| **Draft** | Real working-group output that nothing has ratified |
| **No** | Real, widely followed, still somebody's opinion |

## The shelf

| Authority | Pin | Grade | What this skill takes from it |
|---|---|---|---|
| **ACM Artifact Review and Badging** | Version 1.1, 20 August 2020 | **Yes** | The vocabulary separating *repeatability* (same team, same setup), *reproducibility* (different team, author's artifacts) and *replicability* (different team, own artifacts). Phase 5's re-derivation is a reproducibility check in this sense: a different step, the original artifacts. Note the terminology hazard below |
| **JCGM 100:2008** — *Evaluation of measurement data — Guide to the expression of uncertainty in measurement (GUM)* | JCGM 100:2008(E); Amendment 1 (2026) addresses nonlinearity | **Yes** | That a measurement without a stated uncertainty is incomplete. This is the formal backing for `reporting.md`'s rule that `n` sits beside the number, and for preferring "inconclusive" over a point estimate inside the noise |
| **JCGM 200:2012** — *International Vocabulary of Metrology (VIM)* | 3rd edition, 2012; annotated VIM3 online | **Yes** | Definitions of measurand, influence quantity and systematic effect — the precise vocabulary behind `evidence-gate.md`'s confound sweep |
| **JCGM GUM-6:2020** — *Developing and using measurement models* | 2020, part of the modular GUM series (GUM-1:2023, GUM-5:2026) | **Yes** | That the measurement model is an explicit artifact to be written down, which is what `harness.md`'s manifest and the derived-vs-observed distinction implement |
| **Pre-registration** as a methodological control | Practice, not a ratified standard; no single normative document pinned here | **No** | Phase 2's `prereg.txt`. Fixing the oracle before the data arrives is the entire mechanism; the paperwork is incidental |
| **Mutation testing** as an adequacy criterion | Practice with a large literature; no ratified standard | **No** | Phase 5 check 2. A test suite that survives a deliberate defect is not measuring the defect — read across from code to experiments |

## Terminology hazard — read before using the words

**ACM interchanged the definitions of "Results Replicated" and "Results Reproduced" on 24 August 2020**, to align with the NISO usage. Badges issued up to 14 May 2020 are Version 1.0; those from 15 May 2020 are Version 1.1, with the version shown on the badge.

The consequence: *"reproduced"* in a pre-2020 ACM paper and *"reproduced"* in a post-2020 one mean **opposite things**. Never carry the word between sources without checking which version's sense is in play, and prefer stating the mechanism — "a different step recomputed the figures from the original raw artifacts" — over the label.

## Deliberately not on the shelf

- **CONSORT, PRISMA and the clinical-trial reporting statements.** Genuinely the mature end of this discipline, and the source of the pre-registration idea, but their content is domain-bound to human-subjects trials. Borrowing their *structure* without their *domain* produces a checklist that looks rigorous and checks nothing relevant. The idea was taken; the documents were not pinned.
- **ISO/IEC/IEEE 29119 (software testing).** Adjacent, contested within the testing community, and about verifying software rather than conducting studies. Out of scope rather than rejected.
- **A statistical-methods authority.** This skill deliberately stops at "state `n`, state the spread, say inconclusive when it is." Pinning a statistics standard would imply the skill enforces statistical rigour it does not implement. Left open on purpose.

## Confirmation log

| Item | Confirmed against | Date | Result |
|---|---|---|---|
| JCGM 100 / 200 / GUM-6 editions and years | BIPM JCGM publications index (primary source) | 1 Sep 2026 | **Confirmed.** GUM is JCGM 100:2008(E) with Amd.1:2026; VIM is JCGM 200:2012; modular series GUM-1:2023, GUM-5:2026, GUM-6:2020 |
| ACM badging version, date, and the terminology swap | acm.org policy page returned **HTTP 403** to direct fetch; confirmed instead via search surfacing the ACM policy page and acm.org/publications/badging-terms | 1 Sep 2026 | **Confirmed with a caveat** — version 1.1 dated 20 August 2020, the 24 August 2020 Publications Board terminology swap, and the 15 May 2020 badge cutover are consistent across ACM-hosted sources, but the primary page could not be read directly. Re-confirm from the policy page itself when it is reachable |
| A ratified standard for pre-registration or mutation testing | Searched; none identified | 1 Sep 2026 | **Unconfirmed / none found.** Both are graded **No** rather than asserted as standards, which is the honest grade rather than a gap |

Nothing on this shelf was pinned from memory. Where a primary source could not be read, the row says so.
