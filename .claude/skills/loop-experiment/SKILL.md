---
name: loop-experiment
description: "Run an empirical study whose evidence the agent generates rather than gathers: frame a falsifiable hypothesis, build the harness, execute the run, re-derive every reported number from the raw artifacts, then write it up and attack it. Use when the question can only be answered by running something that does not exist yet — measuring whether a change actually helps, comparing two approaches under load, validating a claim a vendor makes, or producing a reproducible result someone else must be able to trust. For a question answerable from sources that already exist, use loop-research, which gathers evidence instead of generating it. For choosing the mechanism inside a known component, use loop-algo. For explaining a failure you already observed, use loop-debug."
argument-hint: <hypothesis or question> [--mode <lite|balanced|all-out>]
---

# Running an Experiment

**The discriminating predicate: the answer does not exist yet in any source, and getting it requires executing something you must first build.** If the answer is out there and the work is finding and verifying it, this is `loop-research`. If you are picking a data structure for a component, this is `loop-algo`. If something already failed and you need to know why, this is `loop-debug`. This skill produces a **reproducible empirical finding**: a hypothesis, a harness, raw artifacts, and a report in which every number has been re-derived from those artifacts by something other than the agent that wrote it.

**The failure this skill exists to prevent is the plausible result.** A study that runs, produces numbers, and reports them confidently is indistinguishable from one that fabricated them — unless something re-derives the numbers from the raw run. Systems that skip that step do not fail loudly; they publish. The [`freephdlabor`](references/prior-art.md) framework is the worked example: real experiments, real citations, and a reviewer that is a vision model reading the rendered PDF, which never re-executes the code and never diffs reported figures against the raw logs. Its quality bar — "never terminate below a review score of 6" — is a sentence in a prompt with nothing in code to enforce it. **Phases 1, 2, 3, 5 and 6 below are that framework's vocabulary. Phase 4 is what it does not have.**

## 1. Parse arguments

- **hypothesis** — everything that is not a flag. If it is a topic rather than a claim, stop at step 2 and sharpen it before running anything.
- **`--mode <lite|balanced|all-out>`** — parsed by `loop-engine`; pass the raw argument string through. See [`../loop-engine/references/execution-modes.md`](../loop-engine/references/execution-modes.md).

Then establish which job this is:

| Situation | Start at |
|---|---|
| A question or claim to test | Step 2 |
| A hypothesis and harness already exist | Step 4 |
| Results exist and are disputed | Step 5 — re-derivation is the whole job |

## 2. Ideation — make it falsifiable

Read [`references/hypothesis.md`](references/hypothesis.md).

Produce three artifacts before touching a harness: the **claim**, the **prediction** (what you expect to observe, in units), and the **refutation condition** (what observation would make the claim false). A hypothesis with no refutation condition is a topic, and a study of a topic can only confirm.

**Fix the oracle here, not after the data arrives.** Deciding what counts as success once you have seen the numbers is how a null result becomes a positive one. Write the threshold down first.

**The oracle must be able to fail.** A gate that passes whether or not the mechanism works measures nothing — this is the tautology trap, and it is the single most common defect in this phase. `hypothesis.md` carries the test.

## 3. Resource preparation — build the harness

Read [`references/harness.md`](references/harness.md).

The environment, fixtures, data and instrumentation, plus **ground truth captured independently of the thing under test**. This phase exists because the alternative is measuring your own measurement apparatus.

Non-negotiable in this phase: **the ground truth is captured by a separate path from the run being graded.** If the same code produces both the result and the standard it is graded against, the study is circular and no amount of later verification recovers it.

Pin what varies: versions, seeds, dataset digests, hardware. An unpinned experiment is an anecdote.

## 4. Experimentation — execute and capture

Read [`references/harness.md`](references/harness.md) §Execution.

Run it. Capture **raw artifacts, not summaries** — logs, exit codes, full outputs, timestamps — to a durable path. The report in phase 5 is built from these files, and phase 5's verifier reads them independently.

Record what actually happened, including the ugly parts: retries, partial failures, anything abandoned. A run with an undisclosed re-run is not reproducible.

## 5. Verification — the gate the vocabulary was missing

Read [`references/evidence-gate.md`](references/evidence-gate.md). **This phase is the reason this skill exists. It is not optional and it does not collapse into phase 6.**

Three checks, in order:

1. **Re-derivation.** Every number in the report is recomputed from the raw artifacts by a step that did not produce them. A figure that cannot be re-derived is struck, not softened.
2. **Mutation.** Break the mechanism under test and confirm the study detects it. A study that reports the same result with the mechanism disabled measured nothing. This is the empirical analogue of a mutation-checked acceptance test, and it is what separates a finding from a formatting exercise.
3. **Confound sweep.** Name what else could produce this result. Ordering, caching, warm-up, sample size, selection. Each one is either ruled out with evidence or declared as a live confound in the report.

**A study that fails re-derivation is reported as failed.** It is not re-run until it passes — that is the same defect wearing a lab coat.

## 6. Writeup — report what happened

Read [`references/reporting.md`](references/reporting.md).

Every claim traces to a raw artifact. State the refutation condition from phase 2 and whether it was met. Report the null result plainly if that is what happened; a study that cannot come back negative was never a study.

**Declare the confounds phase 5 could not rule out, and say what the result would need to become trustworthy.** Sample size, arm count and known bias belong in the body, not a footnote — "n=1 per arm" beside a percentage is honest; the percentage alone is not.

## 7. Review — attack it

Read [`references/review.md`](references/review.md).

The reviewer reads the **raw artifacts alongside the report**, never the report alone. Its job is to find the reading of the data that contradicts the conclusion, and it is judged on whether it found one, not on whether it approved.

Reviewing the rendered output only — freephdlabor's actual gate — cannot catch a number that never came from the run. If your review step cannot see the logs, you have rebuilt the thing this skill was written to avoid.

## Orchestration

Work **inline** for a single hypothesis with one arm — it is one coherent job, and fanning it out costs more than it returns.

Use [`templates/experiment-study.workflow.js`](templates/experiment-study.workflow.js) when the study has **multiple arms or conditions**: arms pipeline independently through prepare → execute → re-derive, and the barrier before synthesis is earned under H2 by a genuine cross-arm reduce — the comparison between arms cannot be computed per-arm. The verify stage's width comes from `WIDTH`, and the confound sweep is deliberately perspective-diverse rather than the same question asked three times.

## Reference files

| File | What it holds |
|---|---|
| [`references/hypothesis.md`](references/hypothesis.md) | Falsifiability, the prediction/refutation pair, fixing the oracle, the tautology trap and its test |
| [`references/harness.md`](references/harness.md) | Independent ground truth, pinning, fixtures, instrumentation, execution and artifact capture |
| [`references/evidence-gate.md`](references/evidence-gate.md) | Re-derivation, mutation checks, the confound catalogue — the three checks of phase 5 |
| [`references/reporting.md`](references/reporting.md) | Traceable claims, null results, declaring confounds and sample size honestly |
| [`references/review.md`](references/review.md) | Adversarial review against raw artifacts; why rendered-output review fails |
| [`references/prior-art.md`](references/prior-art.md) | freephdlabor read at source — what it does well, and the precise shape of its missing gate |
| [`references/standards.md`](references/standards.md) | The pinned authorities this skill reasons from |
