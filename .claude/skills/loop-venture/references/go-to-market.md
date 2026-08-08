# P3 — Go-to-market, monetization & support playbook

The deliverable is `venture/03-go-to-market.md`: positioning, a pricing model with its
assumptions priced in, channel choices, and a support plan — the commercial half of the
GATE-3 trio, which must survive the fold against P4's `v1Scope` and P5's `deployTarget`.
The node runs the standard five-step loop (`lifecycle.md` §3) from GATE-2's checkpoint.
Competitive scans run under `loop-research`'s law; build-vs-buy on GTM tooling (billing,
analytics, helpdesk) is delegated to `loop-scout` and lands in the band as `assumptions[]`
plus `constraints`, never as tool worship.

## 1. Positioning before pricing, pricing before channels

The order is load-bearing: a price is meaningless without the alternative it is compared
against, and a channel is unchoosable without knowing who is being reached at what
willingness-to-pay.

- **Positioning** — for the P1 persona, against the *current workaround* (the real
  competitive alternative, per discovery), the differentiator is the one attribute the
  workaround cannot match. Fill `positioning` = {segment, differentiator, competitors[]}.
  A differentiator the competitors[] list could also claim is a feature, not a position.
- **Pricing** — pick the model first (subscription, usage, one-time, freemium tiers,
  services), then the numbers. The model must charge along the axis where the persona
  *feels value grow*; numbers anchor on the workaround's cost from P1, not on cost-plus.
  Every number is an `assumptions[]` entry with a validation path — pricing is the most
  assumption-dense field in the venture state, and the document must say so.
- **Channels** — at most two to start, chosen by where the evidence says the persona
  already looks (discovery's complaint-mining sources are channel candidates by
  definition). Each channel entry states its cost hypothesis and first falsification test.
- **Support** — `supportPlan` = {channels[], slaTargets}: what tier of support the price
  can carry. Support is a cost of the pricing model, not an afterthought: a $9/mo tier
  cannot fund white-glove onboarding, and the fold will check the SLA against
  `deployTarget.costModel`.

## 2. The legal lens

Payments, cross-border sales, marketing-consent regimes, and data handling in the chosen
channels all append `constraints.legal[]` entries (jurisdiction/rule, obligation, source).
This node is usually the first to touch money, so it is usually the first writer.

## 3. Discuss cast

- **The growth marketer** — argues reach: which position and channel actually get in
  front of the persona this quarter?
- **The CFO-skeptic** — argues unit economics: does the margin survive the support SLA,
  the channel cost, and the deploy cost model? Attacks every pricing assumption by name.
- **The support lead** — argues the promise being made: what does this price obligate us
  to when it breaks at 2am, and can the plan honor it?

## 4. GTM failures — the catalogue

| Failure — drawback first | Signal | Intervention |
|---|---|---|
| **Pricing by vibes.** Numbers picked to feel reasonable, anchored on nothing — the single most expensive unvalidated assumption a venture carries into GATE-3. | `pricing.tiers[]` cite no workaround-cost anchor from P1; `pricing.assumptions[]` is empty or unowned. | Re-anchor every number on the substitute economy discovery priced; any number with no anchor enters `assumptions[]` with a validation test and a date. |
| **Channel spray.** Five launch channels because choosing felt like risk — spreading a falsification budget too thin to falsify anything. | More than two channels with no ordering; channel entries carry no cost hypothesis or test. | Rank by evidence-of-presence from discovery, cut to two, and give each its falsification test; the cut list is a deferral, not a loss. |
| **Position by feature list.** Positioning that enumerates capabilities instead of naming the one attribute the workaround cannot match — indistinguishable at a glance from every competitor's page. | The differentiator sentence survives the swap-test against `competitors[]`; the sufferer could not repeat it after one reading. | Rewrite against the workaround specifically: what does switching *away from the current hack* buy in one clause? |
| **Support as afterthought.** SLAs promised at GATE-3 that the pricing margin and deploy cost model cannot fund — discovered by the first angry customer instead of by the fold. | `supportPlan.slaTargets` has no cost line; the CFO-skeptic's margin argument never mentions support; the sweep finds no conflict only because the field is empty. | Cost the SLA per tier explicitly and let the fold test it against `pricing` and `deployTarget.costModel`; an unfundable SLA is re-tiered now, at GATE-3, or the price moves. |
| **Tool worship.** The GTM plan becomes a stack diagram — billing, analytics, CRM, helpdesk chosen with enthusiasm — while position, price, and channel stay unargued. | The document names more products than assumptions; `loop-scout` verdicts appear without the decision they serve. | Strip tooling to the two decisions that block launch; the rest defers until a validated channel exists to instrument. |
