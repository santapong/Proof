# Feature tracing — following one behavior end to end

A trace answers "how does X actually work" with a **path**: entry point → every transformation and boundary crossing → observable effect, each hop cited. It is the smallest unit of real comprehension — an architecture map says what talks to what; a trace proves it for one behavior.

## Anchor both ends before closing the middle

The reliable method is bidirectional:

1. **Pin the entry point** — the route registration, CLI subcommand, event subscription, scheduled job, UI handler. Find it by searching for the *external name* (the URL path, the command word, the event type), which the code must contain verbatim somewhere.
2. **Pin the effect** — the table written, the message published, the file emitted, the response shape. Find it the same way: search for the table name, the topic, the field the user sees.
3. **Close the middle from both ends.** Forward from the entry until dispatch goes opaque; backward from the effect until construction goes opaque; the two frontiers usually meet at one indirection you can now resolve with both halves in hand.

A trace grown only forward dies at the first dispatch table — you reach `handler.execute()` and face forty implementations. Grown from both ends, you know *which* implementation must be on the path, because only one of them touches the pinned effect.

## Indirections — resolve and record

Every mechanism that breaks the static chain, with its resolution move:

| Indirection | How to resolve it |
|---|---|
| DI container / service locator | Read the binding registration, not the injection site — search for the interface name in the container config |
| Event bus / pub-sub | Search for the event type at both `publish` and `subscribe` sites; the subscriber set *is* the edge |
| Dynamic dispatch / strategy | Find where the concrete strategy is *chosen* — a config key, a factory switch — and record the selector value on your path |
| Config-selected implementation | Read the actual deployed config, not the default; the default is a decoy in any repo with environments |
| Reflection / string-built names | Grep for the string fragments; failing that, go to runtime evidence |
| Middleware / interceptor chains | Read the chain *registration order* — behavior lives in the order, not in any single middleware |

**Record how you resolved each one.** The resolution ("`PaymentStrategy` is chosen in `config/payments.yml:12`, prod sets `stripe`") is the highest-value line in the trace — it is exactly the step the next reader cannot do in their head, and it is what makes the trace a document instead of a memory.

## Static vs. runtime evidence

Static reading is the default; go to runtime when static goes ambiguous — and say which class each hop's evidence is.

- **Run it and log the path.** A debugger walk or a temporarily-logged request through a dev instance settles in minutes what static analysis of a reflective codebase cannot settle at all.
- **Read the test that exercises the feature.** A test is a trace someone already wrote down: it names the entry point, constructs the preconditions, and asserts the effect. Integration tests over the target path are the single best starting artifact a tracer can find — start the both-ends anchoring from the test's setup and assertions.
- **A trace whose middle is runtime-verified outranks one that is fully static.** Static reading proves an edge *can* be taken; the log proves it *was*.

## Presenting a trace

- One line per hop: `where (file:line)` → `what happens` → `evidence class (static | runtime | test)`.
- Boundary crossings (process, service, queue, DB) marked explicitly — they are where the failure modes and the latency live, and where `loop-design`-shaped questions start.
- Branches: trace the primary path fully; *name* the branches you did not follow and what selects them. An unnamed branch is a coverage hole; a named one is a scope decision.
- Close with the coverage statement (router §6): which variant of the feature this trace represents (which config, which tenant shape, which flag state) — a trace is one path through the system under one selection of every indirection, and pretending otherwise is trap #4 in `comprehension-traps.md`.

## When tracing is not the job

- The behavior traced is *wrong* → the moment comprehension turns into "why does this misbehave," hand the reproduction to `loop-debug`; the trace you built is its head start.
- The trace is wanted to size a change's blast radius → the trace is input to `loop-audit`.
- The trace should become permanent docs (a "how a request flows" guide) → `loop-docs`, with this trace as the verified source material.
