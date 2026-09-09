---
description: Run the repo gates (validate, smoke, ROUTES parity, host packs, context advisor, branch policy) and report
---
Run the full gate suite for this repo and report each result on one line:
1. `node scripts/validate.mjs` — the 9-check validation gate
2. `node scripts/smoke.mjs` — every workflow template executed under stubs
3. `node scripts/check-modes-extraction-parity.mjs` — canonical ROUTES block parity
4. `node scripts/check-host-packs.mjs` — generated host packs and reference integrity
5. `node scripts/test-software-context.mjs` — local context advisor behavior and model validation
6. `node scripts/test-branch-policy.mjs` — branch names, PR destinations, and rejection behavior

If any gate is red, stop and show the failing lines — do not proceed to other work
until it is green or the user redirects.
