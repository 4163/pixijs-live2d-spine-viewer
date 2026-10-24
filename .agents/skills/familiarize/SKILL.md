---
name: familiarize
description: Use at the very start of a session to familiarize yourself with this repository before proceeding with actual work.
argument-hint: "<low|docs|skim|surface|normal> [task to prepare for]"
---

# Familiarize

Three tiers control how deep you go. The user specifies the tier, or you infer it from the request. Default is docs level.

## Tiers

### Low / docs

Read agent guidelines and project documentation only. No codebase exploration.

- `.agents/AGENTS.md`
- `.agents/skills/unslop/SKILL.md`
- `.agents/skills/blast-radius/SKILL.md`
- `.agents/skills/validate-changes/SKILL.md`
- `.agents/skills/verify-implementation/SKILL.md`
- `README.md` (if present)

Do not read source files, config files, or directory trees.

### Skim / surface

Read guidelines (everything in Low) plus a surface-level pass over the codebase. No deep dives.

- Walk the root directory tree and note the layout.
- Read config and build files (`playwright/package.json` and similar).
- Skim entry points (`index.html`) and shared configuration, but do not open individual renderer modules or trace stage lifecycle logic.

Do not use subagents.

### Normal

Everyday orientation. Rules plus layout plus who owns what.

- Build on the lower tiers. Docs holds the guidelines, skim holds the layout, configs, and entry points.
- Read bootstrap files (`js/main.js`) and UI controllers to understand DOM-to-canvas boundaries (`window.__viewerCallbacks`), but do not open renderer modules unless the task requires it.
- Note the conventions in place: single PIXI application lifecycle, in-memory asset caching (`window.__MODEL_CACHE`), async cancellation tokens (`window.__loadToken`), zero allocations in render loops. New work fits the codebase, not the other way around.
- Stop at renderer doors. Do not read through animation renderers, shader hooks, or binary parser shims to learn them. Depth beyond this is task-scoped.

## Subagents

If the harness supports subagents, delegate parts of the Normal tier to run in parallel (directory mapping, manifest reading, subsystem exploration). Have each subagent report a short summary, not raw output.

If the harness does not support subagents, do the work yourself. Never use any pseudo subagents skill as a substitute.
