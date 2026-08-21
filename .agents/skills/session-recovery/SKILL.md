---
name: session-recovery
description: Trigger when the user asks to resume an interrupted task, find prior conversation context, check continuity, log session, or add verified session provenance to the session index.
argument-hint: "<session id, title, date, or resume context>"
---

# Session recovery

Use this when the request is about prior sessions, such as resuming an interrupted task, finding a specific conversation, checking whether recent session notes match the current task, or adding a verified entry to the session index. Do not use it as a substitute for reading the current source.

Before reading old session data, check whether it is still relevant:

- Inspect the current working tree and recent commits first.
- Compare the candidate session date, branch/worktree hints, changed files, and summary against the active task.
- Skip the session if it predates newer unrelated commits or its summary does not match the current request.
- Treat recovered content as a lead. Verify code claims against the current source before acting on them.

All sessions for this project may be indexed at `.agents/session-index.md`. The index is a candidate list, not a source of truth. Its entries can be stale, and actual session data if old enough may not exist anymore.

## Adding session entries

When adding sessions from other tools, insert new entries at the top of `.agents/session-index.md`, directly beneath the `# Session Index` heading, so the list remains newest first.

Every session ID, agent, model, and token count must come from the actual session store. Do not fabricate, guess, or copy values from another row. If a count cannot be retrieved, use `Tokens: N/A`.

Include a concise human-readable summary, followed by a brief outline or bulleted list of the specific code changes, functions touched, and key design decisions made.

```markdown
### `<id>` - <slug>
**Date:** YYYY-MM-DD | **Agent:** <agent> | **Model:** <model> | **Tokens:** <count>
**Summary:** <concise human-readable summary>
- <specific code changes>
- <functions touched>
- <key design decisions made>
```

## Using the scripts

Instead of running raw SQL or PowerShell, use the provided Python scripts in `.agents/skills/session-recovery/scripts/`.

Each script supports `list`, `read <id>`, and `search <keyword>`. They output clean text and handle their own database paths.

| Tool | Harness / Source | Example |
| --- | --- | --- |
| `python scripts/opencode.py` | OpenCode DB | `python .agents/skills/session-recovery/scripts/opencode.py search "config"` |
| `python scripts/kilo.py` | Kilo DB | `python .agents/skills/session-recovery/scripts/kilo.py list` |
| `python scripts/antigravity.py` | AGY CLI and IDE DBs | `python .agents/skills/session-recovery/scripts/antigravity.py read <id>` |
| `python scripts/codex.py` | Codex JSONL | `python .agents/skills/session-recovery/scripts/codex.py search "bug"` |
| `python scripts/kiro.py` | Kiro IDE JSONL | `python .agents/skills/session-recovery/scripts/kiro.py list` |
| `python scripts/grok.py` | Grok CLI | `python .agents/skills/session-recovery/scripts/grok.py read <id>` |

## Session store paths

If a script fails or you need to run a broad `rg` search directly, these are the current store locations:

| Store | Location |
| --- | --- |
| OpenCode | `~/.local/share/opencode/opencode.db` |
| Kilo CLI | `~/.local/share/kilo/kilo.db` |
| Antigravity CLI | `~/.gemini/antigravity-cli/conversation_summaries.db` |
| Antigravity IDE | `~/.gemini/antigravity-ide/conversations/*.db` |
| Codex | `~/.codex/session_index.jsonl` |
| Kiro IDE | `~/.kiro/sessions/<workspace-hash>/<id>/messages.jsonl` |
| Grok CLI | `~/.grok/sessions/<url-encoded cwd>/<id>/chat_history.jsonl` |
