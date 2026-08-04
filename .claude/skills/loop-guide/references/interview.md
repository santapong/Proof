# The interview — fewest questions that discriminate

The interview's product is not understanding; it is **elimination**. Twenty-three skills are candidates when the user arrives; every question exists to strike candidates off, and the interview ends the moment one candidate remains per step of the work. Understanding the user's system is the routed skill's job — usually `loop-comprehend`'s — not this one's.

## Step 1 — mine the request before asking anything

A request in the user's own words usually answers most of the instrument already. Extract:

| Fact | Where it hides in the request | What it eliminates |
|---|---|---|
| **What artifact exists** | "my repo", "this PR", "an idea for", "prod is", "the docs say" | An idea eliminates every skill that needs code; an outage eliminates almost everything but `loop-incident` |
| **What they want at the end** | "so that I can…", "I need a…", the verb: fix / explain / build / check / ship | The deliverable is the single strongest discriminator in the audit — most boundaries resolve on artifact produced |
| **Whether it runs** | "when I run it", "the test fails", vs. "I haven't started" | Separates the debug/incident/operate family from the design/build family in one fact |
| **Urgency and blast radius** | "users are seeing", "before Friday's release", "someday" | Live user impact is the `loop-incident` tripwire; it outranks whatever else the request mentions |
| **Flags they already chose** | `--mode`, `--planner` | Nothing — but they must survive to the dispatch untouched |

Asking for any of these when the request already states them is the fastest way to make the front door feel like a form.

## Step 2 — ask only what still forks the route

Draw the remaining questions from the boundary audit's overlap resolutions — they are already phrased as one-step checkables. Translate them into the user's vocabulary; the user should never need to know skill names to answer:

| Audit question | Asked as |
|---|---|
| Findings list or diff? (`loop-review` / `loop-pattern`) | "Do you want a report of what's wrong, or do you want the code changed?" |
| Down now, or merely reproducible? (`loop-incident` / `loop-debug`) | "Are users affected right now, or can you reproduce it calmly?" |
| Adds a manifest line? (`loop-scout` / `loop-pattern`) | "Are you choosing a library, or using one you already have?" |
| Read out of existing code, or decided for code not yet written? (`loop-design` / `loop-comprehend`) | "Does this system exist yet?" |
| Change set or standing codebase? (`loop-audit` / `loop-comprehend`) | "Is this about a specific change, or about the repo as it stands?" |
| Got slower, or never fast enough? (`loop-debug` / `loop-algo`) | "Did this used to be fast?" |

**Rules:**

- **One to three questions.** A route still ambiguous after three usually means the ask is a chain — split it into steps and route each, rather than interrogating further.
- **Every question must eliminate.** Before asking, name (to yourself) which candidates each answer would strike. A question with no elimination on either answer is curiosity, not triage.
- **Batch, don't drip.** Ask the two or three together, once — not a question-per-turn interrogation.
- **Closed questions over open ones.** "Does it run?" beats "tell me about your setup" — the open version invites the user to hand over the comprehension job, which belongs to the routed skill.

## Step 3 — know when the interview is over

Three exits:

1. **One candidate per step** → verdict (SKILL.md §3). Do not ask a confirming question you already know the answer to.
2. **The user names the deliverable mid-interview** → stop; route to its owner directly. The interview exists for users who cannot name it, and holding one hostage to finish the script is trap #2.
3. **The answers describe a project, not a task** ("well, first it doesn't exist, and then it needs tests, and then it should deploy…") → stop eliminating and escalate per SKILL.md §3 — `loop-build` for conduct-it-for-me, `loop-orchestrate` for plan-it-for-me.

## What the interview never does

- **Never asks the user which skill they want.** They came here because they don't know; reflecting the question back is the front door refusing to open.
- **Never asks for information only the codebase can answer.** "Which module owns billing?" is a question for `loop-comprehend` after routing, not for the user before it.
- **Never re-litigates a fact already given.** If the request said "prod is down", the first candidate is already selected; the only interview left is confirming scope, and even that yields to speed — the audit's own resolution makes live user impact outrank the rest of the conversation.
