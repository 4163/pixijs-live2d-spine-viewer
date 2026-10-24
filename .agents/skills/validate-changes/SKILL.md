---
name: validate-changes
description: "Trigger only when asked to 'validate'. Runs an architectural review against AGENTS.md and checks for stale code and references. Do not use this for general slice completion, instead use verify-implementation."
argument-hint: "<target file, diff, commit range, branch, or working tree>"
---

# Validate changes

Use this skill to run a strict compliance check of code changes against the repository's architectural standards (`.agents/AGENTS.md`). This acts as an adversarial review to catch regressions, drift, or violations before a branch is considered done.

## Important constraint

**Reporting only.** This skill is strictly an adversarial review tool. Do NOT attempt to automatically fix the violations you find. Your goal is solely to identify issues and report them to the user.

## Workflow

1. **Scope the review.** Determine what to check:
   - **File as an anchor.** Use the specified file to find where a slice began: run `git log <upstream> --full-history --oneline -- "*<name>*"`. The review covers all code changed across that range: `git diff <commit>^..HEAD -- ":(exclude)*.md"`.
   - **Branch or commit range.** Run `git diff <range>` or `git diff <base>..HEAD`.
   - **Working tree.** Run `git diff` or `git diff --cached`.
   If the diff is large, focus on core logic, architecture boundaries, and performance.

2. **Review against `.agents/AGENTS.md`:**
    Read and cross-reference the changes specifically against the guidelines in `.agents/AGENTS.md`. Pay special attention to:
    - **Code guidelines:** Are we using flat control flow and early returns? Are hot paths caching aggressively? Are there any dynamic evaluations where pre-computed values could be used?
    - **HTML-first rendering:** Are we relying on static markup? Are we toggling visibility via CSS classes instead of `createElement` / `innerHTML`? Are nodes being recycled?
    - **CSS source of truth:** Is JS setting intrinsic visual values inline (e.g., `width`, `color`, `display`) instead of relying on CSS custom properties or classes?
    - **JS script ownership:** Does each script own one concern? Are shared scripts used correctly without merging unrelated behavior? Are archive subproject scripts staying self-contained?
    - **Redundant code and shared helpers:** Did the diff inline repeated lines of code for identical operations across callsites instead of using or extracting a shared helper? Did it miss an existing helper that already does the job?
    - **Stale code and references:** Are there unused variables, dead functions, orphaned files, outdated comments, or stale selectors that point to renamed or removed elements? Does the diff leave behind code that is no longer reachable? Use grep for old names, check references, and verify every moved file has its callers updated.

    For every finding, mark severity:
    - `[Blocking]`: Direct rule breaks, broken ownership boundaries, or regression risks.
    - `[Warning]`: Architectural drift, premature abstractions, duplicated logic, or hot-path allocations.
    - `[Nit]`: Dead code, unused variables, stale comments, or minor hygiene issues.

3. **Synthesize the verdict:**
   Output your findings in a structured Markdown format for the user:

    ```markdown
    ## Validation report
    
    **Target:** (e.g., Working tree, staged changes, or branch name)
    **Summary:** (A high-level 1-2 sentence description of what the diff accomplishes)
    
    ### AGENTS.md violations
    (List blocking issues, architectural drift, or rule violations found during the review. If none, explicitly state "None".)
    - [File:Line] [Blocking|Warning|Nit] Describe the violation and which AGENTS.md rule it breaks.
    
    ### Redundant code and shared helpers
    (List inlined repetitive code, duplicated logic across callsites, or missed opportunities to reuse or extract intuitive shared helpers. If none, explicitly state "None".)
    - [File:Line] [Blocking|Warning|Nit] Describe the duplicated logic and the recommended shared helper.

    ### Stale code and references
    (List unused variables, dead functions, orphaned files, outdated comments, or stale selectors that point to renamed or removed elements. If none, explicitly state "None".)
    - [File:Line] [Blocking|Warning|Nit] Describe the stale reference and why it is no longer needed.
    
    ### Verdict
    (Pass / Pass with warnings / Fail)
    (Provide recommendations on how the user should remediate the violations, if any.)
    ```
