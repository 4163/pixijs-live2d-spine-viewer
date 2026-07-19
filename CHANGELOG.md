# Development History

Legacy development checklist — all items completed.

- [✓] Strip non-Springfield models
- [✓] Download all available C2 variants from IOP Wiki
- [✓] Fix interaction freeze (startRandomMotion → startRandomMotionOnce)
- [✓] Fix chibi Spine 2.1.27 binary format incompatibility
- [✓] Copy and integrate all 5 Springfield chibis
- [✓] Fix Live2D switchback, chibi scaling, degeneration after repeated switches
- [✓] Refactor to single persistent PIXI Application
- [✓] Fix blank L2D after chibi→L2D switch (VAO fix)
- [✓] Download + integrate Cubism 3 models (jacksen168/Eikanya)
- [✓] Upgrade PixiJS v4 → v6 for pixi-live2d-display (dual C2+C3 support)
- [✓] Integrate live2dcubismcore.min.js for Cubism 3 rendering
- [✓] Verify all C2 + C3 models render correctly via Playwright screenshots
- [~] Skipped pixi-spine v4→v6 upgrade; v6 only parses Spine 3.x+ JSON; our .skel models are 2.x binary with no viable conversion path. Keeping v4 + compat stubs was the correct call.
- [✓] Download dorm variant skel files for all 5 Springfield costumes from IOP Wiki
- [✓] Implement dorm mode toggle in Spine viewer (swap skeleton + optional atlas/spritemap)
- [✓] Fix atlas+spritemap pairing: load as a unit, never mix dorm/base mismatched
- [✓] Move dorm toggle button from toolbar to Spine mode area (between mode tabs and model pills) to avoid layout shift
- [✓] Implement pan & zoom canvas (stage-level drag + wheel zoom, sessionStorage persistence)
- [✓] Implement multi-model Spine playground (scatter, drag, duplication, localStorage persistence)
- [✓] Add URL hash routing for playground (`#playground`)
