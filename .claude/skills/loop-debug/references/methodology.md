# Debugging Methodology

The full procedure behind the `loop-debug` skill: turn a symptom into a confirmed root cause through a disciplined loop — reproduce, observe, localize, scan the bug classes, and confirm by toggling. The engine is not a hunch; it is a chain of evidence where each step narrows the search space and the last step *proves* causation. **A fix shipped without a confirmed root cause is a guess, and this skill exists to replace guesses with a cause you can turn on and off at will.** When the loop runs at scale (many hypotheses, a wide bisect, parallel instrumentation), its orchestration is governed by the `loop-engine` skill's harness and loop policies.

## Step 1 — Reproduce

You cannot debug what you cannot trigger. Before touching the code, get the bug to happen on demand.

- **Minimize the repro.** Strip the failing scenario to the smallest input, shortest path, and fewest steps that still fail. Every element you remove without the bug disappearing is a variable eliminated. A one-line repro localizes faster than a full end-to-end scenario.
- **Make it deterministic.** An intermittent bug is an uncontrolled variable, not a mystery. Pin the seed, freeze the clock, serialize the concurrency, fix the input ordering — whatever makes failure happen every run, not one in ten. If it only fails 1-in-N, that flakiness *is* a clue (points at async/race/ordering — see Step 4).
- **Pin the environment.** Record and lock the versions, config, env vars, feature flags, data fixtures, and OS/runtime that produce the failure. "Works on my machine" is almost always env drift; capture the env now so you can compare against a working one later.

**The repro is the ground truth for the whole loop — if it isn't deterministic, every later step is measuring noise.**

## Step 2 — Observe

Read what the failure is already telling you before you form a theory.

- **Read stack traces bottom-up to the first frame in your code.** The top frame is often deep in a library where the error surfaced, not where it originated. Walk down (or up, depending on your runtime's ordering) to the first frame you own — that is where your code handed bad data or made a bad call. Note the exact exception type and message; "undefined is not a function" and "connection refused" send you to completely different bug classes.
- **Diff the logs of a good run vs a bad run.** Capture output from a passing case and the failing case, then diff them. The point where they diverge is the point where behavior went wrong — that line number is your first localization anchor. If logging is too sparse to show the divergence, that gap is what Step 3 instrumentation fills.

**Let the evidence pick the hypothesis; don't pick a hypothesis and hunt for evidence — confirmation bias is the most expensive bug in debugging.**

## Step 3 — Localize

Narrow "somewhere in the system" down to a specific line or state transition. Pick the technique that fits what you know.

### git bisect — for regressions ("it used to work")

When the bug is new and you have a known-good and known-bad commit, binary-search the history:

```
git bisect start
git bisect bad                 # current commit is broken
git bisect good <old-sha>      # this commit worked
# git checks out the midpoint; test it, then mark:
git bisect good                # or: git bisect bad
# repeat until git prints "<sha> is the first bad commit"
git bisect reset               # restore your original HEAD
```

Automate it when the repro is scriptable — `git bisect run ./repro-test.sh` (exit 0 = good, non-zero = bad) drives the whole search unattended and lands on the exact culprit commit in `log₂(n)` steps. The diff of that commit is your suspect.

### Binary search by disabling code paths

No clean commit boundary? Bisect the *code* instead of the history. Short-circuit half the suspect region — early-return, comment out, feature-flag off, stub the dependency — and re-run the repro. Bug gone → it lived in the half you disabled; bug remains → it's in the other half. Halve again. Each round doubles your resolution.

### Instrumentation — logging & breakpoints

Make the invisible state visible at the boundaries Step 2 flagged. Log or breakpoint the inputs and outputs of the suspect function: assert what you *believe* is true at that point and watch where reality diverges from belief. Log values, not just "reached here" — a wrong value is the finding; a reached line is only a location. Prefer a conditional breakpoint (`when x == null`) over stepping through thousands of iterations.

### Rubber-duck the data flow

Trace the bad value backward by explaining, out loud or in writing, exactly how the data reaches the failure point: where it's created, every transform it passes through, and what each step assumes about it. The step whose assumption the data violates is the bug. This is often faster than any tool because it forces you to state assumptions you'd otherwise skip past.

**Every localization technique is binary search in disguise — each move should roughly halve the space you still have to search, or you're poking, not localizing.**

## Step 4 — Scan the common bug classes

With the region localized, pattern-match against the classes that produce most bugs. Scan the suspect code against this checklist rather than working from memory — the class points you at the specific line and the confirm test:

- **Off-by-one** — `<` vs `<=`, loop bounds, slice/substring indices, fencepost counts, inclusive vs exclusive ranges.
- **Null / undefined** — unguarded access on a value that can be absent; missing return producing `undefined`; optional field assumed present.
- **Type coercion** — `"1" + 1`, truthy/falsy surprises (`0`, `""`, `[]`), loose equality, implicit string↔number conversion, JSON round-trip changing types.
- **Async / race / ordering** — unawaited promise, callback fired out of order, two writers to one resource, assuming sequential execution of concurrent work. (Suspect this first if Step 1 couldn't make the repro deterministic.)
- **State mutation / shared state** — a shared object mutated in place, aliasing, a cached reference changed under a reader, a default argument reused across calls.
- **Boundary / empty input** — empty list/string/map, zero, negative, single-element, max size, the first or last iteration, unicode/whitespace.
- **Error swallowing** — an empty `catch`, a discarded error return, a `finally` that overrides the throw — the real failure hidden upstream of the symptom you see.
- **Config / env drift** — a value that differs between the working env and the broken one: a flag, a path, a locale, a timezone, a credential, a default. (Compare against the env you pinned in Step 1.)
- **Dependency version** — a transitive upgrade, a lockfile change, a breaking minor, an API that changed behavior between versions.
- **Caching / staleness** — a stale read, an unindexed invalidation, a memoized value that outlived its inputs, a CDN/build artifact serving the old version.

**Match the symptom to a class to get a testable hypothesis — the checklist's job is to convert "something's wrong here" into "I bet it's X, and here's how I'll prove it."**

## Step 5 — Confirm the root cause

A localized line is a *suspect*, not a cause. You have the root cause only when **you can turn the bug on and off by toggling the suspected cause and nothing else.**

- Apply the minimal change that would fix the suspected cause → the repro passes. Revert it → the repro fails again. Re-apply → passes. That on/off/on control is proof of causation; anything less is correlation.
- If toggling the suspect does *not* cleanly switch the bug, you have the wrong cause (or only one of several) — return to Step 3 with what you learned. Do not "fix" a correlated symptom.
- Beware the fix that masks: silencing the error or special-casing the failing input can make the repro pass without addressing the cause. The test is whether the *mechanism* you identified explains every observation from Step 2, not just whether the symptom disappeared.
- Once confirmed, write a regression test that fails on the old code and passes on the fix — it locks the toggle in place so the bug can't silently return.

**"The symptom went away" is not confirmation; "I can make it come back and go away at will" is.**

## Worked example

**Symptom.** A report-export endpoint that worked last week now returns an empty CSV for some users, intermittently. No error in the response; a 200 with a header row and no data rows.

**Step 1 — Reproduce.** The intermittency is the first clue. Trying user IDs, it fails deterministically for users whose account has *zero* orders in the selected range and passes for users with orders — the "intermittent" was just which user happened to be tested. Minimal repro: `GET /export?user=<no-orders-user>&from=2026-06-01`. Env pinned to current `main`.

**Step 2 — Observe.** No stack trace (it's a silent-empty, not a crash). Diffing logs of a good user vs the empty one: both log `fetched N orders`, but the empty user logs `fetched 0 orders` then `wrote 0 rows` — expected — yet last week the same zero-order user got a valid (header-only) file that downstream tooling accepted. So the behavior *changed*; this is a regression.

**Step 3 — Localize (bisect).** Known-good = last week's release tag, known-bad = `main`. `git bisect start; git bisect bad; git bisect good release-2026-06-24`, then `git bisect run ./repro-export.sh`. It lands on a single commit: a refactor of the CSV writer that "cleaned up" the header logic.

**Step 4 — Bug class.** The culprit diff moved the header-write inside the `for row in rows:` loop. Bug class: **boundary / empty input** — with zero rows the loop body never executes, so the header is never written, so the tooling that expected at least a header row rejects the file.

**Step 5 — Confirm.** Hoist the header-write back above the loop → repro returns a header-only CSV, tooling accepts it. Revert the hoist → empty file again. Re-apply → fixed. The toggle switches the bug cleanly: root cause confirmed. Lock it with a regression test asserting a zero-order export still contains the header row.

## Anti-pattern catalogue — the habits that feel like debugging

Steps 1–5 are the loop; these are the seven most common ways to exit it while still feeling busy. Each anti-pattern survives because it manufactures the *sensation* of progress — motion, output, a symptom gone quiet — while spending the one thing a debugging session cannot refund: the information the failure was carrying. The third column is the argument; price it before the second column tempts you.

| Anti-pattern | Why it feels productive | The real cost | The discipline that replaces it |
|---|---|---|---|
| **Shotgun debugging** — change several suspects at once and re-run | Every run visibly "does something", and when the bug disappears you feel finished. | When it "works" you learned nothing: you cannot say which change mattered, so the noise ships with the signal — dead edits future readers will treat as load-bearing — and the cause still has no name. When the bug recurs, you restart from zero, minus the trust of whoever reviewed the shotgun diff. | One variable per run. Step 5's on/off/on toggle *is* the anti-shotgun: a fix you cannot switch alone is not a fix, it is a coincidence you happened to be present for. |
| **Fixing the symptom** — the null check at the crash site | The stack trace goes quiet immediately; the ticket closes today. | The defect that produced the null still runs upstream, now silently. It resurfaces later as corrupt data or a different crash — minus the loud stack trace that used to localize it. You traded a cheap bug for an expensive one and called it a fix. | Trace the bad value back to where it was *created*, not where it was noticed (Step 3's rubber-duck of the data flow; `../SKILL.md` §5 owns this rule), and heed Step 5's masking warning: the mechanism must explain every observation, not just silence one. A guard at the crash site is defense-in-depth *in addition to* the upstream fix, never instead of it. |
| **The Heisenbug trap** — attach a debugger or add logging to a race, and it vanishes | The tooling is clearly doing work, and a bug that stops happening reads as fixed. | The probe changed the timing, so the race hid — it is still there, now scheduled for production, where your probe isn't. Worst case, you conclude the logging *was* the fix and ship it as one. | **Capture, do not interrupt** — the Heisenbug mitigation below. And treat probe-sensitivity itself as evidence: a bug that retreats when observed has just confessed to Step 4's async/race/ordering class. |
| **Confirmation-bias localization** — instrument only where you already believe the bug is | Every observation "fits", so conviction compounds with each probe. | None of the probes could have said you were wrong, so hours of accumulating evidence carry zero discriminating information — and the true site goes unexamined for exactly as long as your conviction holds. | Spend at least one probe where a signal would appear *if the bug were elsewhere* — a probe no outcome of which could kill your suspicion is not evidence. This is only the localization face of the disconfirming-test discipline; `hypothesis-testing.md` §6 owns it. |
| **Blaming the platform** — "the compiler / library / OS is broken" | The search ends instantly, and the defect isn't yours. | The bug is almost never in the platform — those layers run under vastly more usage than your code ever will — so the search closes at the exact moment it should narrow. A workaround ships against a phantom, the real defect stays, and team lore now says the platform did it, poisoning the next investigation too. | Earn the claim before making it: (1) read the documented contract — most "compiler bugs" are undefined behavior, a misread API contract, or Step 4's config/env-drift or dependency-version classes; (2) reduce to a minimal repro with your code removed; (3) reproduce it on a second version or machine. Only then file it — a minimized, filed platform bug is a valuable artifact; an unproven accusation is a closed search. |
| **Closing on "cannot reproduce"** | The queue shrinks and nothing is provably wrong today. | "Cannot reproduce" is a statement about your harness, not the bug. The defect fires again on a user's machine, and the second occurrence arrives exactly as diagnosable as the first — which is to say, not at all — because nothing was left behind to catch it. | Never close an intermittent defect without a detection tripwire in place — the intermittent-defect protocol below. |
| **Fix without regression test** — patch merged, no test that fails on the old code | The fix is "obviously right", and the test feels like ceremony after the real work. | The defect *class* returns — the next refactor reintroduces it, and nothing fires. The second occurrence costs the entire Steps 1–5 loop again, paid by someone without your context, which is the most expensive way to buy the test you skipped. | Step 5 already makes the failing-then-passing test part of confirmation, not an afterthought: it locks the toggle in place. Authoring it is `loop-test`'s job (`../SKILL.md` §6); a fix PR without one is an unconfirmed fix. |

**Every row is the same trade: the anti-pattern buys today's comfort with tomorrow's full-price re-investigation — and the discipline column is always cheaper than paying the loop twice.**

### The Heisenbug mitigation — capture, do not interrupt

The trap is any observation that *pauses, blocks, or reorders* the program: a breakpoint that freezes one thread while others run on, synchronous logging that adds I/O to the hot path, a print that flushes and yields. Each one reshapes the interleaving that the race needs, so the act of looking hides the thing you are looking for.

Replace interruption with capture — observation whose cost is too small and too uniform to move the schedule:

- **Ring buffer, flushed after the fact.** Append fixed-size records to a preallocated in-memory buffer on the hot path; write them out only after the failure fires. Timestamps and raw values now, formatting later.
- **Counters and flags over breakpoints.** An atomic counter or a set-once flag records that state changed without pausing any thread. A hardware watchpoint is cheap only until it fires — then it traps and stops the world exactly like a breakpoint — so watchpoints and breakpoints belong on the replay or the post-mortem, never on the live run.
- **Record and replay.** Capture the execution once (a record/replay tool, or event-sourcing the inputs at the boundary) and debug the *recording* at leisure — breakpoints on a replay have zero probe effect on the schedule that failed.
- **Crash-scoped dumps.** Let the failure itself trigger the evidence: core dump, buffer flush, state snapshot on the assertion. The program runs undisturbed right up to the moment it has already failed.

**If adding a probe makes the bug rarer, do not remove the probe and shrug — log it as a finding: the bug's sensitivity to timing is Step 4's race class raising its hand.**

### The intermittent-defect protocol

Step 1's answer to intermittence is to make it deterministic — pin the seed, freeze the clock, serialize the concurrency. This protocol is for the residue: the defect that resists determinization within the time you have. The rule is absolute: **never close on "cannot reproduce" without a tripwire left behind.**

A tripwire is instrumentation that turns the *next* occurrence into a complete evidence capture instead of another anecdote:

- **An assertion on the suspected invariant** at the narrowest point the evidence allows — when it fires, it names the state that was impossible.
- **A targeted, capture-style log** (per the Heisenbug mitigation above) carrying enough context — inputs, ids, the values Step 2 would want to diff — to run the observe step from a single occurrence.
- **A counter or alert on the symptom's signature**, so recurrence is detected by the system rather than by whichever user hits it next.

Then close the ticket honestly: the status is *instrumented, awaiting recurrence* — not *resolved*, and never *went away*. The asymmetry is the whole argument: if the tripwire never fires again, it cost a few lines; if it fires, it has already done Step 2 for you, on the one run you could never schedule.

**"Cannot reproduce" is a permissible state for a bug; it is not a permissible final state for an investigation that left nothing watching.**

## Depth control

- **Shallow bug** — obvious symptom, small blast radius, one plausible cause: run the loop inline, often collapsing Steps 3–5 into a single instrument-and-toggle. Don't spin up a workflow for a typo.
- **Deep / wide bug** — many plausible causes, a large history to bisect, or reproduction that itself takes real effort: run hypotheses as a `loop-engine`. Fan out one investigator per candidate cause (parallel, harness policy H2's earned barrier before you converge), have each *try to disprove* its own hypothesis (adversarial verify, harness policy H4 — a suspect no investigator can toggle survives as the cause), and treat "no hypothesis confirmed" as a real, reportable outcome rather than forcing a fix (H5 nulls). If new evidence keeps reshaping the hypothesis set, loop the observe→localize cycle until two consecutive rounds add no new suspect (loop-until-dry, loop policy L1) rather than stopping at a fixed number of tries. See the sibling `loop-engine` skill and its `templates/parallel.workflow.js`.
