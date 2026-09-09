# Architecture — Proof

Proof has two main execution contexts: the **agent session that authors a
workflow**, and the **host sandbox that executes it**. Skills, references,
policies, and MCP tools support the authoring session. The host provides the
agent runtime; Proof supplies the workflow instructions and validation tools.

## Architecture at a glance

![Source-backed architecture overview: skill library, authoring session, shared policies, MCP authoring tools, host runtime, human gate, and portable packs.](../assets/proof-architecture.svg)

[Open the SVG](../assets/proof-architecture.svg) ·
[Download the explorable HTML](../assets/proof-architecture.html) ·
[Editable specification](../assets/proof-architecture.architecture.json)

The SVG works directly in GitHub. Download the HTML and open it locally to
inspect nodes, follow relationships, switch themes, and export images. Source
links in that viewer are pinned to the inspected implementation revision.

## Follow a task

![Scope, work, verify, and human gate: a bounded software-team phase.](../assets/proof-workflow.svg)

1. **Select a skill.** Invoke it directly or use `loop-guide` for task intake.
   Read its boundary and complete entrypoint before committing to the task.
2. **Author a phase.** Load the relevant references and shared policies.
   `loop-engine` maps the task to a lifecycle phase and authors the script.
   The `all-out` pre-flight happens in this session, before execution.
3. **Execute and verify.** The host runs the script. Canonical `ROUTES` supplies
   per-node model options. Relevant checks and adversarial review produce
   evidence; the repository's own CI checks validate the plugin separately.
4. **Return to the human gate.** Report the deliverable, evidence, and remaining
   gaps. Approval, redirection, and stopping follow the session's authorization.

## Choose a deeper view

| View | Question | Read next |
| --- | --- | --- |
| Context | Who uses Proof, and what is outside it? | [C4 Level 1](context.md) |
| Containers | What loads as instructions, runs as a process, or is generated? | [C4 Level 2](container.md) |
| Components | How do authoring, routing, and execution fit inside `loop-engine`? | [C4 Level 3](component.md) |
| Skill atlas | How do the 26 skills divide responsibilities? | [Fleet diagrams](skills.md) · [Skill anatomy](skill-anatomy.md) |
| Runtime and development | What runs concurrently, where does it run, and what changes? | [4+1 views](../views/4plus1.md) |
| Decisions | Which contracts govern the implementation? | [ADRs and boundary audit](../design/README.md) |

The overview is an explanatory map across these levels. The detailed C4 views
keep their own abstraction boundaries; the overview does not replace them.

## Boundaries that matter

| Boundary | Current behavior | Source |
| --- | --- | --- |
| Authoring / execution | The session can read files and interact; a running workflow script cannot import modules, read the filesystem, or prompt the user. | [Harness policy H10](../../.claude/skills/loop-engine/references/harness-policy.md) |
| MCP / runtime | Five MCP tools assist authoring. They are not callable from inside a running workflow script. | [MCP contracts](../../mcp/tool-contracts.json) · [Server](../../mcp/server.mjs) |
| Knowledge / host execution | Portable packs carry 22 skills to three hosts and exclude workflow scripts and four native skills. | [Host packaging](../design/ADR-0008-host-packaging-seam.md) |
| Advice / authority | The local lexical matcher and optional ML classifier suggest candidates. Boundaries, permissions, model tiers, and verification gates retain authority. | [Context advisor design](../design/ADR-0011-software-context-advisor.md) |
| Integration / release | Normal work goes to `develop`; releases go to `main`. Cleanup follows verified integration. | [Branch policy](../branch-policy.md) |

## Diagram sources and rendering

| Asset family | Editable source | Produce the image |
| --- | --- | --- |
| New architecture overview | [Archify JSON](../assets/proof-architecture.architecture.json) | Validate/deliver with Archify; `node scripts/render-readme-architecture.mjs` produces the README SVG |
| Team workflow | [Native SVG](../assets/proof-workflow.svg) | Edit the SVG directly; check both themes and small widths |
| Detailed C4 and 4+1 diagrams | [`diagrams/src/*.mmd`](diagrams/src/) | `node scripts/render-diagrams.mjs` |

The Mermaid sources remain authoritative for their generated SVGs; change and
commit source and output together. The new overview has a separate generation
path and does not overwrite those detailed diagrams. Reproduction commands,
source mapping, licenses, and visual checks are in [the asset guide](../assets/README.md).

<details>
<summary>Design rationale and references</summary>

## The ideas, and where they come from

Seven load-bearing ideas. Each is someone else's, applied to a new substrate.

### 1 · Progressive disclosure — thin routers, deep references

An agent's context window is the scarce resource. Loading the whole skill library for every task would add irrelevant context. So each skill is a **thin router** (`SKILL.md`, ~6–11 KB) that names what it needs, and the depth lives in `references/` loaded on demand.

The cost is a real constraint on authoring: a router that grows into a reference file defeats the mechanism, which is why the validation gate checks router size and CONTRIBUTING states the rule.

> Progressive disclosure as an interface principle — show what is needed now, defer the rest — is long-established in interaction design (Nielsen Norman Group and the wider HCI literature).

### 2 · Pipeline by default, barriers earned

Multi-stage work flows through `pipeline()` with **no barrier**: item A can be in stage 3 while item B is still in stage 1. Wall-clock is the slowest single *chain*, not the sum of slowest-per-stage. A barrier is allowed only for a genuine cross-item reduce.

The reasoning is Amdahl's: an unnecessary barrier converts parallel work into serial work at the join, and the penalty scales with the spread between fastest and slowest item. If five finders run and the slowest takes 3× the fastest, a needless barrier idles the fast ones for two-thirds of their runtime.

> Gene M. Amdahl, *Validity of the single processor approach to achieving large scale computing capabilities*, AFIPS 1967 — the serial-fraction bound.
> Scatter-gather / fan-out-fan-in as an execution pattern: Jeffrey Dean & Sanjay Ghemawat, *MapReduce: Simplified Data Processing on Large Clusters*, OSDI 2004.

### 3 · Adversarial verification — diversity beats redundancy

A finding is not reported because an agent produced it. It is reported because independent skeptics **tried to refute it and failed**. Verifiers are prompted to refute and to default to refuted when uncertain, and majority refute kills the finding.

Where a finding can fail in more than one way, the verifiers get **distinct lenses** (does the cited evidence exist / is it a defect against the contract / is the severity right) rather than being three identical refuters. Three different questions cover more failure surface than the same question three times.

> Using a model to evaluate model output — the "LLM-as-a-judge" line of work, e.g. Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*, NeurIPS 2023 (Datasets & Benchmarks).
> Sampling multiple independent reasoning paths and taking the majority: Wang et al., *Self-Consistency Improves Chain of Thought Reasoning in Language Models*, ICLR 2023.

This project's own build supplied a cautionary data point: a dedup step once merged two differently-phrased reports of the same defect, the skeptics split across the pair, and one genuinely broken file was very nearly reported as clean. **Redundant voting is only as good as the deduplication feeding it** — which is why the rule is now to keep near-duplicates separate and let them be judged twice.

### 4 · Right model for the right job

Every node carries a `taskType`. The `ROUTES` block maps `taskType + mode` to a model and effort: mechanical enumeration to the cheapest capable tier, implementation to the middle, judgment and adversarial verification to the top. Two override modifiers cut across it — **wide fan-out pushes a tier down** (budget governs when per-item judgment is small and multiplied 300×), **high downstream error-cost pushes a tier up** (accepting a wrong result costs far more than the check).

Three modes expose this as one dial: `lite`, `balanced` (default), and `all-out`. The canonical `ROUTES` block defines their model, effort, and width settings. The old names `optimize` and `full` remain compatibility aliases for `balanced` and `all-out`. See [execution-modes.md](../../.claude/skills/loop-engine/references/execution-modes.md) for the exact contract.

> The economics are the classic *cost-sensitive learning* trade-off: the loss matrix is asymmetric, so the optimal decision threshold is not the accuracy-maximising one. Charles Elkan, *The Foundations of Cost-Sensitive Learning*, IJCAI 2001.

### 5 · Human gates — the loop proposes, a person disposes

Phases end at gates. At a gate the run **stops**, presents its deliverable and its ledger, and waits. The autonomous loop opens **draft PRs and never merges**. The autonomy ladder (OBSERVE → VERIFY → SUSTAIN → SCALE) makes the progression explicit, and its safety property is that it **degrades downward**: any alarm drops it a rung, and the floor is always propose-only.

> Phase-gate review as a delivery discipline: Robert G. Cooper's Stage-Gate model (1986 onward).
> The lifecycle framework shipped here is [AIDLC](../../.claude/skills/loop-engine/frameworks/AIDLC.md) — Inception → Construction → Operation, each ending at a gate.

### 6 · Duplication as a rule, not an apology

The `ROUTES` block is copy-pasted byte-identically into every routed template. This is normally a smell. Here it is the **only expressible form**: the execution sandbox has no module system and no filesystem, so an import cannot be written.

The design's response is to make duplication *governed* rather than merely tolerated — one source of truth, drift is a defect, and a CI check that extracts the canonical block and diffs every copy against it. **When a constraint makes the clean form impossible, name the constraint and mechanise the workaround.** Untended duplication rots; checked duplication does not.

### 7 · The gate must be able to fail

A validation step nobody has ever seen fail is not evidence. The host's `plugin validate --strict` passes on this repo and never opens a `SKILL.md` — which is how two skills once shipped with frontmatter no YAML parser would load, through every check the project defined.

`scripts/validate.mjs` is the response, and it was accepted only after being **mutation-tested**: a deliberate `performance.now()` injected into a template made it fail, correctly. A gate is credible when you have watched it reject something.

> The principle is mutation testing's: a test suite is measured by the faults it *catches*, not by the code it covers. Richard A. DeMillo, Richard J. Lipton & Frederick G. Sayward, *Hints on Test Data Selection: Help for the Practicing Programmer*, IEEE Computer, 1978.

---

## Standards this architecture follows

| Standard | Applied to |
|---|---|
| **C4 model** — Simon Brown, [c4model.com](https://c4model.com) | These diagrams. Levels 1–3; Level 4 deliberately skipped |
| **Diátaxis** — Daniele Procida, [diataxis.fr](https://diataxis.fr) | Doc-type separation across the repo; `loop-docs` applies it |
| **Semantic Versioning 2.0.0** | The plugin version. 1.0.0 freezes skill names and flag surface |
| **Keep a Changelog 1.1.0** | `CHANGELOG.md` |
| **MADR** | Architecture decision records; `loop-design` ships the template |

Every skill additionally carries a version-pinned `references/standards.md` naming the authoritative standards *it* applies — OWASP / CWE / ASVS for review, SLSA / CycloneDX / in-toto for release, Google SRE for operations, and so on. Those shelves distinguish **ratified standards** from **somebody's opinion**, because the two are cited differently, and each carries a confirmation log recording what was verified against a primary source and when.

---

**Read next:** [Context (Level 1)](context.md) · [Container (Level 2)](container.md) · [Component (Level 3)](component.md) · [The skill fleet](skills.md) · [Skill anatomy](skill-anatomy.md) · [Design records](../design/README.md)

</details>
