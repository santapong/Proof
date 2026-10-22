# Software-team context efficiency

Reduce repeated reading before adding an ML dependency. A smaller prompt is useful
only if the task still meets the same acceptance criteria.

## Build a task-specific packet

Start with the task/owner, repository revision including dirty changes, acceptance
criteria, current decision, relevant source locations, and actual check results.
Search narrowly for the symbols, failures, or files in that packet. Read the owning
skill and only the references needed for the current decision. A read plan selects
context; it does not replace reading the evidence needed to act.

Keep durable constraints, unresolved risks, corrections, and the latest verified
result in context. Evict resolved search trails and repetitive logs only after
retaining a compact outcome and an addressable artifact pointer. For a handoff, send
the next worker's decision inputs and ownership boundary, not the whole repository
or every prior message. Use the established typed state when tooling consumes it.

On a changed revision, test result, or user correction, update the packet and mark
the old claim superseded. Recheck a cached result before using it as evidence for a
different diff. Do not truncate a missing-evidence warning to make a packet fit.

## Optional ML assistance

A local classifier or ranker may shortlist a skill and its reference files from the
request and repository metadata. Keep a no-model route available and abstain when
the task is unsupported or the prediction is uncertain. Treat confidence as a
ranking signal unless calibration has been independently measured.

In the Proof source checkout, `scripts/software-context.mjs` can produce an explicit
read plan with full skill entrypoints and size estimates. Generated host packs do
not ship this script; the selective-reading procedure also works without it.

The helper is advisory: it cannot change authority, acceptance criteria, required
checks, execution modes, or canonical model routing. Inspect its proposed read plan
before loading or omitting material. Benchmark it against a simple deterministic
baseline; training, dependency, latency, and maintenance costs count too. Do not
download a model, send repository data to a remote service, or start paid inference
merely because a classifier could help.

## Measure cost and retained quality separately

For a bounded before/after trial, keep tasks, repository inputs, acceptance criteria,
and evaluation version fixed. Record the skill/helper version and context packet
identity so the comparison can be reproduced.

| Record | Interpretation |
|---|---|
| Selected file bytes or estimated prompt tokens | Static prompt-size proxy; not billed tokens, cache savings, or a completed-task measurement |
| Helper/tool response size | Include the retrieval output itself; repeated full-catalog audit excerpts can cost more context than the selected entrypoint. Retain relevant findings and source pointers in a compact response. |
| Runtime-reported input/output tokens, cache fields, model and pricing basis when available | Actual reported usage; leave unavailable fields unknown rather than substituting a proxy |
| Wall time, helper latency, retries and extra reads | Costs that a smaller initial packet can displace rather than remove |
| Acceptance/check results, missed constraints, misroutes, rework and reviewer corrections | Whether the reduced context still supports delivery |

Report paired observations with the task count and limitations. A shorter skill or
read plan alone proves a size change; it does not prove token savings or better
software delivery. If a smaller packet misses a required constraint, restore that
evidence and retain the failure as a scoped candidate for improvement.
