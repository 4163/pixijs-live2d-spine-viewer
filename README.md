# PixiJS Live2D & Spine WebGL Viewer

## Overview
This project is a flexible, standalone WebGL renderer built on PixiJS, designed to display Live2D (Cubism 2 and 3) and Spine 2.x skeletal animations. 

Implementation uses *Girls' Frontline* models (specifically M1903 Springfield), but the underlying architecture is strictly decoupled. The main rendering happens via the core dependencies over at `lib/` through `app.js` & `chibi.js` over at `js/`. Any DOM manipulation (UI, updates etc.) is handled using 'main.js', which communicates exclusively via state callbacks. This makes it incredibly easy to swap/add in models from other games, implement new features, or seamlessly embed the viewer into existing websites and web apps.

## Stack

| Library | Version | Purpose |
|---|---|---|
| [PixiJS](https://pixijs.com/) | v6.5.10 | WebGL renderer, stage, ticker |
| [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) | v0.5.0-beta | Cubism 2 + 3 integration |
| [Live2D Cubism 2.1 SDK](https://www.live2d.com/) | 2.1 | Cubism 2 model core |
| [Live2D Cubism 4 SDK](https://www.live2d.com/) | 4.x | Cubism 3/4 model core |
| [pixi-spine](https://github.com/pixijs/pixi-spine) | v4 (custom build) | Spine 2.x rendering |
| spine2-skeleton-binary | — | Spine 2.1.27 binary→JSON shim |

## Project Structure
```text
├── index.html                      # Entry point (mode tabs, PixiJS v6 compat stubs)
├── icon.png                        # Favicon / PWA icon
├── css/
│   ├── main.css                    # Core styles, theme, toolbar, pills, transitions
│   └── mobile.css                  # Mobile-responsive overrides
├── js/
│   ├── app.js                      # Live2D viewer (initLive2DMode / destroyLive2D, repositionLive2D)
│   ├── cache.js                    # Model asset cache (intercepts XHRLoader and window.fetch)
│   ├── chibi.js                    # Spine chibi viewer (initChibiMode / destroyChibi, repositionChibi)
│   ├── config.js                   # VIEWER_CONFIG (relativeDraw, keepOriginalDimensions, layout)
│   ├── main.js                     # PIXI init, manifest loading, mode switching, resize, boot
│   ├── pan-zoom.js                 # Stage-level pan & zoom (drag, wheel, sessionStorage persistence)
│   └── playground.js               # Multi-model Spine playground (scatter, drag, localStorage persistence)
├── lib/
│   ├── live2d.min.js               # Cubism 2.1 SDK for Web (C2 models)
│   ├── live2dcubismcore.min.js     # Cubism 4 SDK for Web (C3/C4 models)
│   ├── pixi.min.js                 # PixiJS v6.5.10
│   ├── pixi-live2d-display.min.js  # pixi-live2d-display (guansss) — dual C2+C3
│   ├── pixi-spine.js               # Custom pixi-spine from cullus/gfSpinePiXi (Spine 2.x runtime)
│   ├── pixi-live2d.js              # OLD v4 bridge (retained for reference, unused)
│   └── spine2-skeleton-binary.js   # Spine 2.1.27 binary parser (from cullus/gfSpinePiXi)
├── models/
│   ├── cubism2/                    # Cubism 2 model dirs + manifest
│   ├── cubism3/                    # Cubism 3 model dirs (m1903_5, m1903_1107) + manifest
│   └── spine/                      # Spine chibi model dirs + manifest
└── README.md
```

> **Demo content:** Bundled with Girls' Frontline Springfield (M1903) assets as a reference implementation. Swap or add in your own models by editing the manifest files under `models/`.

## Adding Your Own Models

### 1. Drop your files into the right folder

| Format | Folder | Required files |
|---|---|---|
| Cubism 2 | `models/cubism2/<name>/` | `*.moc`, `*.model.json`, textures, motions |
| Cubism 3/4 | `models/cubism3/<name>/` | `*.moc3`, `*.model3.json`, textures, motions |
| Spine 2.x | `models/spine/<name>/` | `atlas.txt`, `skeleton.skel`, `spritemap.png` (+ optional `atlas_dorm.txt`, `skeleton_dorm.skel`, `spritemap_dorm.png`) |

### 2. Register your model in the manifest

Add an entry to the appropriate manifest under `models/`:

**Cubism 2** (`models/cubism2/manifest.json`):
```json
{ "id": "my_model", "name": "My Model", "type": "cubism2",
  "json": "models/cubism2/my_model/my_model.model.json" }
```

**Cubism 3/4** (`models/cubism3/manifest.json`):
```json
{ "id": "my_model", "name": "My Model", "type": "cubism3",
  "json": "models/cubism3/my_model/my_model.model3.json" }
```

**Spine** (`models/spine/manifest.json`):
```json
{ "id": "my_chibi", "name": "My Chibi", "type": "spine",
  "dir": "models/spine/my_chibi" }
```

If the model has its own dorm atlas files (`atlas_dorm.txt` + `spritemap_dorm.png`), add `"dormAtlas": true`:
```json
{ "id": "my_chibi", "name": "My Chibi", "type": "spine",
  "dir": "models/spine/my_chibi", "dormAtlas": true }
```
Models without this flag reuse the base `atlas.txt` + `spritemap.png` in dorm mode (only `skeleton_dorm.skel` is swapped).

## Format Notes

### Cubism 2 vs Cubism 3
Both are rendered by [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display). The library detects format automatically from the entry point file extension (`.model.json` = C2, `.model3.json` = C3).

### Spine Version Compatibility
Only **Spine 2.x binary** (`.skel`) is supported. The `lib/spine2-skeleton-binary.js` shim converts the binary to JSON, parsed by the included pixi-spine v4 runtime.
- **Spine 3.x / 4.x** would require replacing `lib/pixi-spine.js` with a matching runtime version.
- **Spine JSON format** (any version) would require a JSON parser from the appropriate runtime.

## Springfield Model Inventory

### Cubism 2 (Live2D) — In Viewer
| Game Code | Costume | EN Search | JP Search | CN Search | Motions | In Viewer |
|-----------|---------|-----------|-----------|-----------|---------|-----------|
| `M1903_302` | costume1 (Classic Witch) | Classic Witch | クラシックウィッチ | 经典魔女 | 10 + physics | ✅ N + D |
| `M1903_4?` | costume4 (Stirring Mermaid) | Stirring Mermaid | スターリングマーメイド | 清凉夏日 | 1 idle, no physics | ✅ N + D |

IOP Wiki: `https://iopwiki.com/images/{hash1}/{hash2}/Springfield_costume{N}_{variant}_{type}.{ext}`

### Cubism 3 (moc3) — Integrated
| Game Code | Costume Name | Variants | Motions | Source |
|-----------|--------------|----------|---------|--------|
| `M1903_5` | Classic Witch (costume1) | normal + destroy | 11 normal, 8 destroy | [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) |
| `M1903_1107` | Stirring Mermaid (costume4) | normal + destroy | 1 each (simplified) | [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) |

- C3 models have `Groups` instead of `HitAreas`, `.motion3.json` instead of `.mtn`, `.moc3` instead of `.moc`
- Requires `live2dcubismcore.min.js` (Cubism 4 SDK) + `pixi-live2d-display` to render
- **Source Notes**: Models extracted from the Girls' Frontline game client by the Eikanya project ([`少女前线 girls Frontline/live2dnew`](https://github.com/Eikanya/Live2d-model/tree/master/%E5%B0%91%E5%A5%B3%E5%89%8D%E7%BA%BF%20girls%20Frontline/live2dnew)). The internal game IDs (`m1903_5`, `m1903_1107`) correspond to the Classic Witch and Stirring Mermaid skins respectively — confirmed by visual inspection.
- Note: The `live2dold` subfolder of the same Eikanya repo also hosts C2 (`.moc`/`.mtn`) versions of the same two costumes, which are equivalent to what we have under `models/`.

### Spine Chibis — In Viewer
| Dir | Costume | Atlas Ref | Dorm skel | Dorm atlas | Dorm spritemap |
|-----|---------|-----------|-----------|------------|----------------|
| `classic_witch` | Classic Witch | `M1903_5.png` | ✅ | ✅ | ✅ |
| `default` | Default | `M1903.png` | ✅ | (reuses base) | (reuses base) |
| `o_holy_night` | O Holy Night | `M1903_302.png` | ✅ | ✅ | ✅ |
| `queen_in_radiance` | Queen in Radiance | `M1903_802.png` | ✅ | (reuses base) | (reuses base) |
| `stirring_mermaid` | Stirring Mermaid | `M1903_1107.png` | ✅ | (reuses base) | (reuses base) |

Files per costume:
- Base: `atlas.txt`, `skeleton.skel`, `spritemap.png`
- Dorm: `atlas_dorm.txt`, `skeleton_dorm.skel`, `spritemap_dorm.png`

Source: IOP Wiki profile pages. Dorm files from wiki File pages (e.g. `Springfield_costume1_chibi_dorm_skel.skel`).

### Springfield Costume Summary

> **Naming Note:** The GFL1 anniversary costume is "Queen under the Lantern" (灯下女王). "Queen in Radiance" is a separate GFL2:Exilium costume, not related to GFL1 assets.

| Costume | EN Name (GFL1) | Internal ID | C2 (moc) | C3 (moc3) | Chibi (skel) | L2D? |
|---------|---------------|-------------|----------|----------|--------------|------|
| costume1 | Classic Witch | `m1903_5` | ✅ | ✅ | ✅ | **YES** |
| costume2 | O Holy Night | `m1903_302` | ❌ | ❌ | ✅ | **NO** (confirmed IOP wiki) |
| costume3 | Queen under the Lantern | `m1903_802` | ❌ | ❌ | ✅ | **NO** (confirmed namu.wiki) |
| costume4 | Stirring Mermaid | `m1903_1107` | ✅ | ✅ | ✅ | **YES** |

Only 2 of Springfield's 4 costumes have Live2D in GFL1. **We have 100% of all Springfield L2D assets.**

## Model Discovery Research

### Future Search Guidelines for Agents
When doing exhaustive asset searches for other games (e.g. GFL2, Nikke, Azur Lane), you MUST follow these steps:
1. **Exhaustive Multilingual Web/Google Search:** Search across EN, JP, CN, and KR regions using native characters (e.g. 少女前线, 소녀전선, ドルフロ) and terms like `live2d`, `spine`, `moc3`, `skel`, `extract`, `asset dump` to find hidden community repos and CDN mirrors.
2. **Game Asset Repos:** Check GitHub for dedicated community datamine/extraction repositories (sort by recently updated).
3. **Community Mirrors:** Check specialized wikis, fan sites, and community boards (e.g., namu.wiki, moegirl).
4. **Data Verification:** Cross-reference found assets against official costume lists to definitively confirm whether an asset actually has Live2D/Spine or is just a static image.

Exhaustive search conducted for GFL1 Springfield (2026-07-17) across game asset repos, community mirrors, CN/JP/KR sources, and IOP wiki data.

### Repositories Checked (GitHub)
| Repo | Stars | Springfield Models Found |
|------|-------|--------------------------|
| [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) | ~2k | `m1903_5` + `m1903_1107` (C3 in `live2dnew`, C2 in `live2dold/gun`) |
| [kaiyukeji/Girls-Frontline](https://github.com/kaiyukeji/Girls-Frontline) | 49 | `m1903_5` + `m1903_1107` (C3 only) |
| [jacksen168/Girls-Frontline-model](https://github.com/jacksen168/Girls-Frontline-model) | 8 | `m1903_5` + `m1903_1107` (C3 only) |
| [fog-forest/live2d](https://github.com/fog-forest/live2d) | 41 | `m1903_5` (C2 in `live2d/model/girls-frontline`) |
| [shuoGG/Live2d-model (Gitee)](https://gitee.com/shuoGG/Live2d-model) | - | `m1903_5` only (C2) |
| [zenghongtu/live2d-model-assets](https://github.com/zenghongtu/live2d-model-assets) | - | No Springfield |
| [xiaoxian2026/Live2d-model-2026](https://github.com/xiaoxian2026/Live2d-model-2026) | - | Mirror of Eikanya |
| [tomoya0320/live2d-model-collections](https://github.com/tomoya0320/live2d-model-collections) | - | No GFL content |
| [test157t/Live2dModels-ST-](https://github.com/test157t/Live2dModels-ST-) | - | No GFL content (AzurLane etc.) |
| [namv22/GFL-Live2D-Viewer](https://github.com/namv22/GFL-Live2D-Viewer) | 7 | Unity project, no bundled assets |
| [Dimbreath/GirlsFrontlineData](https://github.com/Dimbreath/GirlsFrontlineData) | - | Text/DB data only |
| [slyfoxz/GFLDecrypt](https://github.com/slyfoxz/GFLDecrypt) | 2 | Decryption tool only, no assets |
| [Rosmontis-demo/Girls_frontline_live2d_extract](https://github.com/Rosmontis-demo/Girls_frontline_live2d_extract) | 2 | Extraction tool (C#), no assets |
| srpg-kr.github.io/live2d/ | - | GFL2 story illustration viewer, not GFL1 |

### Definitive Confirmation Sources
- **O Holy Night has NO L2D:** IOP wiki T-Doll Costume Index explicitly marks it as non-Live2D ([source](https://iopwiki.com/wiki/T-Doll_Costume_Index))
- **Queen under the Lantern has NO L2D:** Confirmed by namu.wiki costume listing
- **IOP wiki limitations note:** IOP wiki's Live2D page for Springfield **stopped being updated** with newer costumes due to incompatible file formats — it only hosts older C2 assets
- **All 8+ repos checked exhaustively** including C2 (moc/mtn) and C3 (moc3) paths — zero additional Springfield costumes found

### Conclusion
The search is **definitively complete**. Only Classic Witch and Stirring Mermaid have Live2D in GFL1. O Holy Night and Queen under the Lantern are static costumes. No public dump, CDN, or game data repo contains any additional Springfield L2D models beyond what we already have.

## Architecture

### Integration Hooks (`window.__viewerCallbacks`)

`chibi.js`, `app.js`, and `playground.js` never touch the DOM directly. Instead they emit state objects to optional hooks set on `window.__viewerCallbacks`:

| Hook | Called when |
|------|-------------|
| `onStateChange(state)` | Loading progress, model ready state, errors, playground states |
| `onDormChange(active)` | Dorm mode toggled or restored on mode switch |

Set them before mode switching. Both are null-checked; if unset, state updates are silently no-oped.

```js
window.__viewerCallbacks = {
  onStateChange: function(state) {
    // state is a structured object, e.g. { type: 'ready', mode: 'live2d', modelName: 'M1903' }
    // Generates dynamic DOM/UI text strictly on the Controller side.
  },
  onDormChange:  function(active) { /* toggle button class, etc. */ }
};
```

### Config (`js/config.js`)
- `window.VIEWER_CONFIG` — controls viewer behavior:
  - `relativeDraw` (bool): if `false`, skip ALL repositioning (centering + scaling) on resize; if `true` (or unset), re-center and re-scale the L2D/chibi element on canvas resize.
  - `keepOriginalDimensions` (bool): when scaling with canvas, never exceed original pixel size.
  - `live2dBaseY` (number): Base vertical anchor multiplier for Live2D (default `0.5`, center).
  - `chibiBaseY` (number): Base vertical anchor multiplier for Spine chibis (default `0.8`, near bottom).
  - `layout`: per-model overrides keyed by entry `id`:
    - `offsetY` (number): vertical shift multiplier relative to screen height (e.g., `-0.25` is 25% UP)
    - `scale` (number): scale multiplier
  - `spineAnim`: animation configuration for Spine chibis, supporting a `global` fallback or per-model keys. Supports `loop: false`, `followUp: 'anim_name'`, and `hidden: true` (hides from manual clicks).
- Default: `{ relativeDraw: true, keepOriginalDimensions: false }`.

### Model Asset Cache (`js/cache.js`)
In-memory cache map (URL → response data) prevents re-downloading files when switching between previously-loaded models. Two loading paths are intercepted:

- **Live2D files** — wraps `PIXI.live2d.XHRLoader.loader` middleware (all .moc, .moc3, textures, motions, physics, etc.). Also updates `Live2DLoader.middlewares[0]` which held a stale reference to the original loader.
- **Spine files** (`skeleton.skel`, `atlas.txt`) — wraps `window.fetch`. `spritemap.png` loads via `new Image()` (browser HTTP cache, no patch needed).

To add a new fetch-loaded file type, extend the regex: `/(skel|atlas\.txt|new_ext)$/i`. For a new loading API, follow the same pattern: save original → wrap → check `cache[url]` → return cached or call original + store (check for stale references too). Debug via `window.__MODEL_CACHE`.

### Shared PIXI Application (`js/main.js`)
- A single persistent `PIXI.Application` created on page load, stored in `window.__sharedApp`.
- Both modes share this app's stage/renderer. No WebGL context destruction between mode switches.
- **Canvas resize**: Uses `ResizeObserver` on `#canvas-wrap` + `requestAnimationFrame` (not PIXI's `resizeTo`). PIXI's built-in `resizeTo` causes a blank-frame flicker: `renderer.resize()` reallocates the WebGL framebuffer (clearing it), and the next render waits for the following tick. The manual approach calls `renderer.resize()` then `ticker.update()` synchronously — model reposition + render happen in the same frame, so no blank frame appears.
- **Mode switching**: Toggles between Live2D and Chibi. Calls `destroyCurrent()` to clear stage children before initializing the next mode. Pill/dropdown clicks reset the stage transform.
- **Reset button**: Resets stage position/scale and re-runs `repositionLive2D`/`repositionChibi`.
- **Theme toggle**: View-Transition API for radial clip animation. Persisted in localStorage.

### Live2D Mode (Cubism 2 + Cubism 3)
1. `live2d.min.js` — Core Cubism 2.1 WebGL SDK (.moc parse, for C2 models)
2. `live2dcubismcore.min.js` — Core Cubism 4 WebGL SDK (.moc3 parse + physics, for C3 models)
3. `pixi.min.js` v6.5.10 — WebGL framework
4. `pixi-live2d-display.min.js` (guansss) — Unified Live2D display plugin for PixiJS v6
   - Auto-detects model version (`.model.json` = C2, `.model3.json` = C3/C4)
   - API: `PIXI.live2d.Live2DModel.from(url, { autoHitTest: false, autoFocus: false })`
   - `model.focus(x, y)` for mouse tracking
   - `model.on('hit', areas => ...)` for hit area testing
   - `model.motion(group)` for playing random motion from group
   - Handles its own WebGL state — no VAO or shader reset is needed when switching models
5. `app.js` — Loads, positions, and repositions Live2D models
   - `repositionLive2D()`: Early-returns if `cfg.relativeDraw === false`. Otherwise re-centers (with `layout.offsetY`) and re-scales (respecting `keepOriginalDimensions` and `_cfgScale`).
   - `Live2DModel.from()` called with `autoHitTest: false, autoFocus: false` — manual mouse tracking via `model.focus()` and hit events.
   - `model._cfgScale` and `model._entryId` stored on the model for repositioning.
   - `model.internalModel.localTransform` reset for C2 models to bypass `pixi-live2d-display`'s layout bug (incorrect shift with `center_x:0`).
   - `loadModel()` is `await`-ed in `initLive2DMode()` so errors propagate to `switchMode()` try/catch.

### Chibi Mode (Spine)
1. `pixi-spine.js` (custom from gfSpinePiXi) — Spine 2.x runtime with PIXI.spine.SpineRuntime namespace
   - **PixiJS v6 compat stubs** added via `<script>` in index.html:
     - `PIXI.loaders.Loader.addPixiMiddleware` → no-op
     - `PIXI.loader.use` → no-op
     - `PIXI.mesh.Mesh` → mapped to `PIXI.SimpleMesh` (vital: prevents `Cannot set properties of undefined (setting '_parentID')` crashes when PIXI's rendering loop traverses a destroyed Spine object during mode switch cleanup).
2. `spine2-skeleton-binary.js` — Parses Spine 2.1.27 binary .skel → JSON
3. `chibi.js` — Pipeline: SkeletonBinary → PIXI.spine.SpineRuntime.Atlas → AtlasAttachmentParser → SkeletonJsonParser → PIXI.spine.Spine, rendered on shared app stage
   - `repositionChibi()`: Early-returns if `cfg.relativeDraw === false`. Otherwise centers at `(screen.width/2, screen.height * 0.80)`.
   - Per-model `layout.scale` and `layout.offsetY` applied from `entryCfg`.
   - Starts on `wait` animation (looping); click cycles through all animations in order (each loops).

### Dorm Variant (Spine)
A **Dorm** toggle in the mode tab row swaps in `skeleton_dorm.skel` and, when present, `atlas_dorm.txt` + `spritemap_dorm.png`. Atlas+spritemap pair as a unit — if no dorm atlas exists, both base files are used (texture shared, skeleton only changes). Dorm state persists across chibi switches and mode switches (resets on page reload).

### Pan & Zoom Canvas (`js/pan-zoom.js`)
Stage-level transform with pointer drag + wheel zoom, implemented directly against the PixiJS `app.stage`. 
- Zoom clamped 0.2x-5.0x, cursor-relative zoom. 
- Stage position clamped to `maxBound * 2 * scale`. 
- State is persisted via browser `sessionStorage` (resets when closing the tab).
- Integrates seamlessly with specific model interactions by delegating pointer events.

### Multi-Model Playground (`js/playground.js`)
An experimental mode demonstrating how to manage multiple Spine instances simultaneously on a shared PIXI stage.
- **State Persistence**: Serializes model state (positions, animations, dorm variant, duplicate origins) to `localStorage` on interaction, reconstructing the exact scene graph on reload.
- **Procedural Scattering**: Implements rejection sampling for initial placement, dynamically calculating a 20% bounding margin via `app.screen` to prevent edge-clipping.
- **Event Delegation**: Drag events (`pointermove`, `pointerup`) are bound to `app.stage` rather than individual `PIXI.spine.Spine` objects, ensuring drag persistence during fast mouse movements.
- **Cursor State Hierarchy**: Resolves CSS/PIXI conflicts by letting the `app.stage` manage the background cursor (`move` during pan) while interactive child objects define their own hover states (`pointer`).
- **Dynamic Anchoring**: Uses `spine.getLocalBounds()` to correctly position generated sprites relative to the varying physical dimensions of different skeletons.
- **Touch & Desktop Parity**: Native detection of touch screens. Maps Right-Click to Duplicate and Double-Right-Click to Delete on desktop, gracefully adapting to Double-Tap (Duplicate) and Triple-Tap (Delete) on mobile/touch interfaces.



## Playwright Tests

Test scripts live in `playwright/` and require Playwright:

```bash
cd playwright
npm install
node run-verify-final.mjs    # Self-contained server, tests all models (C2, C3, Spine)
```

Useful debug scripts included for troubleshooting:
- `debug-bounds.mjs` (Model dimensions, original size, drawable bounds)
- `debug-c2-deep.mjs` (C2 model internals, 404s, console log capture)
- `debug-switchback.mjs` (L2D→chibi→L2D cycle with full console output)

> **Note**: Use headed mode (`headless: false`) for debugging. Headless Playwright lacks WebGL support required for the C2 SDK.

## Known Issues & Workarounds
- Stirring Mermaid C2: only daiji_idle_01.mtn, no tap_body motions — app.js uses `model.motion()` which plays random motion from group; if group has no motions, nothing happens
- `pixi-live2d-display` v0.5.0-beta (guansss) — may have edge cases with C3 model groups vs hit areas, and has a layout bug with C2 models defining absolute position (fixed in app.js by resetting `localTransform`)
- Chibi mode: `PIXI.mesh.Mesh` is stubbed to `PIXI.SimpleMesh` to prevent `_parentID` crashes during cleanup
- PixiJS v6 compat stubs in index.html — `cullus/gfSpinePiXi`'s pixi-spine reads Spine 2.x binary (.skel) on PixiJS v4. Official pixi-spine v6 reads Spine 3.x+ JSON only; converting all .skel assets is impractical.
- `relativeDraw: true` (default) enables dynamic centering + re-scaling on canvas resize. Set to `false` to keep the model at its initial position/scale.
- Canvas resize blank-frame flicker: PIXI's `resizeTo` calls `renderer.resize()` which clears the WebGL framebuffer, then renders on the next tick — one frame of flash. Fixed by replacing `resizeTo` with a `ResizeObserver` that calls `renderer.resize()` + `ticker.update()` synchronously.

## License

Third-party Live2D SDKs are subject to the [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html). Model assets are subject to their respective game/publisher terms.
