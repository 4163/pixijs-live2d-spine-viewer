1: ---
2: name: commit-pipeline
3: description: "Commit and push the working tree, or format commit messages. Trigger when explicitly told to commit, push, or write/serve commit messages."
4: argument-hint: "<push, push-x, push-a, or commit context>"
5: ---
6: 
7: # Commit pipeline
8: 
9: Use this skill when the user asks to run, emulate, update, or follow the repository commit pipeline, or when the user asks to generate, format, or serve commit messages (e.g. header and body). The root `Makefile` keeps the `make push`, `make push-x`, and `make push-a` commands as shortcuts to `.agents/skills/commit-pipeline/scripts/commit-pipeline.py`.
10: 
11: ## Critical constraint
12: 
13: Never modify the working tree while running the commit pipeline. Do not edit, create, or delete files. The permitted Git operations are staging and unstaging (including partial staging via hunks/patching), committing, and pushing. Do not rewrite history or create unnecessary micro-commits.
14: 
15: If invoked by the pipeline script itself (indicated by the `[COMMIT_PIPELINE]` marking, `Follow the workflow in '.../SKILL.md'`, or `User-provided context` in the prompt), do not attempt to run `commit-pipeline.py` or `Makefile` commit shortcuts (like `make push`). Instead, execute raw `git` commands directly to complete the workflow.
16: 
17: This constraint applies to the pipeline run itself. It does not forbid editing this skill when the user explicitly asks to update the pipeline.
18: 
19: ## Workflow
20: 
21: To generate accurate commits and commit messages, understand the recent changes before committing:
22: 
23: 1. Review the working tree with `git status` and `git diff`.
24: 2. Familiarize with the project structure and related files when the diff is not minimal or straightforward.
25: 3. Verify `.gitignore` coverage before staging. Do not track generated runtime config, portable config, build output, personal directory-sort metadata, personal user paths or file names, or any sensitive data. If portable mode or test harnesses write personal paths/data, ensure those files are ignored.
26: 4. Group changes into logical commits. Prioritize user-provided context when present to guide grouping and intent. Use one commit per feature, fix, refactor, documentation update, build change, or other cohesive change. Keep related changes together, even if they span multiple files. Split commits only when the changes are independent and could reasonably be reviewed or reverted separately.
27: 5. Stage only the files for the current commit with `git add` (or unstage files with `git restore --staged` if all changes were pre-staged), then verify the staged changes with `git diff --cached`.
28: 6. Commit the current logical group with `git commit -m`, following the message rules below. Repeat until the working tree is clean.
29: 7. Push all commits with `git push`.
30: 
31: ## Commit messages
32: 
33: Write commit messages from the staged diff and verified context:
34: 
35: - Header: concise past-tense summary, preferably under 50 characters.
36: - Body: explain what changed and why. Separate it from the header with a blank line.
37: - Tense: write the whole commit message in past tense. The header and body bullets describe what the staged diff did, not what it will do.
38: - Bullets: use them when the body has multiple points. Do not force active voice or present-tense action verbs. Prefer `Moved X`, `Kept Y`, or `Added Z` over `Moves X`, `Ensures Y`, or `Improves Z`.
39: - Technical details: include complex or non-obvious implementation decisions.
40: 
41: ### Serving messages to the user
42: 
43: When the user asks for a header and body (or title and body):
44: - Serve the header and body in a single copy-able code format block (e.g., ` ```text `).
45: - Always separate header and body with a single blank line (whitespace-only line), regardless of paragraph or bullet body.
46: - Prefer serving a regular paragraph body instead of bullet points.
47: - While not preferred, bullets may still be used if needed when multiple distinct points benefit from list formatting.