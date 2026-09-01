# Ideation — making the question falsifiable

Phase 2's output is three artifacts, written down before any harness exists: the **claim**, the **prediction**, and the **refutation condition**.

## Topic versus hypothesis

A topic can only be confirmed. A hypothesis can lose.

| Topic (unusable) | Hypothesis (usable) |
|---|---|
| "Does the compression proxy help?" | "Routing agent traffic through the proxy reduces input tokens on a JSON-heavy workload by more than 20%, with no change in reported results." |
| "Is the new planner better?" | "The new planner produces plans that pass the acceptance gate at a higher rate than the current one, over the same 30 tasks." |
| "How fast is the cache?" | "Enabling the cache reduces p95 latency on the read path by at least 30% at current traffic." |

The difference is that each hypothesis names a number, a workload, and a direction — so a result can contradict it.

## The three artifacts

**Claim.** One sentence, in the present tense, about a mechanism and its effect. If it contains "and" joining two independent effects, it is two studies.

**Prediction.** What you expect to observe, in units, under stated conditions. "Faster" is not a prediction. "p95 under 400 ms at 200 rps" is.

**Refutation condition.** The observation that would make the claim false. Write it as a sentence beginning "This claim is false if…". If you cannot finish that sentence, you do not have a hypothesis yet, and the study you are about to run can only produce agreement.

## Fix the oracle before the data arrives

**Decide what counts as success while you still do not know the answer.** Choosing the threshold after seeing the numbers is how a null result becomes a positive one, and it does not feel like cheating at the time — it feels like refining the analysis.

Write down, in phase 2:

- The threshold, with its units.
- What you will compare against — the baseline, named and pinned.
- What you will do if the result lands *near* the threshold. Pre-committing to "inconclusive" is what makes the band meaningful.

## The tautology trap

**The most common defect in this phase: an oracle that cannot fail.**

A study measured whether a proxy corrupted an agent's reading of a verification chain. The chain's seven steps all passed. The oracle was "do the steps still pass?" — which they would have, in every arm, whether or not the proxy mangled a single byte, because the pass/fail came from shell exit codes the proxy never touched. An agent that read nothing and asserted "everything passed" would have scored perfectly.

The fix was to grade on detail that only appears in the *verbose output*: exact per-item counts, the specific skipped-test locations, a freshly generated duration. Those can only be reported by something that actually read what it was given.

### The test

Before building anything, answer: **what result would this study produce if the mechanism did nothing at all?**

If the answer is "the same result", the oracle is a tautology. Redesign it before spending a run. Two reliable moves:

- **Grade on values that vary per run.** A fresh duration or timestamp proves the work happened. A documented constant proves nothing — it may have been recited.
- **Grade on values that require reading the thing under test.** Not a summary line, but a detail that only exists inside the payload.

## Scoping the arms

An arm is a condition. Two arms is the minimum for a comparison, and each additional one multiplies cost.

- **State what differs between arms, and confirm it is exactly one thing.** If the arms also differ in workload, ordering or warm-up state, the study measures the mixture.
- **Decide arm order deliberately**, and record which bias it introduces. Whatever runs second inherits warm caches; that bias favours it. See `evidence-gate.md` §The cache confound.
- **Pre-register the run count per arm.** Deciding to run "one more" after seeing a result is selection, and it is invisible in the final numbers.

## Sizing honesty into the design

Decide in phase 2 what the study will be *able* to conclude, and say so up front:

| Runs per arm | What it can honestly support |
|---|---|
| 1 | Detecting a gross effect or a gross failure. Not a percentage |
| 3–5 | A direction, with the spread reported |
| Enough to bound variance | An effect size, with the bound stated |

A single run per arm is a legitimate design — it is cheap and it rules out large, obvious failures. It becomes dishonest only when its output is written as though it were a measurement. Deciding this now prevents the phase-6 temptation to quote a precise figure the design never earned.

## Related work — what is already known

**Phase 3. Delegated wholesale to `loop-research`'s law** (`../loop-research/references/source-evaluation.md`
for grading, `methodology.md` for the refutation discipline). This skill adds no new law here;
it adds one requirement and one hazard.

**The requirement: resolve citations against a real index, never from memory.** A reference
the model recalled is the same defect class as a figure it recited — plausible, correctly
formatted, and unverifiable. Query a live source (arXiv, Semantic Scholar, alphaXiv, or the
project's own record) and carry the resolved identifier, not just a title and year.

**The hazard, and it is specific to this phase: related work can quietly become the answer.**
If prior work already settles the question, there is no experiment to run — the honest move is
to stop and hand the question to `loop-research`, which gathers evidence rather than generating
it. A study that re-derives a known result and reports it as a finding has wasted a run and
mislabelled a literature review.

So this phase produces a decision, not just a bibliography:

| Finding | What to do |
|---|---|
| The question is already answered by credible prior work | **Stop.** Hand to `loop-research`. Record why |
| Prior work answers it under *different* conditions | Continue, and state the delta in the prediction — that delta is now the contribution |
| Prior work makes a claim you intend to test | Continue. Its stated result becomes a **baseline you can be wrong about**, which sharpens the refutation condition |
| Nothing relevant found | Continue, and say so plainly. "No prior art found" is a claim about your search, not about the world — record what you searched |

Carry each source with the grade `loop-research` assigns it. A vendor's own benchmark is
evidence about the vendor; it is not an independent result, and the report must not launder it
into one.

## Output of this phase

A short pre-registration, written to the study directory before the harness exists:

```
CLAIM:       <one sentence>
PREDICTION:  <observation, in units, under stated conditions>
REFUTED IF:  <the observation that makes the claim false>
BASELINE:    <what this is compared against, pinned>
ORACLE:      <how success is decided, with threshold>
ARMS:        <n arms, what differs, run order and its bias>
RUNS:        <count per arm, committed in advance>
CAN SUPPORT: <what this design can honestly conclude>
PRIOR WORK:  <resolved citations with grades, and the delta this study adds>
```

It is short on purpose. Its value is that it exists **before** the data, and that phase 6 quotes the refutation condition back verbatim rather than paraphrasing it into something the result happens to satisfy.
