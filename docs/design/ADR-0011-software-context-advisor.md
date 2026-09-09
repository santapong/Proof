# ADR-0011 — Local context advice for software teams

Date: 2026-09-09. Status: accepted for a local, opt-in experiment; learned routing is not promoted to the default.

## Context

Software teams need a short path from a concrete issue to a verified handoff. Proof already has skill boundaries, progressive references, model-tier routing and a propose-only improvement loop. Loading every router/reference or delegating every small task adds context without demonstrating better delivery. The [September routing study](../examples/routing-study-2026-09-01.md) also shows why plausible routing changes need a baseline before broad adoption.

## Decision

1. Add a source-checkout CLI, `scripts/software-context.mjs`, using Node built-ins only. It reuses the existing boundary matcher for lexical candidates. A known skill can be named directly; an unclear request can abstain. Candidate scores are advisory, never an ownership verdict or authorization to execute.
2. Offer an explicit local multinomial Naive Bayes model trained from reviewed labelled requests. Ship synthetic training examples as a demonstration, clearly separated from team outcomes. No model download, provider call, automatic training, scheduling, or installation is implied.
3. Keep learned candidates separate from the lexical baseline and normative boundary checks. Model scores are uncalibrated. Source/model provenance and stale-artifact validation are part of the output. Existing model/effort pins, verifier gates and workflow templates remain authoritative.
4. Return a reading plan with complete skill entrypoints and pointers to conditional references. Do not truncate instructions to meet a budget, summarize away policy, or claim a reference was loaded because a pointer was emitted. The plan reduces an explicit comparison's reading surface only when followed; it is not a runtime context controller.
5. Evaluate baseline first against independently authored frozen requests, then the candidate and a no-signal control. Separate top-1, top-k, coverage and abstention. Exact/normalized train-test overlap checks catch one leakage class; independent authorship does not establish an unseen real-world test distribution.
6. Report exact characters and a labelled `ceil(characters / 4)` token proxy. A static reduction against loading the fleet is not a billed-token saving, a comparison against normal progressive loading, or evidence of successful software delivery. Actual optimization needs matched task outcomes plus observed provider usage, retries and latency.
7. Update only the relevant guide, context and improvement references for software-team intake, handoff and evidence-backed skill maintenance. Generated host packs carry prose through the existing packer; this CLI is available only with the source checkout and is not a new MCP tool or workflow adapter.

## Promotion and rollback

Default behavior remains lexical advice without a trained model. A model can be tried by passing its path explicitly. After a genuine correction or observed delivery failure, preserve the source evidence, propose one scoped change and evaluate it without changing the acceptance criteria. Keep a previous skill/model revision available; stop using the candidate when routing or task quality regresses. Model selection, revised training data and thresholds require a fresh evaluation after the existing test set has informed development.

Passing fixtures or structural gates permits a local trial, not default activation. A software team should predeclare its acceptable task-quality, abstention, latency and measured-token criteria before collecting representative outcomes. Improvements cannot authorize a merge, publication, external message or deployment.

## Method sources and limits

The classifier follows [multinomial Naive Bayes text classification](https://nlp.stanford.edu/IR-book/html/htmledition/naive-bayes-text-classification-1.html), a count-based supervised method with simplifying independence assumptions. The separate fit/evaluation workflow follows the [data-leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage) in scikit-learn's documentation; scikit-learn itself is not a dependency. Sources checked 2026-09-09. Neither source establishes that this particular classifier saves tokens or improves Proof.
