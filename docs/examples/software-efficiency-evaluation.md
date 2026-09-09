# Software context evaluation — independent frozen synthetic fixture

Executed 2026-09-09T04:06:13.986Z on Node v26.8.1; base commit `20214370a94722a1c62ca636f4b52f61a72ce618`.

These results measure candidate retrieval and abstention. They do not establish token savings, automated route correctness, or completed software work.

| Population / metric | Lexical baseline | Optional learned hint |
|---|---:|---:|
| overall / top1Accuracy | 29/40 (72.5%) | 23/40 (57.5%) |
| overall / top3CandidateRecall | 36/40 (90.0%) | 26/40 (65.0%) |
| overall / nonAbstainedCoverage | 39/40 (97.5%) | 31/40 (77.5%) |
| core / top1Accuracy | 21/32 (65.6%) | 23/32 (71.9%) |
| core / top3CandidateRecall | 28/32 (87.5%) | 26/32 (81.3%) |
| core / nonAbstainedCoverage | 31/32 (96.9%) | 26/32 (81.3%) |
| neighbor / top1Accuracy | 8/8 (100.0%) | 0/8 (0.0%) |
| neighbor / top3CandidateRecall | 8/8 (100.0%) | 0/8 (0.0%) |
| neighbor / nonAbstainedCoverage | 8/8 (100.0%) | 5/8 (62.5%) |
| ambiguous / required abstention | 2/4 (50.0%) | 4/4 (100.0%) |
| outOfDomain / required abstention | 3/4 (75.0%) | 4/4 (100.0%) |

The baseline ran before training. Enabling the model left every lexical candidate list and overall outcome unchanged. Exact normalized task/ID overlap: 0; trigram similarity ≥0.8: 0; maximum trigram Jaccard: 0.033. These automated checks do not exclude semantic overlap.

Mean candidate-entrypoint inventory: lexical 26594 characters; optional model union 37442; all entrypoints 268189. Mean full JSON response: lexical 33902 characters; optional model 36339. Counts exclude required reference reads and runtime context. Loading all skills is an inventory comparison, not a measured baseline.

The per-case candidate lists, false positives, hashes, control checks, and limitations are in the adjacent JSON record. The fixture and labels were frozen before either corpus comparison or model execution; no labels or thresholds were tuned to pass. Any follow-up that learns from these failures must use fresh unseen requests for an improvement claim.

No live provider was called, no domain skill was dispatched by this runner, and no model or prompt change was activated.

Reproduce to a new evidence path: `node scripts/evaluate-software-context.mjs --out /tmp/proof-evaluation-rerun`. The runner refuses to overwrite prior records.
