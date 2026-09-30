---
name: familiarize
description: Use at the very start of a session to familiarize yourself with this repository before proceeding with actual work.
argument-hint: "<low|docs|skim|surface|normal> [task to prepare for]"
---

# Familiarize

Three tiers control how deep you go. The user specifies the tier, or you infer it from the request. Default is normal.

## Tiers

### Low / docs

Read agent guidelines and project documentation only. No codebase exploration.

- `.agents/AGENTS.md`
- `README.md`
- Primary architecture docs and active skill guidelines if present (e.g. `.agents/architecture-state.md`, `.agents/skills/unslop/SKILL.md`, or verification skills)

Do not read source files, manifests, or directory trees. Do not gather session context.

### Skim / Surface

Read guidelines (everything in Low) plus a surface-level pass over the codebase. No deep dives.

- Walk the root directory tree and note the layout.
- Read manifests (`package.json`, `Cargo.toml`, etc.).
- Skim entry points and architecture docs, but do not open individual module files or trace call chains.

Do not use subagents. Do not gather session context.

### Normal

Full codebase familiarization.

- Walk the file and directory structure from the root down. Build a mental map of the project layout.
- Identify the architecture: languages and frameworks, how modules/services/layers are separated, where the entry points are, and how data and control flow through the system.
- Read manifests (`package.json`, `Cargo.toml`, etc.), build/config files, and existing architecture docs.
- Note the conventions in place: naming, folder layout, testing patterns, style. New work fits the codebase, not the other way around.
- Read `.agents/AGENTS.md` and strictly follow the coding quality standards and architecture rules. Confirm adherence to the user.
- If the task involves docs, prompts, comments, or user-facing copy, also read `.agents/skills/unslop/SKILL.md` (if present).

Do not gather session context. The `session-handoff` and `session-recovery` skills handle that separately when the user asks.

## No session recovery during familiarization

Do not read session-index entries, transcripts, or prior conversation context during familiarization. Session continuity is handled by `session-recovery` when explicitly requested.

## Subagents

If the harness supports subagents, delegate parts of the Normal tier to run in parallel (directory mapping, manifest reading, subsystem exploration). Have each subagent report a short summary, not raw output.

If the harness does not support subagents, do the work yourself. Never use the `pseudo-subagents` skill as a substitute.
