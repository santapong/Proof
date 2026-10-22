# Comprehension Rot

The one cost this plugin's other guards don't touch. Budget floors, dedup, and
`safeToPropose` all fail *loudly* — a run stops, an item gets dropped, you can see it
in the log. Comprehension rot doesn't: the gap between what the loop has shipped and
what you actually understand grows in silence, because nothing ever forces you to look.
A human rubber-stamping merges without reading the risk memo is still AP1 (Nodding
Loop) — it's just the anti-pattern living in the reviewer instead of the loop.

The fix is not "try to review more carefully." That's a resolution, not a mechanism,
and resolutions decay under load exactly when the loop is running well and volume is
high. The fix is a mechanism that makes the rot visible if it's happening.

## The mechanism: forced random sampling, not recency

A digest that shows you the *last* 3 merged PRs tests nothing — you skimmed those
already, or they're too recent to reveal a pattern. Sample **uniformly at random**
from everything the loop has merged in the window, so the digest can surface something
from three weeks ago you've genuinely forgotten.

## Weekly digest — what it does

Runs on a schedule (weekly; tune to your merge volume), separate from the improvement
loop itself. Shipped as a copy-paste Routine prompt at
`templates/comprehension-digest.routine.md` — a **live** Claude session does the random
sampling, which is why this is a Routine prompt rather than a `.workflow.js` template
(workflow scripts can't call `Math.random()` — harness policy H10).

1. **Query** all PRs opened by the loop in the trailing 7 days (filter on the
   `automated` label applied at creation — see `deployment.md`). Bucket by outcome:
   `merged`, `merged-with-changes`, `closed-unmerged`, `still-open`.
2. **Sample** 3 items uniformly at random from the `merged` + `merged-with-changes`
   buckets (skip the sample if fewer than 3 exist — don't pad with recent ones).
3. **Post** a new issue, `🔍 Weekly comprehension check — <date>`, labeled
   `comprehension-check`, containing:
   - The bucket counts for the week (the stats, not just the sample).
   - The 3 sampled PR links, each with one open question to force actual reading —
     not "did you review this?" but something that can't be answered without opening
     the diff, e.g. *"what would break if this PR were reverted?"*
4. **Do not auto-close it.** It closes when a human answers the three questions in a
   comment and closes it themselves.

## Why an unanswered issue is the point, not a bug

This is the load-bearing design choice: the digest issue is deliberately a nuisance if
ignored. An accumulating count of open `comprehension-check` issues is a visible,
countable signal — `open comprehension-check issues > 2` means the loop has been
running unread for weeks, and now you can *see* that number instead of only
discovering it the day something the loop shipped turns out to be wrong. Comprehension
rot converted from silent to loud is the entire fix; the three questions are just what
make "answering" require actually opening the diff instead of clicking close.

## The drift the guards can't see — six trends the digest reader owns

The guards behind AP1–AP7 (`anti-patterns.md`) operate per item or per run; none of
them sees the *distribution* of proposals. A loop can pass every guard on every item and
still be degrading, because the only reward that crosses the human gate is
**mergeability** — and the cheapest route to mergeability is small, safe, familiar work.
Each such proposal is individually fine; the rot lives only in the week-over-week trend,
and no in-band guard can hold a trend: AP7's coverage archive deliberately dies with the
run (`anti-patterns.md`), leaving the PR record as the only cross-run memory. That
record is exactly what this digest already queries, so the digest reader is the only
component positioned to catch these. Everything below plots from data the loop already
emits — the `automated` and `kind:*` labels, the `low`/`medium`/`high` rating in the
risk memo that *is* the draft PR body (`routine-prompt.md`), and the diff stats and file
lists GitHub computes on every PR. No new instrumentation; the cost is six numbers a
week.

| # | Drift | Plot weekly, over `automated` PRs | Benign reading | Degraded reading |
|---|---|---|---|---|
| D1 | Shrinking diff | Median additions + deletions per merged PR | Steps down after early big-rock cleanups land, then holds | Monotonic decline across weeks while intake volume holds — the loop learned small is safe |
| D2 | Doc-only streak | Share of merged PRs whose file list touches only documentation | A docs backlog burning down, then the share falls back | Consecutive weeks near-total doc-only while code issues sit open in intake |
| D3 | Same-file fixation | Distinct top-level paths touched; share held by the single most-touched | Intake genuinely concentrated — one module's bug run | Concentration persists after that module's issues close; AP7 keeps *runs* diverse, nothing keeps *weeks* diverse |
| D4 | Trust accretion | Median open→merge time; share merged with zero review comments | Stable and nonzero | Both trending toward instant / zero — AP1 arriving via the loop's earned reputation, in you |
| D5 | Risk-class migration | Mix of `low`/`medium`/`high` memo ratings on proposed PRs | Tracks the actual work mix, `medium` present when the work is | `medium` vanishes entirely — safety or timidity, and only the trend plus D6 says which |
| D6 | Cheap-but-mergeable | Per `kind:*` label: trustWeight rank vs median diff size | No relation between trust and size | Highest-trust kinds are also the smallest-diff kinds, and the gap widens — the ledger is teaching the loop that trivial merges best |

## What each trend adjusts — and what it must not

The wrong response to every row is punishing the symptom: "demand bigger diffs" is
Goodhart with the sign flipped, and the loop will comply with padded diffs. Adjust the
pressure that produced the trend.

- **D1 / D2** — first read the run's coverage archive, which travels out with each
  run's result: its `blocked` / `triaged-out` outcomes (`anti-patterns.md`, AP7 fix)
  show whether substantive work was *attempted* and died in Verify — a
  verifier-calibration or model-capability problem (`anti-patterns.md`, capability
  gating), not timidity. Only if it was never attempted, seed one explicitly scoped
  non-trivial item through the opt-in label and watch what triage does with it.
- **D3** — seed the opt-in label onto issues in the neglected areas. AP7's frontier
  machinery is not the fix here — it never sees past the current run; cross-run
  narrowing is yours to correct through intake, and the trend is the only instrument
  that shows it.
- **D4** — the countermeasure is already priced into this file: the three questions on
  the random sample, and the open-issue count as the alarm (see "Why an unanswered
  issue is the point" above). `deployment.md` already refuses SCALE while open
  `comprehension-check` issues sit above threshold — that gate exists for exactly this
  row. Don't add process; answer the questions or accept the count.
- **D5** — this row has teeth under SCALE: a `high` memo is what hard-blocks auto-merge
  (`deployment.md` NEVER-list, re-checked by `canary-merge.workflow.js`), so a memo
  scale drifting toward all-`low` is quietly widening the loop's own auto-merge
  surface — the widening comes from would-be-`high` work rating lower. Cross-read with
  D6 and with what Verify blocked to split safety from timidity. Never lower Verify's
  bar to make `medium` reappear.
- **D6** — the ledger reweighting rule. `trustWeight = (merged + 0.5 ×
  mergedWithChanges) / proposed` (`credit-horizon.md`) counts a doc-typo merge and a
  hard bug fix identically, so once the deferred read side is wired, ease-of-merging
  becomes selection pressure. If D6 shows: recompute the affected kind's numerator
  excluding trivial-class merges (doc-only, sub-threshold diffs) — or leave the read
  side unwired until it clears. The advisory-not-filter rule in `credit-horizon.md` is
  the existing floor; do not cross it while D6 is live.

### Wiring — one stats block, computed where the data already is

The digest Routine already holds the week's full `automated` PR list when it computes
the bucket counts (step 1); appending the six D-numbers under those counts costs
nothing extra. A trend nobody computes is a trend nobody reads. Two constraints: the
*direction* is the signal, so the Routine should also pull the prior
`comprehension-check` issues (they carry earlier weeks' numbers) and state each D as
rising / flat / falling, not a bare level; and the numbers ride the existing issue —
no dashboard, no new storage, for the same reason the ledger lives in an issue body.
One week of any D means nothing. The catalogue's readings only apply to a run of
weeks, which is exactly why this lives in the digest and not in a guard.

## Implementation note

Reuses the same `github` MCP tools as the rest of the plugin (`search_issues` /
`list_pull_requests` filtered by label and merge date, `create_issue`). No new
infrastructure — deploy as a second, lighter-weight Cloud Routine alongside the main
improvement loop (`deployment.md`), triggered on a weekly schedule rather than
`pull_request` events.
