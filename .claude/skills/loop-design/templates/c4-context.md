# C4 System Context (Level 1)

A System Context diagram answers one question for a mixed audience of engineers and non-engineers: **what is this system, who uses it, and what does it depend on?** It draws your system as a single black box, surrounds it with the people who use it and the external systems it talks to, and stops there. Nothing inside the box — no containers, no databases, no technology choices. Those live at Level 2 (Container) and below.

The load-bearing rule is **exactly one system in focus**. If you find yourself drawing two peer systems you own, you're either scoping too wide (draw a Context per system, or a System Landscape) or you've mistaken a container for a system. Every other box is a *black box*: a person who uses your system, or an external system you send to / receive from but do not build. Copy the blank template below into `docs/c4/context.md`, replace the placeholders, and delete the example at the bottom.

## What belongs at this level

- **The system in focus** — one box, named as the business names it, not the codebase.
- **People / actors** — every distinct human *role* that interacts with the system (customer, admin, support agent). Roles, not named individuals; not org charts.
- **External systems** — anything you depend on but don't own the internals of: payment gateways, email/SMS providers, identity providers, partner APIs, upstream systems of record.
- **Relationships** — one labelled arrow per interaction, in the direction data or intent flows. The label states the *intent* and, optionally, the *protocol* ("Places orders via HTTPS").

## What does NOT belong here (it leaks a lower level)

- Internal containers — web app, API, database, queue, cache. That's the Container diagram.
- Technology or framework names *inside* your box (React, Postgres, Kafka). Protocols on the arrows are fine; internals are not.
- Deployment topology, regions, replicas, networking — that's a deployment view, not Context.
- Every microservice you own drawn as a peer. From the outside, your system is one box.

## Blank template

Every fill-in slot is an `ALL_CAPS_UNDERSCORE` token (`PRIMARY_USER_ROLE`, `YOUR_SYSTEM_NAME`, `USES_WHAT`, …) — replace each with real text. Caps-and-underscores are inert and preview cleanly, where bracketed `<placeholders>` would be lexed as HTML. Keep exactly one `System(...)`. Add or remove `Person` and `System_Ext` nodes to match reality — a real Context diagram usually has 2–5 actors and 2–6 external systems; if it has twenty, you're at the wrong altitude.

This uses Mermaid's **native `C4Context`** diagram type, which encodes C4 semantics directly: `Person`, `System`, `System_Ext` and `Rel` are the model's own vocabulary, so the diagram cannot quietly drift into being a generic box-and-arrow picture. The colour convention comes free — you never hand-write a `classDef`.

```mermaid
C4Context
    title System Context — YOUR_SYSTEM_NAME

    %% ---- People / actors (one per distinct ROLE, not per individual) ----
    Person(personA, "PRIMARY_USER_ROLE", "WHAT_THEY_USE_IT_FOR")
    Person(personB, "SECONDARY_ROLE_EG_ADMIN", "WHAT_THEY_DO")

    %% ---- The system in focus (exactly ONE) ----
    System(system, "YOUR_SYSTEM_NAME", "ONE_LINE_WHAT_IT_DOES_FOR_WHOM")

    %% ---- External systems you depend on but don't own ----
    System_Ext(extA, "EXTERNAL_SYSTEM_A", "WHAT_IT_PROVIDES")
    System_Ext(extB, "EXTERNAL_SYSTEM_B", "WHAT_IT_PROVIDES")

    %% ---- Relationships: intent in slot 3, protocol in optional slot 4 ----
    Rel(personA, system, "USES_WHAT", "PROTOCOL")
    Rel(personB, system, "MANAGES_WHAT", "PROTOCOL")
    Rel(system, extA, "SENDS_OR_REQUESTS_WHAT", "PROTOCOL")
    Rel(extB, system, "NOTIFIES_OR_PROVIDES_WHAT", "PROTOCOL")

    %% ---- Tune only if the default layout crowds the boxes ----
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## How to fill it in

1. **Name the system in focus** as the business calls it, and write a one-line responsibility in the box. If you can't say what it does in one line, the scope is wrong.
2. **List the actor roles**, not people. Merge two roles only if they truly do the same things through the system; split one role into two if the arrows would differ.
3. **List the externals** — walk every outbound call and every inbound webhook/callback. If your system can't function without it and you don't deploy it, it's an external system here.
4. **Label every relationship.** Direction = who initiates or which way data flows. `Rel`'s third argument is the *intent* and its optional fourth is the *protocol* — `Rel(system, payments, "Requests payment", "REST/HTTPS")`. An unlabelled arrow is a TODO, not a diagram.
5. **Read it back as one sentence per arrow.** "The customer places orders via the platform; the platform requests payment via the gateway." If a sentence needs an internal detail to make sense, that detail belongs at Level 2 — cut it here.

**Layout escape hatch.** `C4Context`'s auto-layout is less controllable than a generic `graph`. Tune it with `UpdateLayoutConfig` (`$c4ShapeInRow`, `$c4BoundaryInRow`) and force an edge direction with `Rel_U` / `Rel_D` / `Rel_L` / `Rel_R` before considering anything else. Only drop to `graph TB` with hand-written `classDef`s if the native layout is genuinely unreadable — and know what you give up: a generic graph will happily let you draw two systems in focus, or an actor with no role, because nothing in the notation objects. The native form makes those mistakes hard to express.

---

# Example (filled in)

A complete Context diagram for an e-commerce platform, so the shape is concrete. Delete this section from your real diagram.

```mermaid
C4Context
    title System Context — Acme Commerce Platform

    %% ---- People / actors ----
    Person(customer, "Customer", "Browses, orders, and tracks delivery")
    Person(agent, "Support Agent", "Handles refunds and account issues")

    %% ---- The system in focus ----
    System(system, "Acme Commerce Platform", "Lets customers browse, order, and pay online")

    %% ---- External systems ----
    System_Ext(payments, "Payment Gateway", "Authorises and captures card payments")
    System_Ext(email, "Email Provider", "Sends order and account email")
    System_Ext(erp, "Fulfilment / ERP", "Holds inventory, ships orders")

    %% ---- Relationships ----
    Rel(customer, system, "Browses & places orders", "HTTPS")
    Rel(agent, system, "Manages orders & refunds", "HTTPS")
    Rel(system, payments, "Requests payment", "REST/HTTPS")
    Rel(system, email, "Sends transactional email", "API")
    Rel(system, erp, "Syncs orders & stock", "REST")
    Rel(erp, system, "Posts shipment updates", "webhook")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

When this diagram is stable, drop one level: the Container diagram (`c4-container.md`, its sibling in this `templates/` directory) opens the focus box into its deployable units. Stop there unless a container is genuinely subtle — over-diagramming rots.
