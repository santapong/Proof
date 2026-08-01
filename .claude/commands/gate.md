---
description: Run all three repo gates (validate, smoke, ROUTES parity) and report
---
Run the full gate suite for this repo and report each result on one line:
1. `node scripts/validate.mjs` — the 9-check validation gate
2. `node scripts/smoke.mjs` — every workflow template executed under stubs
3. `node scripts/check-modes-extraction-parity.mjs` — canonical ROUTES block parity

If any gate is red, stop and show the failing lines — do not proceed to other work
until it is green or the user redirects.
