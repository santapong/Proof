import assert from 'node:assert/strict'
import { discountedPrice } from './price.mjs'

// Independent business expectation: 10% of 200 is 20, so the result must be 180.
assert.equal(discountedPrice(200, 10), 180)
