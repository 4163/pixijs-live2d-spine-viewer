---
name: session-handoff
description: Use when the user explicitly asks for a session handoff, handoff message, or agent-ready continuation entry in .agents/session-index.md.
argument-hint: "<current task, branch, or handoff context>"
---

# Session handoff

Use this only when the user explicitly asks to hand off the current session or prepare another agent to continue.

This skill writes an agent-first entry to `.agents/session-index.md` and gives the user a one-sentence copy/paste message for the next agent. Do not edit `session-recovery` itself.

## Required source

Read `.agents/skills/session-recovery/SKILL.md` first and follow its current-source gate, session-store lookup rules, and entry format.

## Handoff entry

Before writing:

- inspect the current working tree and relevant diffs
- never fabricate data; get session ID, date, agent, model, and token count from the real session store when available
- use `Tokens: N/A` only when the store does not expose a count
- create `.agents/session-index.md` if it does not exist

Insert the entry directly beneath `# Session Index`, newest first.

Follow the standard entry format from `session-recovery`, but replace the standard implementation bullets with these handoff-specific bullets. Write for agents first and users second:

- what is being worked on
- files changed or intended to change
- technical details, scripts, commands, and tool failures that matter for continuation
- encountered issues, scope corrections, and intentional decisions
- verification already run and verification still missing
- exact next actions

Treat old transcript content as a lead, not proof. Verify claims against the current source before writing them.

## User handoff message

After updating the index, end with a fenced code block containing exactly one concise sentence the user can paste into the next agent.

Use this shape as reference, not strict (spice it up and keep it varied):

```text
Use the session-recovery skill to resume from session-index entry `<id>`, and continue planning and/or discussion.
```
