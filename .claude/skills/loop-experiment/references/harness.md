# Resource preparation and execution — phases 3 and 4

Phase 3 builds the apparatus. Phase 4 runs it and captures what happened. They are one file because the capture format is decided by the harness, not after it.

## The independence rule

**Ground truth is captured by a separate path from the run being graded.**

If the same code produces both the result and the standard it is graded against, the study is circular, and nothing downstream recovers it — not re-derivation, not review. This is the one property of the harness that cannot be fixed later.

In practice: capture the expected values with a direct, boring mechanism — a plain shell script, a direct query, a hand-computed value — *before* the graded run exists. The graded run then has to match something it had no hand in producing.

### Capture the detail, not just the verdict

A ground-truth capture that records only pass/fail throws away exactly what phase 5 needs. A capture script that recorded seven exit codes and sent stdout to `/dev/null` had to be re-run entirely, because the study's real oracle turned out to be the per-item counts inside the output it had discarded.

Capture: exit codes **and** full output, per step, to files. Storage is cheap; a second run of a 30-minute suite is not.

## Pinning

An unpinned experiment is an anecdote. Record, in the study directory:

- **Versions** — of the thing under test, its runtime, and every dependency that could plausibly move the number.
- **Seeds** — for anything stochastic. An unseeded run is not reproducible even by you.
- **Data digests** — a hash of the fixture set, not just its path. Paths lie when contents change.
- **Environment** — hardware, container image digests, relevant environment variables, and the ports and services the run depends on.
- **Wall-clock start and end**, so a later reader can correlate against external events.

Prefer a literal digest over a mutable tag. `postgres:16` is not a pin; the image digest is.

## Fixtures and starting state

**Verify the starting state; never assume it.**

- Fresh fixtures per run where the run mutates anything.
- Where a shared service is involved, confirm it is up and in the expected state as an explicit first step. A study once attributed five failures to the code under test when the actual cause was a database that was not running — the failures were connection refusals.
- Where a dev environment carries accumulated junk, use a clean instance. Dirty state produces failures that are correct behaviour on bad data and look exactly like regressions.

## Instrumentation

Measure from **outside** the system under test wherever possible. A system reporting its own improvement is a marketing claim with a JSON schema — record it, but never as the primary figure. Where internal and external numbers disagree, the external one is the result and **the disagreement is itself a finding**.

Decide before running:

- What is measured, in what units, at what boundary.
- The sampling rate, and whether the instrumentation itself perturbs the measurement.
- Which figures are *derived* rather than observed, and from what.

## Execution

Run it, and capture raw artifacts to a durable, timestamped directory.

**Capture, not summarize.** The phase 5 verifier reads these files independently of whatever the executing step believed happened. That is only possible if the files hold the full picture:

- Complete stdout and stderr per step, in files, not truncated to a tail.
- Exit codes, separately and explicitly.
- Timestamps around each step.
- The pinning manifest from above, in the same directory.

### Record the ugly parts

A run with an undisclosed re-run is not reproducible. Log retries, partial failures, anything abandoned mid-way, and any manual intervention. If the study needed a nudge to complete, that nudge is part of the method.

### Two execution traps

- **A command with no scope argument may collect far more than intended.** A bare test invocation with no path collected an entire repository, including the suite that invoked the runner — recursing until it was killed, and reporting the whole repository's verdict as that step's result. Any helper that shells out must refuse an empty target list.
- **Long-running work belongs in the background with its output on disk**, not held in a foreground buffer. It survives interruption, and the artifact is the same file phase 5 will read.

## Output of these phases

A study directory containing:

```
prereg.txt              the phase 2 pre-registration, written before any of this
manifest.txt            versions, seeds, digests, environment, timing
truth/                  ground truth, captured independently, with full detail
runs/<arm>/<n>/         per-run raw artifacts: stdout, stderr, exit codes, timings
notes.md                retries, failures, interventions — the ugly parts
```

Phase 5 reads `truth/` and `runs/` and nothing else. If the re-derivation step needs information that only exists in the executing agent's memory, the harness did not capture enough, and that is a phase 3 defect rather than a phase 5 one.
