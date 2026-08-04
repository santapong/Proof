# Comprehension traps — how understanding work convinces and is still wrong

Comprehension deliverables fail differently from code: nothing crashes. A wrong map reads exactly like a right one, gets cited by the next document, and misleads every reader until someone's change fails against the real system. Each trap below names its detection signal — the thing a reviewer can check — before its fix, in the fleet's detection-signal-before-fix shape.

## 1. The README map

**The trap:** the architecture section is assembled from the README, the directory names, and an old diagram — the system as *intended*, at some point, by someone.

**Detection signal:** boxes and arrows with no `file:line` citations; a map that could have been drawn without cloning the repo.

**Fix:** the router's non-negotiable — every element cites evidence; documentation may only *corroborate* what an artifact shows. Where docs and code disagree, the code wins and the disagreement is reported as drift (`architecture-recovery.md` §3).

## 2. The directory-equals-component fallacy

**The trap:** each top-level directory becomes a box, and the map inherits the repo's *filing system* instead of its structure. Directories are a hypothesis about the decomposition; the import graph is the fact, and in aging repos they diverge — the "isolated" module that half the codebase deep-imports is the classic.

**Detection signal:** the component diagram is isomorphic to `ls`; no boundary claim in the deliverable carries a grep that tested it.

**Fix:** the one-grep boundary checks (`architecture-recovery.md` §Boundaries). A box earns its border by surviving its check; otherwise it is drawn dashed and labeled for what it is.

## 3. Confident recovered history

**The trap:** a recovered ADR states a plausible rationale as fact. It forecloses re-examination — a future reader treats "chosen for throughput" as settled when it was a guess — and one exposed fabrication discredits the evidenced recoveries beside it, the same dynamic as a fabricated shelf pin.

**Detection signal:** a recovered ADR with no confidence grade, or with an "evidenced" grade whose evidence section contains no quotable source.

**Fix:** the evidence/inference split and the three grades (`decision-recovery.md`). "Rationale unrecoverable" is a publishable result.

## 4. The single-path generalization

**The trap:** one trace, taken under one config, one tenant shape, one flag state, presented as *how the feature works*. Every indirection on the path was resolved to one value; other deployments resolve differently, and the trace silently doesn't apply.

**Detection signal:** a trace that never states which selections it made at its indirections; the words "always" or "the" where the code has a strategy table.

**Fix:** record the selector value at every resolved indirection and name the unfollowed branches (`feature-tracing.md` §Presenting). One path fully cited beats three paths half-remembered — but it must say it is one path.

## 5. The unverified operational quote

**The trap:** the dossier's "how to build and run" section quotes the README. The README's steps rotted two toolchain versions ago; the dossier launders that rot into a fresh, trusted document — strictly worse than the README, because it looks recently checked.

**Detection signal:** operational sections with no captured command output; install steps identical to the README's, word for word.

**Fix:** execute during recovery, paste the real commands and real output, and date them (`architecture-recovery.md` §Dossier item 5).

## 6. Coverage silence

**The trap:** the map is presented without saying what was read, sampled, or skipped. The reader assumes whole-repo coverage; the author sampled three directories. Silent truncation reads as full coverage — the same defect the engine's `log()`-what-a-cap-drops rule exists for, landing in prose instead of a workflow.

**Detection signal:** no coverage statement; a reviewer cannot answer "was `vendor/`-adjacent custom code looked at?" from the deliverable.

**Fix:** the router §6 statement, always, with per-claim evidence class (runtime / static / inferred). It is one paragraph and it converts every later surprise from "the map was wrong" into "the map said it didn't look there."

## 7. Comprehension creep

**The trap:** the recovery quietly becomes something else — a redesign proposal (the map's gaps are so *fixable*), a bug hunt, a refactoring pass. The comprehension deliverable arrives late and opinionated, and the redesign arrives without the discipline its own skill would have enforced.

**Detection signal:** the dossier contains "should" — recommendations with no evidence obligation — or uncommitted edits appear in the repo being mapped.

**Fix:** the boundary is the deliverable. Findings that point elsewhere are *recorded as handoffs* — re-decisions to `loop-design`, defects to `loop-debug`, doc rot to `loop-docs` — and the recovery stays read-only. One list of handoffs at the end of the dossier is the sanctioned outlet.

## 8. The stale dossier

**The trap:** a dossier is treated as durable documentation. It is a *dated snapshot* of a moving system — accurate the day it was written, silently less so every merge after, with nothing forcing a re-check. The failure is not writing it; it is shelving it undated where `loop-docs`' rot mechanisms never see it.

**Detection signal:** a dossier with no as-of date or commit hash; a dossier older than the repo's last structural change still being handed to newcomers.

**Fix:** stamp every deliverable with the commit it describes (`as of a1b2c3d, 2026-08-04`). If it should live longer than a snapshot, that is a maintained document — hand it to `loop-docs`, whose doc-type rot catalogue owns the keeping-it-true problem.
