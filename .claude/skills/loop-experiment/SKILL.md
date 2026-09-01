---
name: loop-experiment
description: "Run an empirical study whose evidence the agent generates rather than gathers: frame a falsifiable hypothesis, resolve what prior work already settles, build the harness, execute, re-derive every reported number from the raw artifacts, then assemble a cited study document and attack it. Use when the question can only be answered by running something that does not exist yet — measuring whether a change actually helps, comparing approaches under load, testing a vendor's claim, or producing a reproducible result someone else must be able to trust. For a question answerable from sources that already exist, use loop-research, which gathers evidence instead of generating it and whose law this skill's related-work phase runs under. For choosing the mechanism inside a known component, use loop-algo. For explaining a failure you already observed, use loop-debug. For documentation about code rather than a study reporting a result, use loop-docs, whose law this skill's writeup runs under."
argument-hint: <hypothesis or question> [--mode <lite|balanced|all-out>]
---

# Running an Experiment

**The discriminating predicate: the answer does not exist yet in any source, and getting it requires executing something you must first build.** If the answer is out there and the work is finding and verifying it, this is `loop-research`. If you are picking a data structure for a component, this is `loop-algo`. If something already failed and you need to know why, this is `loop-debug`. This skill produces a **cited, reviewed study document backed by a reproducible finding**: a hypothesis, resolved prior work, a harness, raw artifacts, and a report in which every number has been re-derived from those artifacts by something other than the agent that wrote it.

**The failure this skill exists to prevent is the plausible result.** A study that runs, produces numbers, and reports them confidently is indistinguishable from one that fabricated them — unless something re-derives the numbers from the raw run. Systems that skip that step do not fail loudly; they publish. The [`freephdlabor`](references/prior-art.md) framework is the worked example: real experiments, real citations, and a reviewer that is a vision model reading the rendered PDF, which never re-executes the code and never diffs reported figures against the raw logs. Its quality bar — "never terminate below a review score of 6" — is a sentence in a prompt with nothing in code to enforce it. **Every phase below except step 6 is that framework's vocabulary. Step 6 is what it does not have.**

## 1. Parse arguments

- **hypothesis** — everything that is not a flag. If it is a topic rather than a claim, stop at step 2 and sharpen it before running anything.
- **`--mode <lite|balanced|all-out>`** — parsed by `loop-engine`; pass the raw argument string through. See [`../loop-engine/references/execution-modes.md`](../loop-engine/references/execution-modes.md).

| Situation | Start at |
|---|---|
| A question or claim to test | Step 2 |
| A hypothesis and harness already exist | Step 5 |
| Results exist and are disputed | Step 6 — re-derivation is the whole job |

## 2. Ideation — make it falsifiable

Read [`references/hypothesis.md`](references/hypothesis.md).

Produce three artifacts before touching a harness: the **claim**, the **prediction** (what you expect to observe, in units), and the **refutation condition** (what observation would make the claim false). A hypothesis with no refutation condition is a topic, and a study of a topic can only confirm.

**Fix the oracle here, not after the data arrives.** Deciding what counts as success once you have seen the numbers is how a null result becomes a positive one.

**The oracle must be able to fail.** A gate that passes whether or not the mechanism works measures nothing — the tautology trap, and the most common defect in this phase. `hypothesis.md` carries the test.

## 3. Related work — what is already known

Read [`references/hypothesis.md`](references/hypothesis.md) §Related work. **Delegated to `loop-research`'s law** — source grading and refutation discipline are that skill's, not restated here.

**Resolve every citation against a live index. Never from memory** — a recalled reference is the same defect class as a recited figure.

This phase produces a decision, not a bibliography. **If prior work already settles the question, stop and hand it to `loop-research`.** A study that re-derives a known result and reports it as a finding has mislabelled a literature review. Where prior work answers the question under different conditions, that delta becomes the contribution and belongs in the prediction.

## 4. Resource preparation — build the harness

Read [`references/harness.md`](references/harness.md).

Environment, fixtures, data, instrumentation, and **ground truth captured independently of the thing under test**. Non-negotiable: if the same code produces both the result and the standard it is graded against, the study is circular and nothing downstream recovers it.

Pin what varies — versions, seeds, dataset digests, hardware. An unpinned experiment is an anecdote.

## 5. Experimentation — execute and capture

Read [`references/harness.md`](references/harness.md) §Execution.

Capture **raw artifacts, not summaries** — full output, exit codes, timings — to a durable path. Step 7 is built from these files and step 6's verifier reads them independently.

Record the ugly parts: retries, partial failures, anything abandoned. A run with an undisclosed re-run is not reproducible.

## 6. The evidence gate — what the vocabulary was missing

Read [`references/evidence-gate.md`](references/evidence-gate.md). **This is the reason this skill exists. It is not optional and it does not collapse into step 8.**

1. **Re-derivation.** Every number in the report is recomputed from the raw artifacts by a step that did not produce them. A figure that cannot be re-derived is struck, not softened.
2. **Mutation.** Break the mechanism under test and confirm the study detects it. A study that reports the same result with the mechanism disabled measured nothing.
3. **Confound sweep.** Name what else could produce this result — ordering, caching, shape divergence, sample size, selection. Each is ruled out with evidence or declared live in the report.

**A study that fails re-derivation is reported as failed.** It is not re-run until it passes; that is the same defect wearing a lab coat.

## 7. Writeup — assemble the study document

Read [`references/reporting.md`](references/reporting.md). **Delegated to `loop-docs`' law** for doc-type discipline and claim verification; this skill adds the provenance rule.

The deliverable is a **document on disk**, Markdown by default — someone else has to read it, disagree, and re-run it. Every figure carries its value *and its source artifact*, inline at the claim. Citations from step 3 carry resolved identifiers; results from this study carry artifact paths, and the document never blurs the two.

Quote the refutation condition **verbatim** and state whether it was met. Report the null plainly. `n` sits beside every number, not in a footnote. Declare the confounds step 6 could not rule out, each with its direction of bias and what would resolve it.

**Plots inherit every rule above** — a truncated axis is a rhetorical device, and a figure that cannot be re-derived is struck alongside the number it illustrates.

## 8. Review and proofread — attack it

Read [`references/review.md`](references/review.md).

The reviewer reads the **raw artifacts alongside the document**, never the document alone, and is judged on whether it found a problem rather than whether it approved. Reviewing rendered output only — freephdlabor's actual gate — cannot catch a number that never came from the run.

The proofread pass is a **consistency check, not a polish**: a number appearing twice with two values, a claim no section supports, a citation with no entry, hedging that contradicts the verdict. **It never changes a number** — a figure that looks wrong is a step 6 failure and goes back to re-derivation.

## Orchestration

Work **inline** for a single hypothesis with one arm.

Use [`templates/experiment-study.workflow.js`](templates/experiment-study.workflow.js) when the study has **multiple arms**: related work resolves first, arms then pipeline independently through execute → re-derive, and the barrier before synthesis is earned under H2 by a genuine cross-arm reduce — the comparison cannot be computed per-arm. Reviewer width comes from `WIDTH`, and the reviewers are perspective-diverse rather than the same question asked three times.

## Reference files

| File | What it holds |
|---|---|
| [`references/hypothesis.md`](references/hypothesis.md) | Falsifiability, the prediction/refutation pair, fixing the oracle, the tautology trap; and the related-work phase with its stop-and-hand-off decision |
| [`references/harness.md`](references/harness.md) | Independent ground truth, pinning, fixtures, instrumentation, execution and artifact capture |
| [`references/evidence-gate.md`](references/evidence-gate.md) | Re-derivation, mutation checks, the confound catalogue — the three checks of step 6 |
| [`references/reporting.md`](references/reporting.md) | Traceable claims, null results, confounds; the study document, its format, figures, and the proofreading pass |
| [`references/review.md`](references/review.md) | Adversarial review against raw artifacts; why rendered-output review fails |
| [`references/prior-art.md`](references/prior-art.md) | freephdlabor read at source — what it does well, and the precise shape of its missing gate |
| [`references/standards.md`](references/standards.md) | The pinned authorities this skill reasons from |
