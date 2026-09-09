# Software-team routing and handoff

Use this when an issue, requested change, or review needs a route through Proof. The
boundary audit remains the source of skill ownership; the stages below are a team's
delivery flow, not a new mandatory skill chain.

## Establish the minimum contract

Reuse the issue and repository's existing decisions before asking for more. Keep a
compact record with:

- **Owner and outcome:** the person or role responsible for the next handoff, issue or
  task pointer, expected behavior, and any explicit scope exclusions.
- **Acceptance evidence:** the observable result that will establish completion and
  its check or artifact. Preserve user and repository criteria; record unknowns.
- **Repository revision:** checkout/branch and commit, plus relevant uncommitted
  changes. A commit alone does not identify a dirty working tree.
- **Risk and rollback, when material:** affected interface, migration or operational
  impact, and how to recover. A reversible text edit needs only an appropriate note.

Existing roles and acceptance criteria are enough; this is a handoff record, not a
new approval ceremony. Recheck volatile state before acting on a stored contract.

## Issue → implementation → review/test → handoff

1. **Route the actual gap.** A reproducible bug normally fits `loop-debug`; it need
   not pass through architecture, orchestration, and documentation skills first.
   An unclear design decision may justify `loop-design`. An unfamiliar subsystem
   may justify a bounded `loop-comprehend` pass. Match each choice to the audit's
   checkable question and stop adding skills when the requested outcome is covered.
2. **Dispatch with evidence.** Pass the contract, relevant paths and reproduction
   or design decisions to the owner. Guide routes and manages handoffs; the routed
   skill or ordinary implementation session performs the change.
3. **Verify in proportion to the change.** Run repository-required checks and the
   checks that exercise changed behavior. A bug fix normally needs a reproduction
   and regression evidence; a text-only edit may need reference/link validation and
   inspection. Use `loop-test` when test design is a distinct need, `loop-review`
   for requested or materially useful review, and `loop-audit` for substantial
   impact analysis. Do not manufacture tests merely to add a stage.
4. **Hand off a reviewable result.** Give the receiver the outcome and diff/artifact
   pointers, actual verification results, remaining uncertainty, and next action.
   A drafted plan, generated test, or successful parser check is not evidence that
   the implementation delivered its intended behavior.

Parallel work is useful only for authorized independent subtasks with clear ownership
and a reconciliation point. Small fixes can stay in one context; splitting tightly
coupled edits usually adds handoff cost. Preserve the user's model/mode choice and
the existing canonical model-routing contract.

## Optional local classifier

If an available local read-plan helper suggests a skill or reference shortlist, treat
it as a cheap retrieval hint. Check its because-line against the request and audit.
If it is unavailable, uncertain, unsupported, or disagrees with a clear boundary,
use the normal routing questions. Predictions do not grant authority, establish
acceptance, downgrade verification, or select a paid model.

## Concise human handoff

> Task/owner: … · Revision and dirty changes: … · Delivered: … · Evidence: command
> and actual result, with artifact pointer … · Open risk/next action: …

Omit empty fields. Use the existing typed result schema for a machine-consumed
handoff; do not replace that contract with this human summary. Carry the decisive
facts and retrievable pointers instead of duplicating the full transcript.
