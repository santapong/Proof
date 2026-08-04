# Guide traps — how routing goes wrong while looking helpful

A routing failure rarely looks like one. It looks like helpfulness: the guide that starts fixing the bug, the thorough interview, the impressively long chain. Each trap names its detection signal before its fix, in the fleet's shape.

## 1. The guide that does the work

**The trap:** mid-interview, the situation becomes clear enough to just… start. Guide debugs the bug, sketches the design, edits the doc. The routed skill's discipline — its references, its standards shelf, its verification shape — never loads, and the work ships without the law that skill exists to apply.

**Detection signal:** guide's transcript contains domain artifacts — a diff, an architecture sketch, a root-cause hypothesis — before any dispatch.

**Fix:** the first sentence of the router: guide's deliverable is the verdict and the dispatch, nothing else. "Clear enough to start" means clear enough to *route*; route it.

## 2. Interview bloat

**The trap:** the interview runs the full instrument regardless of what the request already said — or keeps asking after the route is determined, because the script isn't finished. The front door becomes a form, and the user who came to avoid learning 23 skills now answers 10 questions instead.

**Detection signal:** any question whose answer was in the original request; any question asked after one candidate remains; more than three questions total.

**Fix:** `interview.md`'s discipline — mine the request first, every question must eliminate, three exits. The interview serves the elimination, never the reverse.

## 3. Routing by topic word

**The trap:** the request says "documentation", so `loop-docs`; says "architecture", so `loop-design`. But "the documentation is wrong about how this works" is a comprehension job (what *is* true?) before it is a docs job, and "explain the architecture" of an existing repo is `loop-comprehend`, not `loop-design`. Topic words are what the boundary audit's checkable questions exist to *replace* — routing on them reintroduces the feature-list-description defect at the routing layer.

**Detection signal:** a because-line that quotes a noun from the request rather than an answer to a checkable question ("they said docs → loop-docs").

**Fix:** every because-line must be an *answer* — deliverable, runs-or-not, exists-or-not, down-or-not — not an echo. If no checkable answer selects the pick, the route is not yet determined; ask the question that determines it.

## 4. The chain that should be loop-build

**The trap:** the chain grows a hop at a time — comprehend, then design, then pattern, then test, then ship — and guide conducts the whole thing. It feels like managed routing; it is an unguarded project: no human gates, no repair rounds, no cast-and-cost ledger, no reconciled plan. Everything `loop-build` enforces is silently skipped by never being asked.

**Detection signal:** a chain at five hops, or one that gained hops during execution; guide's routing note reading like a project ledger.

**Fix:** the 5-hop tripwire in `dispatch.md` — escalate, handing over the completed hops as brief. The escalation is a success of routing, not an admission it failed.

## 5. The duplicate instrument

**The trap:** to route faster, guide's files grow their own summary of every skill's scope — a routing table, restated boundaries, per-skill one-liners. Now the instrument exists twice, and the copy in guide drifts the first time any sibling's boundary moves. This is the same defect as two skills sharing one body of knowledge, committed by the skill whose whole premise is that the audit is normative.

**Detection signal:** any prose in `loop-guide` that states another skill's scope; a diff to `boundary-audit.json` or a sibling's description with no matching look at guide's files.

**Fix:** guide *reads* the audit and the live descriptions at routing time; it never restates them. The interview file may quote the audit's *questions* (they are the instrument's handles), but scopes and verdicts always come from the source. This file's own examples name skills only inside trap narratives — never as a routing reference.

## 6. The confident misroute

**The trap:** the verdict is announced as a conclusion — "this is a loop-debug job" — with no visible reasoning. The user, who by definition doesn't know the skills, cannot tell a right route from a wrong one, so the misroute is discovered only after the wrong skill produced the wrong deliverable.

**Detection signal:** a verdict with no because-line; a user asking "why that one?" after dispatch.

**Fix:** the because-line, always, stated *before* work runs (SKILL.md §3's non-negotiable). It converts the user from a passenger into the cheapest verifier in the fleet — refuting "users are affected right now" takes them one second, and one second before beats one deliverable after.

## 7. The sticky route

**The trap:** the route was right on the interview's facts, and the first hop's output revealed better facts — the "slow endpoint" is actually a lock contention defect, the "explain this repo" surfaced live data loss. Guide, committed to its announced plan, finishes the chain as designed.

**Detection signal:** a hop's output contradicting the because-line of a *later* hop, with no re-route recorded; a routing note whose "Re-routes" line is always empty across engagements.

**Fix:** `dispatch.md`'s between-hops re-validation — the route is a hypothesis and hops are evidence. The incident tripwire in particular fires mid-chain, immediately, and outranks every announced plan.
