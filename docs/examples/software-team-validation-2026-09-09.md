# Software-team validation — 2026-09-09

Checked 2026-09-09T04:15:56.850205+00:00; Node v26.8.1; branch `feat/software-team-efficiency`, base `20214370a94722a1c62ca636f4b52f61a72ce618`. Changes are local and uncommitted.

| Command | Observed result |
|---|---|
| `node scripts/validate.mjs` | PASSED — 55326 assertions, 0 failures, 3 warning(s). |
| `node scripts/smoke.mjs` | 32 templates executed — 32 passed, 0 failed |
| `node scripts/check-modes-extraction-parity.mjs` | PARITY OK — both locators agree: 87 lines, doc line 308, byte-identical block text. |
| `node scripts/check-host-packs.mjs` | host packs OK — 3 host(s) checked, 15 residual-prose warning(s). |
| `node scripts/test-software-context.mjs` | software-context: 62 behavioral checks passed; no provider calls. |
| `claude plugin validate . --strict` | ✔ Validation passed |
| `git diff --check` | Exit 0 |

All listed commands exited 0. Validation retains three existing comment warnings; host packs retain 15 informational host-prose warnings.

The generic Codex `quick_validate.py` was also attempted on the three changed routers and rejects Proof’s required `argument-hint` field. This is a validator/schema incompatibility; the repository validator above checks the actual Proof dialect. The field was preserved.

Strict marketplace validation initially rejected the existing 2.4.0 marketplace entry against plugin 3.0.0; the entry now matches 3.0.0. No new release was made.

[Frozen routing comparison](software-efficiency-evaluation-final.md) and [forward walkthroughs](software-prose-forward-evaluation.md) record behavioral evidence and limitations. The final routing source hashes match current files. Python containment was checked in an isolated static tree; Go guidance was checked against official documentation without Go execution.

No live provider run, installed skill update, merge, push, deployment, or automation occurred. Actual billed-token and delivery improvements remain unmeasured.
