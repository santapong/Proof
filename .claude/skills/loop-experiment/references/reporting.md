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

## The study document

The report is a **document on disk**, not a return value — someone else has to read it,
disagree with it, and re-run it. It is written under `loop-docs`' law (Diataxis doc-type
discipline, every claim verified against its source); this skill adds only the provenance
rule below.

**Format: Markdown by default.** The framework this vocabulary came from compiles LaTeX to a
PDF. That buys typesetting and costs a toolchain — and it is also what made its review step
fail, because a rendered PDF is exactly the artifact a reviewer cannot check against raw logs.
A Markdown study report sits next to the artifacts it cites and diffs in review. Emit LaTeX
only when the caller asks for it, and if you do, the reviewer still reads the source and the
artifacts, never the compiled output.

### The provenance rule

**Every figure in the document carries two things: its value and where it came from.** Not a
footnote — inline, at the claim. A reader must be able to go from any number to the file that
produced it without asking you.

The same rule applies to citations, in the other direction: a claim attributed to prior work
carries a resolved identifier, and a claim from this study carries an artifact path. A
sentence that mixes both without distinguishing them is the most common way a study's own
result gets confused with something it read.

### Figures

A plot is a claim. It inherits every rule above:

- The data behind it is in `runs/` or `truth/`, and the document says which file.
- Axes carry units, and the axis range is stated when it is not zero-based — a truncated axis
  is a rhetorical device, not a neutral choice.
- `n` appears on or beside the figure, not only in the prose.
- A figure that cannot be re-derived from the artifacts is struck alongside the number it
  illustrates. Phase 5 does not exempt pictures.

### Structure of the document

The section order from above, plus a header block carrying the pre-registration verbatim and
a `Prior work` section holding the graded citations from phase 3. The pre-registration goes
at the top rather than the end: a reader who sees the refutation condition before the result
can judge whether the result answers it.

## Proofreading

A last pass over the assembled document, under `loop-docs`' law. It is a **consistency check,
not a polish**, and it is looking for four specific things:

1. **A number that appears twice with two values.** Usually a figure updated in one place after
   a re-run. This is the single most common defect in a study document.
2. **A claim in the prose that no section supports** — often a summary sentence written before
   the result came in and never revised.
3. **A citation in the text with no entry in `Prior work`**, or an entry cited nowhere.
4. **Hedging that contradicts the verdict** — "suggests a substantial improvement" sitting above
   a table whose verdict field says `inconclusive`.

Proofreading never changes a number. If it finds one that looks wrong, that is a phase 5
failure and goes back to re-derivation — a document is not the place to fix an arithmetic
error.

## Voice

- Numbers over adjectives. "3.0% and 2.9% across two workloads" beats "minimal savings".
- State what is *not* true where a reader's default assumption is wrong: *"the arm delta was ten times the system's own claimed saving, so most of it is not attributable to the mechanism."*
- No result is described as "confirming" the hypothesis. It failed to refute it, under stated conditions, at a stated sample size.
