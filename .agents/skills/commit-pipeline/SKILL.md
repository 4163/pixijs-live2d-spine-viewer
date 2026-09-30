---
name: commit-pipeline
description: "Commit and push the working tree, or format commit and pull request messages. Trigger when explicitly told to commit, push, or write/serve commit or PR messages."
argument-hint: "<push, push-x, push-a, pr, or commit context>"
---

# Commit pipeline

Use this skill when the user asks to run, emulate, update, or follow the repository commit pipeline, or when the user asks to generate, format, or serve commit messages (e.g. header and body) or pull request titles and bodies. The root `Makefile` keeps the `make push`, `make push-x`, and `make push-a` commands as shortcuts to `.agents/skills/commit-pipeline/scripts/commit-pipeline.py`.

## Critical constraint

Never modify the working tree while running the commit pipeline. Do not edit, create, or delete files. The permitted Git operations are staging and unstaging (including partial staging via hunks/patching), committing, and pushing. Do not rewrite history or create unnecessary micro-commits.

If invoked by the pipeline script itself (indicated by the `[COMMIT_PIPELINE]` marking, `Follow the workflow in '.../SKILL.md'`, or `User-provided context` in the prompt), do not attempt to run `commit-pipeline.py` or `Makefile` commit shortcuts (like `make push`). Instead, execute raw `git` commands directly to complete the workflow.

This constraint applies to the pipeline run itself. It does not forbid editing this skill when the user explicitly asks to update the pipeline.

## Workflow

To generate accurate commits and commit messages, understand the recent changes before committing:

1. Review the working tree with `git status` and `git diff`.
2. Familiarize with the project structure and related files when the diff is not minimal or straightforward.
3. Verify `.gitignore` coverage before staging. Do not track generated runtime config, portable config, build output, personal directory-sort metadata, personal user paths or file names, or any sensitive data. If portable mode or test harnesses write personal paths/data, ensure those files are ignored.
4. Group changes into logical commits. Prioritize user-provided context when present to guide grouping and intent. Use one commit per feature, fix, refactor, documentation update, build change, or other cohesive change. Keep related changes together, even if they span multiple files. Split commits only when the changes are independent and could reasonably be reviewed or reverted separately.
5. Stage only the files for the current commit with `git add` (or unstage files with `git restore --staged` if all changes were pre-staged), then verify the staged changes with `git diff --cached`.
6. Commit the current logical group with `git commit -m`, following the message rules below. Repeat until the working tree is clean.
7. Push all commits with `git push`.

## Commit messages

Write commit messages from the staged diff and verified context:

- **Header:** Concise past-tense summary, preferably under 50 characters.
- **Body:** Explain what changed and why. Prefer a regular paragraph body; bullets are fine when multiple distinct points benefit from list formatting.
- **Tense:** Write the entire message in past tense. Bullets describe what the diff did (`Moved X`, `Kept Y`, `Added Z`), not present-tense instructions (`Moves X`, `Improves Z`).
- **Technical details:** Include complex or non-obvious implementation decisions.

## Pull requests

Write pull request descriptions from the branch diff against base (`git log <base>..HEAD`):

- **Title:** Follow repository conventions: `<Category>: <Major area 1>, <Major area 2>, and <Major area 3>` (e.g. `Feature: ...`, `Refactor: ...`, `Extractor: ...`) or `<Scope> overhaul: <Area 1>, <Area 2>, and <Area 3>`. Keep it concise and descriptive.
- **Body structure:**
  1. **User-facing summary:** A concise opening paragraph explaining what the branch accomplishes and why from a user and architectural perspective.
  2. **Key changes:** Bulleted list grouped by subsystem or concern with bold lead-ins (e.g. `- Return-first imports: ...`, `- Optimistic Library deletion: ...`). Explain what changed and why, emphasizing contract adjustments, boundary fixes, and performance wins.
  3. **Verification:** Concluding statement of automated checks, targeted test suites, and passing test counts verified before merge (e.g. `node --check`, `cargo test <target>`, `npm test, 196 passing`).

## Serving messages to the user

When asked to generate or format a commit message or a pull request description:

- Serve the header/title and the body in individual copy-able code blocks (one ` ```text ` block for the header/title, and one for the body).
- Follow `.agents/skills/unslop/SKILL.md`: use active voice, plain speech, and avoid em dashes or puffery.
