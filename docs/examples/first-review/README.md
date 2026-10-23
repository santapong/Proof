# First review: a percentage discount

This is a small, intentionally faulty fixture, not a real financial service.
`price.mjs` subtracts the percentage as an amount. For a subtotal of 200 and a
10% discount it returns 190; the independent expected result is 180.

```sh
node docs/examples/first-review/check.mjs
```

The check is expected to fail with an assertion showing 190 versus 180. Do not
report that expected failure as a passing product test. A fix would apply the
percentage to the subtotal; a review-only prompt should identify it without edits.

In a configured candidate plugin session:

```text
/proof:proof-review docs/examples/first-review/price.mjs. Explain the arithmetic defect and show its check; do not edit files.
```

Expected evidence: the expression, 200/10 input, expected versus observed values
and a bounded correction suggestion. This walkthrough has a deterministic check;
no native host-model run or user-comprehension result is claimed by providing it.
