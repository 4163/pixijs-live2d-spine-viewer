# Guidelines

Coding standards, architecture rules, and agent workflow.

## Code guidelines
- **Self-documenting code.** Write code that reads clearly on its own. Use descriptive names and flat control flow (early returns over multi-layer nesting). Keep comments minimal and concise. Reserve them for *why*, non-obvious constraints, and maintained module invariants. A short local heading is fine when a file needs to explain an ownership, lifecycle, or persistence rule. Do not add commentary that merely narrates the code.
- **Performance first.** Avoid dynamic evaluations and allocations in hot paths. Cache aggressively.
  *Practical examples for agents (match the pattern to the canvas and renderer lifecycle):*
  1. **Hot path optimization.** Keep `pointermove`, stage drag, and pan/zoom handlers cheap. Never parse configs, read bounding boxes, or allocate objects inside event listeners.
  2. **Single persistent WebGL application.** A single `PIXI.Application` (`window.__sharedApp`) lives for the tab lifetime. Never destroy or re-instantiate the WebGL context across mode switches. Only clean up stage children (`destroyLive2D()`, `destroyChibi()`).
  3. **Synchronous canvas resize.** Never use PixiJS built-in `resizeTo`, which reallocates the framebuffer and flashes a blank frame. Use `ResizeObserver` calling `renderer.resize(w, h)` and `app.ticker.update()` synchronously in the same frame.
  4. **Async cancellation tokens.** Increment and check `window.__loadToken` during async model loading so rapid clicks across models or modes abort inflight loads and prevent zombie models on stage.
  5. **In-memory asset caching.** Cache fetched binary skeletons (`.skel`), atlas text, and Live2D model assets in `window.__MODEL_CACHE` to avoid re-fetching files when switching between previously loaded models.
  6. **Zero allocations in animation and export loops.** Pre-allocate buffers and typed arrays outside `requestAnimationFrame` callbacks and `exporter.js` frame capture loops. Never allocate closures or objects inside render ticks.
  7. **IIFE isolation.** Wrap page and renderer logic in an IIFE to keep module state private and avoid polluting `window` outside explicit global hooks.
  8. **Minimal DOM writes.** Update toolbar, spinner, and status readouts through `window.__viewerCallbacks` using `textContent` and `classList`. Never set inline visual styles from canvas controllers.
- **Measure twice, cut once.** Prefer small, deliberate changes over broad refactors. Before writing new logic, search the codebase for an existing helper that already does the job. Prefer intuitive shared helpers over inlining repeated lines of code for identical operations. If a change duplicates logic across callsites, extract it into a shared helper instead.
- **Work in logical slices.** Prioritize small, precise code changes rather than big blocks to prevent tooling and scope failures, especially during large refactors. Be surgical!
- **YAGNI.** Do not add abstractions, features, or complexity without a clear need.

## Agent behavior
- Read every rule and referenced skill before starting work. Confirm adherence to the user.
- Keep responses concise and focused on the task.
- Follow existing code style and formatting for each directory and its associated files.
- Avoid using browser automation/browser subagent. Use playwright for any complex frontend debugging.
- When running playwright tests, execute them from the `playwright/` directory. Verify that behavior and layout match across all three browser projects (chromium, firefox, webkit) defined in `playwright.config.js`.
- For writing work, read `.agents/skills/unslop/SKILL.md` and follow it even if the harness does not auto-load always-active skills. This applies to docs, prompts, comments, and user-facing copy.
- For changes touching shared code, configs, or interfaces, read `.agents/skills/blast-radius/SKILL.md` to trace downstream consumers and prove safety with code.
- Verify using `.agents/skills/verify-implementation/SKILL.md` when finishing a slice or when asked to "verify".
- Validate using `.agents/skills/validate-changes/SKILL.md` when explicitly asked to "validate" code. Do not confuse "verify" (tests and docs) with "validate" (architecture review).

### Guardrails
- **No automated git commits.** Never execute git commit commands or automate commits unless explicitly instructed. The user handles all commits manually or through the commit pipeline.
- **Downstream safety.** When modifying core cross-cutting surfaces (shared PIXI app bootstrap, model configs, asset cache interception, or library compatibility stubs), stop and prove you have not broken downstream consumers. Do not rely on speculation or writeups. Run targeted playwright checks and confirm nothing broke.
- **Targeted testing via playwright.** Run only the relevant spec file, not the full suite. When no spec covers the changed surface, do not run playwright. Reserve full suite runs for final slice verification.
- **Validate before presenting.** Every implementation plan, report, analysis, and roadmap must be compared against `.agents/skills/validate-changes/SKILL.md` rules before presenting it to the user. This applies to agent messages, artifacts, and any document written under `.agents/`. The message, artifact, or document must state at the top that this validation comparison was performed.
- **Agent-facing plans.** For any implementation plan written under `.agents/`, treat it as a continuation doc that a cold agent on a different harness can pick up from a dirty tree without a handoff. Use ordered checklists with file:line references, accept criteria per item, and `[x]`/`[ ]`/`[~]` state. Lock definitions and deviation rules at the top so the plan does not drift across sessions.
- **No test harness creation during implementation.** Do not create new test suites or test harnesses while implementation work is in progress. Manual runtime tests carry higher value because test harnesses written against incomplete code are fragile and waste implementation time. Edit existing tests only when a code change breaks them (blast radius). Using playwright to debug the implementation work that is currently being done is allowed.
- **No premature finalization.** Never declare work done, implemented, or complete until the user explicitly says so. Do not write completion summaries or treat a slice as finished on your own.

## Architecture rules

Keep the codebase from drifting into mixed patterns. Apply these on every change. Order for UI work is structure, then presentation, then behavior.

### Shared
- **One owner per concern.** Each surface or responsibility has exactly one writer (a status readout, spinner visibility, model stage lifecycle, camera transform, or asset interception).
- **Folders are a byproduct of splitting.** A file moves into a feature folder only when a slice creates a sibling. No pure reorganization changes.
- **Pure modules first.** Canvas renderers, loaders, and math utilities have zero DOM / UI imports. UI modules import them; never the reverse.
- **Communicate across files via state callbacks, not reach-in.** Module A updates shared state (or emits state callbacks). Module B paints what it owns. A module may mutate its own stage objects or view-local state (drag, hover, pan) without reaching into the DOM.
- **Do not split a single owner** into sibling files that all touch the same surface. That relocates coupling without removing it.
- **Refactors do not change behavior** unless there is a practical function or UX/performance win.

### HTML-first rendering
- Prefer static markup over `createElement` / `innerHTML` for stable chrome (menus, rows, badges, probes, placeholders).
- Toggle visibility and state with CSS classes or tokens. Do not remove and re-insert nodes to hide them.
- When a node must be created at runtime, declare a placeholder or template in HTML first.
- Recycle existing nodes on update. Do not wipe a container and rebuild it when slots or a pool already exist.
- A dynamically sized pool is fine when the count depends on viewport or font size.
- Default update path: `textContent`, `src`, `classList`, `data-*`.

### CSS source of truth
- Each page owns its primary stylesheet for layout and components.
- Design tokens are CSS custom properties defined on `:root`. Components consume them rather than hardcoding repeated magic values.
- **CSS is the visual source of truth.** JS must not set intrinsic visual values (`width`, `height`, `display`, `cursor`, `opacity`, `color`, `image-rendering`, etc.) via inline `style` or presentational HTML attributes.
- Allowed JS writes: CSS custom properties on `:root` or a host node, viewport / virtualization `transform` matrices, and `classList` / `data-*` state.
- Class and custom-property assignment follows the 3-tier scope model (keep style invalidation local):
  1. **Global.** `html` / `body` for window-wide modes. Direct rules only; never `body.foo *`.
  2. **Component.** Host node for coordinated child state.
  3. **Leaf.** The target element.

### JS module ownership
- Canvas renderers own stage display objects and have no DOM. UI modules subscribe to state callbacks and render themselves.
- Domain logic lives in pure service modules (no `document`). Model manifests and layout overrides have one registry (`VIEWER_CONFIG`); other files derive from it. Asset caching, binary shims, and animation encoders live in their own layers; the canvas renderers do not know their names; stage canvases have one UI owner.
- Each UI feature owns its DOM and self-subscribes. Bootstrap stays thin: init + a slim state fan-out. It does not render another module's surface or mutate internal model meshes.
- A coordinator such as `cache.js` owns its domain and has no DOM. The file that paints a surface is the only writer for that surface.
- Shared canvas helpers (pan/zoom, resize observer) stay out of model renderers and out of feature UI files.
- New frontend work extends this layering. Do not dump new DOM into bootstrap or new domain logic into a UI file. Playwright tests live in `playwright/`, strictly outside the site root.
