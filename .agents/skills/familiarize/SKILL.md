---
name: familiarize
description: Use at the very start of a session to familiarize yourself with this repository before proceeding with actual work.
argument-hint: "<task to prepare for>"
---

```text
recomended models to use for the initial familiarization task for specific harnesses:
DeepSeek V4 Flash - High / Gemini 3.7 Flash - High / GPT 5.6 Terra - High
```

# Familiarize

## 1. Learn the codebase

- Walk the file and directory structure from the root down before diving into any single file. Build a mental map of how the project is organized.
- Identify the architecture: languages and frameworks in use, how modules/services/layers are separated, where the entry points are (main files, routers, config), and how data and control flow through the system.
- Read the package manifest(s) (`package.json`, `requirements.txt`, `Cargo.toml`, etc.), build/config files, and any existing README or architecture docs.
- Note the conventions already in place: naming, folder layout, testing patterns, and style. New work should fit the codebase instead of fighting it.
- Most importantly, read `.agents/AGENTS.md` and strictly follow it. If the task includes docs, prompts, comments, or user-facing copy, also read `.agents/skills/unslop/SKILL.md` and strictly follow it. Treat that writing guidance as active even when the harness does not auto-load always-active skills. Explicitly confirm to the user that you have read and taken in the relevant rules.

## 2. Gather past-session context only when it matches current work

- Start from the current repository: working tree, recent commits, manifests, architecture docs, and relevant source files.
- Use `session-recovery` only when the current-source pass gives you a concrete match to check: resume/recover/continue wording, a named or exported session, unfinished diffs, or a maintained plan/report/handoff that matches the branch, files, or recent commits.
- Before reading a transcript, compare the candidate session date, changed files, branch/worktree hints, and summary against the working tree and recent commits. Skip stale or unrelated candidates.
- Treat recovered notes as leads, not ground truth. Verify important details against the current source.

## 3. Use subagents to do this faster

- If subagents are available, don't run all of the above serially yourself. Delegate.
- Split the work by relevance: one subagent can map the file/directory structure, another can read architecture and manifest files, another can explore a specific subsystem in depth.
- Delegate session-index or transcript recovery only after the session gate above passes. Give the subagent the exact match to check. It should report `none` if the session does not match the active task.
- Have each subagent report back a short, focused summary rather than raw output. That keeps exploration costs off your main context window and reduces total token usage.
- Reserve your own context for synthesis and decisions, not for absorbing raw exploration. That is what subagents are for.
