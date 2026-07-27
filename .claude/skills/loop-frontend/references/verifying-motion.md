# Verifying motion — the checks that only exist at runtime

This skill asserts things about motion that **reading the source cannot confirm**. That is the same defect class this plugin already shipped once: `node --check` proved every workflow template *parsed*, and four of them turned out to be silently mode-inert the moment anyone actually *ran* them. A skill that writes animation and never observes a rendered frame is in exactly that position.

So: which of this skill's rules are statically checkable, and which are not.

| Rule | Static? | Why |
|---|---|---|
| Only `transform`/`opacity` animate | **Partly** | Greppable in a stylesheet; invisible when the animation is JS-driven, or when a class composes properties from three places |
| Reduced-motion branch **substitutes** rather than deletes | **No** | Needs the media feature emulated and the computed styles compared |
| Focus lands after `startViewTransition()` | **No** | Runtime only |
| A pinned scene does not trap focus | **No** | Runtime only |
| Nothing flashes above the SC 2.3.1 thresholds | **No** | Needs frame sampling and luminance maths |
| Motion does not wreck CLS | **No** | Needs measurement under real layout |
| Total sequence lands inside its budget | **No** | Needs the clock |

Six of seven need a browser. **That is the gap this file closes.**

## The plugin adds no dependency — and that is deliberate

TheLoopSkill has **zero npm dependencies**: `scripts/validate.mjs` and `scripts/smoke.mjs` are Node stdlib only, with no `package.json` and no lockfile. It is a library of skill definitions with no frontend of its own to test, so bundling a browser would add hundreds of megabytes of binaries and a lockfile to maintain for something that never runs against this repo.

The checks below run against **your project**, using whatever it already has. The division of labour is the one this skill already uses for contract tests:

- **`loop-frontend` specifies** which checks a given piece of motion needs, and what a pass looks like.
- **`loop-test` authors** the files, in the repo's existing stack and conventions — it will not introduce Playwright into a project that runs Cypress.
- **`loop-harness`** is where a browser **MCP server** goes, if you want Claude itself driving a browser as a standing capability. That is harness configuration, not this skill's business.

For a one-off eyeball during iteration — *does this actually feel right* — Claude Code's own browser control is faster than writing a test, and needs nothing installed in the project.

## The check catalogue

Examples use Playwright because its media emulation is the cleanest, but every check is expressible in any driver that can evaluate script in a page.

### 1. Reduced motion actually substitutes

The most important check here, and the one most often skipped, because a missing branch looks identical to a working one until you emulate it.

```js
test('reduced motion substitutes, and kills movement', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx  = await browser.newContext({ reducedMotion })
    const page = await ctx.newPage()
    await page.goto('/')
    const el = page.locator('[data-motion="panel"]')
    await el.hover()

    const s = await el.evaluate((n) => {
      const c = getComputedStyle(n)
      return { transition: c.transitionProperty, transform: c.transform, duration: c.transitionDuration }
    })

    if (reducedMotion === 'reduce') {
      expect(s.transform).toBe('none')                    // movement gone
      expect(s.transition).toContain('opacity')           // but SOMETHING still communicates the change
    } else {
      expect(s.transform).not.toBe('none')
    }
    await ctx.close()
  }
})
```

**The second assertion is the point.** Asserting only that motion stopped passes a page that deleted the feedback entirely — and `accessibility.md` requires substitution where a gentler equivalent exists, not removal. A test that only checks for absence enforces the wrong rule.

### 2. Nothing animates a layout property

Catches what a stylesheet grep misses, because it reads what the browser *computed* rather than what you wrote:

```js
const offenders = await page.evaluate(() => {
  const bad = ['width','height','top','left','right','bottom','margin','padding','flex-basis','box-shadow','filter']
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const c = getComputedStyle(el)
    const props = (c.transitionProperty + ',' + c.animationName).toLowerCase()
    for (const p of bad) if (props.includes(p)) out.push({ tag: el.tagName, cls: el.className, p })
  }
  return out
})
expect(offenders, JSON.stringify(offenders, null, 2)).toHaveLength(0)
```

Note `filter` and `box-shadow` in that list: they *look* compositor-safe and are not.

### 3. Focus follows a view transition

`accessibility.md` requires this pairing, and the spec itself says focus does not move on its own:

```js
await page.click('[data-route="pricing"]')
await page.waitForFunction(() => !document.startViewTransition || !document.querySelector('::view-transition'))
const focused = await page.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.textContent?.slice(0, 40))
expect(focused).toMatch(/^H1:/)   // reading position followed the transition
```

### 4. A pinned scene does not trap focus

The scroll-cinema failure mode: tab through the document and assert focus keeps advancing and stays visible.

```js
const order = []
for (let i = 0; i < 25; i++) {
  await page.keyboard.press('Tab')
  order.push(await page.evaluate(() => {
    const a = document.activeElement
    const r = a.getBoundingClientRect()
    return { id: a.id || a.tagName, visible: r.top >= 0 && r.bottom <= innerHeight }
  }))
}
expect(new Set(order.map((o) => o.id)).size).toBeGreaterThan(20)  // not cycling inside a pin
expect(order.every((o) => o.visible)).toBe(true)                   // focus never scrolled off
```

### 5. Layout shift across a scroll scene

Motion is a common CLS source, and a scroll scene is the worst offender:

```js
await page.evaluate(() => {
  window.__cls = 0
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
  }).observe({ type: 'layout-shift', buffered: true })
})
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 200) {
    scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r))
  }
})
expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1)
```

### 6. Flash thresholds — the one to be honest about

SC 2.3.1 is a **refusal** in this skill, so it deserves a real check. Sample frames and compare relative luminance between them; more than three paired opposing changes above the threshold inside any one second is a failure.

**Say plainly what this does and does not prove.** A sampled approximation at, say, 20fps can *catch* obvious strobing — and it can miss a fast flash between samples. It is a screen, not a certificate. The authoritative tool is the Trace Center's PEAT; the skill's actual defence is refusing to author the effect in the first place, and this check is a backstop for effects that arrived some other way.

### 7. Sequence budget

`choreography.md`'s budgets are numbers, so assert them:

```js
const t0 = await page.evaluate(() => performance.now())
await page.click('[data-open]')
await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
const elapsed = await page.evaluate(() => performance.now()) - t0
expect(elapsed).toBeLessThan(400)   // Doherty ceiling for a system response
```

`document.getAnimations()` covers CSS animations, transitions and WAAPI in one call, which makes it the right hook for "is everything finished".

### 8. Visual checkpoints

Screenshot at scroll checkpoints and at both reduced-motion settings. This is the only check that catches *"it renders, it passes every assertion, and it looks wrong"* — a scene that pins correctly but overlaps its own text.

Keep the count small and the checkpoints meaningful. A hundred screenshots nobody reviews is worse than five that someone does, and this is the check most likely to rot into noise.

## What automation cannot check

Say this at the gate rather than letting a green suite imply more than it proves:

- **Whether it feels expensive.** The entire premise of this skill is a perceptual judgement. No assertion covers it.
- **Whether the motion earned its place.** A pointless animation passes every check here.
- **Whether the curve is right.** `cubic-bezier(0.2, 0, 0, 1)` and `linear` both pass a budget assertion.
- **The fiftieth encounter.** Tests run once; users do not.

These checks stop you shipping something *broken* or *harmful*. They do not tell you it is good. That still needs someone to look.

## Wiring it in

1. Run `templates/motion-audit.workflow.js` — it inventories the motion and emits, per interaction, **which of these checks apply**.
2. Hand that spec to **`loop-test`**, which authors the files in your project's stack.
3. Put the accessibility checks (1, 3, 4) in CI. They are the ones with a named criterion behind them and no legitimate reason to fail.
4. Keep the visual checkpoints (8) out of a blocking gate unless someone actually reviews the diffs.
