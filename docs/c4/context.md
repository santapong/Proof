# C4 System Context (Level 1) — TheLoopSkill

**What is this system, who uses it, and what does it depend on?**

TheLoopSkill is a **Claude Code plugin**: eighteen composable engineering skills built on a multi-agent workflow engine. It ships no server and no runtime of its own — it is Markdown and JavaScript that the Claude Code host loads, reads, and executes on the developer's behalf. That is the single most important thing this diagram communicates, and it is why Claude Code appears *outside* the box rather than inside it.

```mermaid
graph TB
    %% ---- People / actors ----
    dev["Developer<br/><i>[Person]</i><br/>Invokes a skill to review, design, debug, ship, or operate software"]
    maint["Plugin Maintainer<br/><i>[Person]</i><br/>Adds skills and standards; approves at the lifecycle gates"]

    %% ---- The system in focus (exactly ONE) ----
    system["<b>TheLoopSkill</b><br/><i>[Software System]</i><br/>Turns an engineering task into a governed multi-agent workflow, with the model matched to each job and a human at every phase gate"]

    %% ---- External systems ----
    cc["Claude Code<br/><i>[External System]</i><br/>Host runtime: discovers skills, loads context, executes the Workflow tool, enforces permissions"]
    fleet["Claude Model Fleet<br/><i>[External System]</i><br/>Haiku 4.5 · Sonnet 5 · Opus 5 · Fable 5 — the agents a workflow spawns"]
    repo["Target Repository<br/><i>[External System]</i><br/>The developer's own codebase and git history — read, and mutated only by implement nodes"]
    forge["GitHub<br/><i>[External System]</i><br/>Issues, PRs and CI signals consumed by the autonomous loop; draft PRs opened back"]
    web["Web &amp; Standards Sources<br/><i>[External System]</i><br/>Specs, RFCs and publisher catalogues that version-pinned citations are confirmed against"]

    %% ---- Relationships ----
    dev -->|"Invokes a skill, answers gate questions"| system
    maint -->|"Authors skills and standards shelves"| system
    system -->|"Is discovered and loaded as a plugin"| cc
    cc -->|"Spawns agents and runs workflow scripts on its behalf"| system
    system -->|"Routes each node to a model tier via ROUTES"| fleet
    system -->|"Reads code; implement nodes write patches"| repo
    system -->|"Reads feedback; opens draft PRs, never merges"| forge
    system -->|"Confirms every version pin before citing it"| web

    %% ---- C4 colour convention ----
    classDef person   fill:#08427b,stroke:#052e56,color:#ffffff
    classDef focus    fill:#1168bd,stroke:#0b4884,color:#ffffff
    classDef external fill:#999999,stroke:#6b6b6b,color:#ffffff

    class dev,maint person
    class system focus
    class cc,fleet,repo,forge,web external
```

## Reading it back, one sentence per arrow

- The **developer** invokes a skill and answers the questions the lifecycle gates raise.
- **Claude Code** discovers the plugin, loads the skill into context, and executes the workflow scripts the skill authors — TheLoopSkill never runs anything itself.
- The system **routes each node** of that workflow to a model tier, so a mechanical enumeration and an adversarial security verdict do not cost the same.
- It **reads the target repository** freely; only `implement` nodes write, and only within the phase a human approved.
- It **reads GitHub feedback and opens draft PRs** — the autonomous loop proposes and never merges.
- It **confirms version pins against primary sources** before a standards shelf asserts one.

## Why the boundary sits here

Three placements are deliberate and worth defending, because getting them wrong is the usual way a Context diagram misleads:

**Claude Code is external, not internal.** The plugin has no process, no port, and no lifecycle of its own. Everything it "does" is done by the host: skill discovery reads the `plugin.json` manifest, the agent loop loads `SKILL.md` into context, and the Workflow tool is what actually spawns subagents. Drawing Claude Code inside the box would claim ownership of machinery the plugin only *instructs*.

**The model fleet is external and singular.** Four models appear as one box because from the outside they are one dependency with one failure mode — an unavailable or rate-limited fleet. Which tier a given node gets is a Level 2 concern (the `ROUTES` block), not a Level 1 one.

**The target repository is external.** The plugin is installed once and pointed at many codebases. The repository is the *subject* of the work, not part of the system doing it — which is also why a mutation boundary (only `implement` nodes write) is worth stating on the arrow.

## What is deliberately absent

No skills, no policies, no templates, no `ROUTES` block, no phases. Eighteen skills drawn as eighteen peer boxes would be the classic Level-1 mistake: from the outside, this is one plugin with one entry point per task. Open the box at [Level 2 — Container](container.md).

---

**Next:** [Container (Level 2)](container.md) → [Component (Level 3)](component.md) → [mechanism, ideas and references](README.md)
