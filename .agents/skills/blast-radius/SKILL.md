---
name: blast-radius
description: When a change touches shared interfaces, configs, schemas, or cross-cutting code, find what it could break beyond the diff and prove safety by running code, not writing it up.
argument-hint: "<shared surface or file changed>"
---

# Blast radius

Find what a change breaks somewhere else, before it ships. Use it for "blast radius of X", "what could this break", or a diff in shared behavior that must be proven before it lands.

Read the diff first. Look for consumers the diff never names. Grep will find direct callers. The miss is usually one step past them: an indirect caller, a saved file on disk, an external consumer, or an element queried by string.

## Don't trust your own writeup

A blast-radius writeup that sounds right is worthless. It reads as convincing whether or not it's true. Find the one or two facts the whole thing depends on and prove them by running code. Words are where you start, not what you ship.

### Confidence ladder

For each fact the change's safety depends on, get it as far down this list as is cheap, and say where it stopped.

1. **You said so.** Worthless on its own.
2. **You pointed at the line.** A real `file:line` reference.
3. **You showed the bad case can't happen.** You walked the failure path step by step and it doesn't reach.
4. **You ran it.** A script or test that calls the real code and fails loud if you're wrong.
5. **You reproduced it in the running app.**

Any safety fact you can't get to step 4, say so out loud. Don't write it up as settled.

## What to trace

Start from the diff. For each changed function, parameter, type, command, token, or key, find who else interprets it. Typical places:

- Callers that read a return value, argument signature, or error condition differently from the writer
- Configuration files, state snapshots, or saved data that already exist on disk or in local storage
- Contracts crossing boundaries: threads, workers, child processes, networks, or IPC payloads
- Dynamic string matches: CSS selectors, tokens, element IDs, event names, or protocol URLs
- Structural dependencies: parent and child nesting, object key assumptions, or lifecycle order

Stay inside what the diff reaches.

## Pick a test

Run the smallest existing test, spec, or verification script that calls the real code and fails loud if you are wrong. Search the test directories for the feature or file you changed. A targeted test filter, single spec file, or focused runner command is the usual fit. Avoid running the full test suite during slice iteration. Save full runs for changes that cross multiple zones, or for final signoff.

## Steps

1. Read the change.
2. Trace who consumes each modified function, type, command, token, or contract. Go past direct callers to indirect readers: files on disk, external handlers, UI selectors matching an identifier you renamed.
3. For each consumer, name the failure if the change is wrong.
4. Climb the confidence ladder. Prove safety with code where that is cheap. Use the targeted test picked above. Flag anything stuck at steps 1 and 2.
5. Fix broken downstream consumers in the same slice. If you cannot reach confidence step 4 for a critical safety fact, tell the user what still needs a manual check.
