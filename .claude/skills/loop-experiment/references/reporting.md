# Writeup — phase 6

The report's job is to let someone else decide whether to believe the result. That is a different job from persuading them, and the two produce different documents.

## Every claim traces to an artifact

Each number carries its provenance: which file in `runs/` or `truth/` it came from, and what re-derived it in phase 5. A number without a trace does not appear — phase 5 struck it already, and the writeup's job is not to reintroduce it with a hedge.

## Answer the refutation condition, verbatim

Quote the phase 2 refutation condition **as written** and state plainly whether it was met. Paraphrasing is where a null result quietly becomes a partial success: "the claim is false if the reduction is under 20%" becomes "we saw a meaningful reduction", and the study has now confirmed itself.

If the pre-registered threshold was missed, the claim is refuted. Say that in those words.

## Report the null result

**A study that cannot come back negative was never a study.** A negative result that was honestly obtained is a complete deliverable, not a failed run, and it is usually worth more than a positive one because it closes a question.

The specific temptation to resist: the result came out flat, so the framing shifts to whatever *did* move. That is a new hypothesis with the old study's data, and it has no pre-registration behind it. Report the null, then say what the interesting new question is — as a question, for a new study.

## Sample size in the body, not a footnote

`n` sits beside the number it qualifies. "2.9% (n=1 per arm)" is honest. "2.9%" is not, and no amount of methodological caveat further down repairs it, because the number is what gets quoted onward.

Where the effect sits inside run-to-run variance, the finding is **inconclusive** — not a percentage with a caveat. Those are different results and the report should not blur them.

## Declare the confounds that survived

Phase 5's sweep produces two lists: ruled out with evidence, and still live. Both belong in the report. For each live confound, state:

- What it is, and the direction it biases the result.
- Why it could not be ruled out here.
- **What the study would need to resolve it** — more runs, alternated ordering, an external measurement, a bigger sample.

That last item is the difference between a limitation section and an apology. It tells the next reader what to build.

## Separate layers of a headline number

Where a result aggregates several mechanisms, decompose it. A headline "49% saved" that turns out to be one layer doing 3% and another layer doing the rest is not a 49% result for the mechanism under test — it is two findings, one of which is about something else entirely.

Report the decomposition **beside** the aggregate, never instead of it, so a reader can see both what was claimed and what it was made of.

## Structure

```
CLAIM & PREDICTION      quoted from prereg.txt
REFUTED IF / OUTCOME    the condition verbatim, and whether it was met
METHOD                  arms, runs, pinning, what was measured and where from
RESULT                  numbers with n, each traced to its artifact
RE-DERIVATION           what phase 5 recomputed, and anything struck
MUTATION                what was broken, what the study did in response
CONFOUNDS               ruled out (with evidence) / live (with direction and cost to resolve)
WHAT THIS SUPPORTS      the honest scope of the conclusion
WHAT IT DOES NOT        the reading someone will otherwise take from it
```

The final section is not modesty. It pre-empts the specific over-reading the result invites — and if you cannot name that over-reading, phase 7's reviewer will.

## Voice

- Numbers over adjectives. "3.0% and 2.9% across two workloads" beats "minimal savings".
- State what is *not* true where a reader's default assumption is wrong: *"the arm delta was ten times the system's own claimed saving, so most of it is not attributable to the mechanism."*
- No result is described as "confirming" the hypothesis. It failed to refute it, under stated conditions, at a stated sample size.
