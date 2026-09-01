# The evidence gate — phase 5

This is the phase the ported vocabulary did not have. Everything else in this skill is standard research process; this file is why the skill is worth shipping.

**The claim it defends: a result nobody re-derived is a claim, not a finding.** Not "probably wrong" — *unverified*, which is a different and more dangerous state, because an unverified result looks exactly like a verified one on the page.

## Why a review step is not a gate

The natural instinct is to put a reviewer at the end and call it quality control. That fails for a specific, mechanical reason: **the reviewer reads the artifact the study produced, and the artifact is where the error lives.** A number that never came from the run is perfectly legible, correctly formatted, and consistent with the surrounding prose. Reading harder does not find it.

The gate has to do something the reviewer structurally cannot: go back to the raw data and recompute.

## Check 1 — re-derivation

**Every number in the report is recomputed from the raw artifacts by a step that did not produce it.**

The separation is the whole point. If the same process that ran the experiment also reports its results, "reporting" is just formatting, and a formatting step cannot detect a fabrication upstream of itself.

Practically:

- Raw artifacts are on disk before the report exists — logs, exit codes, full stdout, the timestamped run directory.
- The re-derivation step reads *those files*, not the run's own summary object, and not the executing agent's memory.
- Each reported figure gets an explicit source: file, and where in it.
- **A figure that cannot be re-derived is struck from the report.** Not hedged, not softened with "approximately" — removed, and its absence noted.

### The recitation failure

The strongest reason to separate re-derivation from execution is that an agent will confidently report values it never computed, when those values are available in its context from any other route — a prior run, a memory file, a document in the repo, the conversation itself.

This is not hypothetical, and it is not rare. An agent asked to run a seven-step verification chain and report the results returned a complete, perfectly formatted report — every figure correct — in **3.7 seconds with a single turn and no tool calls**. The suite it claimed to have run takes 33 seconds on its own. The values were correct because they were written in a project memory file loaded into its context. Nothing in the report itself distinguished it from a real run.

Two defences, both cheap:

- **Grade on values that cannot be recited.** A wall-clock duration, a fresh timestamp, a per-item breakdown that changes run to run. If the expected answer is documented anywhere the agent can see, it is not evidence.
- **Check that execution happened at all** before comparing anything. Duration and turn count against a floor derived from the work itself. Note the calibration trap: a threshold set by intuition rejects valid runs — a "fewer than 5 turns means it did not execute" rule wrongly failed a genuine 4-turn, 118-second run. Derive the floor from what the work takes, and prefer a *freshly generated value* as proof over any count.

## Check 2 — mutation

**Break the mechanism under test. Confirm the study notices.**

A study that reports the same result with the mechanism disabled has measured something else — the harness, the baseline, the weather. This is the empirical form of a mutation-checked acceptance test, and it answers the question a passing result never can: *would this study have detected the absence of the effect?*

The procedure:

1. Snapshot the code or configuration under test. Keep a `.GOLD` copy — see the restoration trap below.
2. Disable or invert the mechanism the hypothesis is about.
3. Re-run the study.
4. **The result must change in the predicted direction.** If it does not, the study does not measure what it claims.
5. Restore from the `.GOLD` copy and confirm the original result returns.

### Traps this repo has hit

- **Never restore with `git checkout --` when the file under test carries your own uncommitted work.** It reverts to `HEAD`, not to your version, and every later mutation silently runs against the wrong code. Restore from the `.GOLD` copy. This invalidated an entire mutation round before it was caught.
- **Never target a mutation by line number.** A `sed -i '354s/...'` silently no-ops when the token has moved a line, and a no-op looks exactly like a surviving mutant — which reads as a tautological study and nearly got recorded as one. Match on a distinctive string.
- **An equivalent mutant is a real outcome, not a gap.** When two formulations are provably identical under the study's pinned conditions, say so. Do not invent a test that appears to kill it.

## Check 3 — the confound sweep

**Name what else could produce this number.** Each candidate is either ruled out with evidence or declared live in the report.

| Confound | How it fakes a result | Ruling it out |
|---|---|---|
| **Ordering / warm-up** | The first arm pays a setup cost the second inherits for free — caches, JIT, connection pools, model prompt caches | Alternate arm order, or measure with caches cold in both. Report cache-hit figures separately from totals |
| **Shape divergence** | The two arms did *different amounts of work*, so the totals are not comparable | Compare per-unit, not totals. A 16-turn arm against a 10-turn arm is not a measurement of anything |
| **Sample size** | n=1 makes run variance look like effect | Say `n` beside every number. If the effect is inside run-to-run spread, the verdict is *inconclusive*, not a percentage |
| **Vendor self-report** | The system under test reports its own savings, and counts things it did not cause | Measure from outside. Where the two disagree, the external number wins and the gap is the finding |
| **Selection** | Only the runs that worked got recorded | Pre-register how many runs, and report every one including the failures |
| **Shared state** | A prior run left data behind that changes this one | Fresh fixtures per run; verify the starting state, do not assume it |

### The cache confound deserves its own note

Prompt caches, page caches and warm connection pools make the *second* arm cheaper for reasons unrelated to the hypothesis. That bias runs in a specific direction — usually favouring whatever ran last — so state the direction explicitly. Break out cache-read figures separately, and if the arm delta sits inside the cache noise, the honest verdict is that the study did not resolve it.

### The self-report confound in practice

A study measured a compression proxy's effect on token usage. The arm difference looked like a 59% saving. The system's own telemetry claimed it had saved **$0.03**; the arm gap was **$0.29** — ten times larger. The gap was arm shape, not compression. Separately, its headline "49% saved" was dominated by a layer that restored a capability the proxy itself had disabled, counted as its own win. Two lessons, both general: **measure from outside the system under test**, and **decompose a headline number into layers before believing any of it.**

## Failure catalogue for this phase

| # | Defect | What it looks like | The check |
|---|---|---|---|
| 1 | **The tautological study** | Passes whether or not the mechanism works | Check 2. If mutation does not change the result, there is no study |
| 2 | **The recited result** | Correct numbers, no execution | Check 1, plus a freshly-generated value as proof of work |
| 3 | **Re-run until green** | The failed run is quietly repeated until it passes | Pre-register the run count; report every run |
| 4 | **The unowned delta** | A difference attributed to the hypothesis that the confound sweep never examined | Check 3, run before the writeup, not after review asks |
| 5 | **The vendor's number** | The system under test grades its own homework | External measurement; report both side by side when they disagree |
| 6 | **Verified-by-formatting** | A reviewer approved it, so it is treated as verified | Review is phase 6 and is not a gate. Only check 1 can make a number trustworthy |

## What a green gate does not mean

Passing all three checks means the mechanical failures are ruled out. It does not mean the hypothesis is true, that the effect generalizes beyond the pinned conditions, or that the sample is large enough to support the confidence the prose implies. Those are judgment calls, and they belong in the report as stated limits rather than being quietly absorbed by a passing gate.
