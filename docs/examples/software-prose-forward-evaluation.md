# Software-team skill forward walkthroughs

The independent evaluator followed the revised prose on two small synthetic software tasks on 2026-09-09. These are observable walkthroughs, not blind model evaluations or measured delivery improvements. Raw inputs, commands, outputs, paths, hashes, and limitations are preserved in `software-prose-forward-evaluation.json`.

| Task | Actions actually performed | Observed result |
|---|---|---|
| Review a staged download handler without changing it | Inspected the staged diff and input-to-file flow; executed a benign sibling-directory request; compared source and staged-diff hashes afterward | Correct `loop-review` route. The handler returned the synthetic marker outside its intended root. Both source and diff hashes remained identical. |
| Hand off retry-contract evidence and recheck after a dirty edit | Recorded branch, absent commit, dirty status, acceptance command, source hash, and raw green result in an addressable checkpoint; deliberately changed the synthetic source; rechecked its hash and reran the same check | An unborn repository was recorded as having no commit. The original check exited 0; after the edit it exited 1. An appended checkpoint superseded the earlier green instead of treating it as current. |

The review also exposed an inherited unsafe example in `loop-review/references/vulnerability-playbooks.md`: string-prefix matching accepted `publicity/` as inside `public/`. The root agent corrected the guidance. Independent Python checks confirmed the revised resolved-path containment accepts an inside file and rejects sibling-prefix and symlink escapes. This check covers a static directory tree; it does not prove freedom from check/open races. Go guidance was not executed.

The 48 routing cases retained exactly the same lexical and learned predictions after the implementation-only output changes. Mean lexical CLI output fell from 33,902 to 8,181 characters, including the switch from pretty to compact JSON. On one identical review request, native `boundaryLookup` compact JSON was 98,862 characters and the helper CLI was 7,738. The native response contains fuller audit detail; the helper retains debt summaries and source pointers. These are retrieval-output measurements, not total context, tokenizer, cache, latency, price, or task-completion savings.

No live provider or workflow engine was called, and no global setting, Git commit, application source, external message, or service was changed by these walkthroughs. Provider usage remains unknown. Two synthetic tasks cannot establish general skill effectiveness or automatic enforcement of the documented handoff procedure.
