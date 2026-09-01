# Prior art — freephdlabor, read at source

This skill's phase vocabulary is ported from [`ltjed/freephdlabor`](https://github.com/ltjed/freephdlabor) (MIT, Yale, [arXiv 2510.15624](https://arxiv.org/abs/2510.15624)). The port is deliberate and the omission is the point: **phases 1, 2, 3, 5 and 6 of that framework became phases 2, 3, 4, 6 and 7 here. Phase 5 — the evidence gate — has no counterpart there.**

This file records what was verified by reading its source, so the borrowing is honest and the gap is precisely located rather than vaguely asserted.

## What it does well, and it is not a little

- **The experiments are real.** `RunExperimentTool` spawns a bundled, modified copy of AI-Scientist-v2 as a subprocess that writes and executes actual training and evaluation code through a four-stage pipeline. This is not simulated.
- **The citations are real.** Its citation tool queries the live arXiv API and Semantic Scholar's Graph API and parses genuine responses. Whether they are cited *relevantly* is unverified.
- **Agents write code, not tool calls.** Every agent subclasses `smolagents.CodeAgent`, so an action is Python that gets executed.
- **The interrupt mechanism is real.** A bare TCP socket: connect, type `interrupt`, and free text is injected into the running agent's memory at the next step boundary.
- **A resource-preparation stage exists** — and this skill kept it as its own phase, because the framework was right that harness construction is separate work from running the experiment. Notably, that agent is **undocumented**: the README lists six agents; the ManagerAgent's constructor instantiates seven.

## The gap, located precisely

**The only quality gate is a vision model reading the compiled PDF.**

- The ReviewerAgent's substantive tool is a document-analysis call over the rendered paper. It **never re-executes the code** and **never diffs the paper's reported numbers against the raw `research_summary.json`** produced by the run.
- The bar it enforces — *"NEVER terminate with ReviewerAgent score < 6"* — is natural-language text in `manager_instructions.py`. There is no assertion, no loop guard, nothing in code that would stop a run whose orchestrating model decided to proceed anyway.
- The anti-fabrication rule is likewise a prompt instruction: *"DO NOT generate synthetic experimental results. Report the failure honestly."* A request, not a control.
- The shared workspace is a plain directory tree — no database, no locking. Coordination is a convention stated in the prompt; an agent's generated Python could write anywhere.
- The README carries **no limitations section and no cost disclosure**.

The consequence is structural, not a matter of tuning: **a paper with plausible but fabricated numbers passes exactly as an honest one does**, because nothing in the loop ever returns to the raw run to check.

## Why this is a general lesson, not a criticism of one repo

The paper's own stated contribution is architectural flexibility — continual, interactive orchestration — not correctness guarantees. Read that way, the framework delivers what it claims. The gap matters because the *vocabulary* is genuinely good and gets reused, and phase structure is what people copy.

The generalizable claim: **the verification layer is the part that does not get shipped, because it is the part that makes your numbers smaller.** A gate that can reject makes a system look worse and be worth more. Every one of the three defects above — review-by-rendered-output, quality bars as prompt text, anti-fabrication as a polite request — is a place where enforcement was replaced by instruction, and instruction addressed to a language model is not enforcement.

## What this skill changed

| freephdlabor | Here |
|---|---|
| Reviewer reads the compiled PDF | Reviewer reads raw artifacts alongside the report (`review.md`) |
| No re-derivation of reported numbers | Re-derivation is check 1, by a step that did not produce them (`evidence-gate.md`) |
| No mechanism for detecting a no-op result | Mutation is check 2 — break it, confirm the study notices |
| Quality bar as prompt text | The gate halts; a rejection stops the study rather than logging it |
| No pre-registration | Claim, prediction and refutation condition written before the harness (`hypothesis.md`) |
| No stated limitations | Confounds, sample size and scope are required report sections (`reporting.md`) |

Everything in the left column was read from the repository's source in September 2026. Anything that could not be confirmed from source is marked unverified above rather than asserted.
