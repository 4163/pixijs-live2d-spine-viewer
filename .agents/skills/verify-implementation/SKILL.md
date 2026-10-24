---
name: verify-implementation
description: "Trigger when finishing a slice or when asked to 'verify'. Runs static checks and produces a runtime checklist. Do not trigger validate-changes instead."
argument-hint: "<slice or change description>"
---

# Verify implementation

Prove a finished slice works before recording it as done. Run static checks, hand the user a manual runtime checklist ('runtime list'), and only then update the books.

Read and follow `.agents/AGENTS.md` guidelines for all code and test output.

## Scope

Everything changed since the last clean state. `git diff "@{u}" --name-only` gives the file set, or a user-specified range.

## Workflow

### 1. Static checks & automated tests

Run on every touched file:

- `node --check <file>` for each modified JS file.
- Run the nearest existing playwright spec that exercises the changed code across all three browsers (chromium, firefox, webkit). Use `.agents/skills/blast-radius/SKILL.md` to decide what has to pass. Do not run the full test suite during slice iteration.
- Reserve a full playwright suite run for final slice signoff or changes that touch shared scripts loaded across multiple pages.

Stop and report failures. Do not proceed until they pass.

### 2. Manual runtime verification handoff

Produce a numbered checklist of things that genuinely require human eyes or interaction in the running page:

- UI rendering, layout, and visual correctness.
- User interaction flows (click, keyboard, scroll).
- Cross-browser consistency (chromium, firefox, webkit).
- Responsive behavior at different viewport sizes.

Only include items relevant to the current change set. Do not pad with generic checks.

Each checklist item must be human-readable and self-contained so a tester with no prior context can follow it:

- Write as a concrete instruction: where to go, what to do, what to observe.
- State the expected result in plain language (what the tester should see happen).
- Do not assume the tester knows file names, function names, or internal implementation details; keep code references out of the checklist itself.
- Keep each item to 1 to 3 short sentences. Use plain verbs (Open, Click, Press, Observe, Confirm).

### 3. Report and await user signoff

Do not declare the slice finished.

Stop here. Present the results of the static checks and the runtime list to the user. Wait for the user to explicitly confirm that the checks passed and that the slice is approved for finalization.
