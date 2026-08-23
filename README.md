# PixiJS Live2D & Spine WebGL Viewer

## Live demo
> PixiJS Live2D & Spine Viewer
> https://x4163.netlify.app/pixi

## Overview
A standalone WebGL renderer built on PixiJS that displays Live2D (Cubism 2 and 3) and Spine 2.x skeletal animations.

The bundled models are from *Girls' Frontline* (M1903 Springfield), but models from other sources are also supported. Rendering runs through `app.js` and `chibi.js` against the core libraries in `lib/`. All DOM work lives in `main.js`, which talks to the renderers via state callbacks. The viewer can be embedded in other projects or extended with new features with minimal changes.

## Stack

| Library | Version | Purpose |
|---|---|---|
| [PixiJS](https://pixijs.com/) | v6.5.10 | WebGL renderer, stage, ticker |
| [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) | v0.5.0-beta | Cubism 2 + 3 integration |
| [Live2D Cubism 2.1 SDK](https://www.live2d.com/) | 2.1 | Cubism 2 model core |
| [Live2D Cubism 4 SDK](https://www.live2d.com/) | 4.x | Cubism 3/4 model core |
| [pixi-spine](https://github.com/pixijs/pixi-spine) | v4 (custom build) | Spine 2.x rendering |
| spine2-skeleton-binary | - | Spine 2.1.27 binary→JSON shim |
| [UPNG.js](https://github.com/photopea/UPNG.js) | - | APNG encoding backend |
| [pako](https://github.com/nodeca/pako) | 2.1.0 | DEFLATE compression (for UPNG) |
| [gif.js](https://jnordberg.github.io/gif.js/) | 0.2.0 | GIF encoding backend |

## Project structure
```text
├── index.html                      # Entry point (mode tabs, PixiJS v6 compat stubs)
├── gfl-spinner.svg                 # Animated loading icon (toggled by main.js state callbacks)
├── gfloading.gif                   # Legacy loading spinner gif (from IOP wiki, unused)
├── icon.png                        # Favicon
├── css/
│   ├── main.css                    # Core styles, theme, toolbar, pills, transitions
│   └── mobile.css                  # Mobile-responsive overrides
├── js/
│   ├── app.js                      # Live2D viewer (initLive2DMode / destroyLive2D, repositionLive2D)
│   ├── cache.js                    # Model asset cache (intercepts XHRLoader and window.fetch)
│   ├── chibi.js                    # Spine chibi viewer (initChibiMode / destroyChibi, repositionChibi)
│   ├── config.js                   # VIEWER_CONFIG (relativeDraw, keepOriginalDimensions, layout)
│   ├── exporter.js                 # Multi-format devtools animation exporter (APNG / WebP / GIF)
│   ├── main.js                     # PIXI init, manifest loading, mode switching, resize, boot
│   ├── pan-zoom.js                 # Stage-level pan & zoom controller (decoupled API)
│   └── playground.js               # Multi-model Spine playground (scatter, drag, localStorage persistence)
├── lib/
│   ├── exporter/                   # Animation encoder dependencies (lazy-loaded by exporter.js)
│   │   ├── gif.js                  # GIF encoder
│   │   ├── gif.worker.js           # GIF worker
│   │   ├── pako.min.js             # DEFLATE compression
│   │   ├── UPNG.js                 # APNG encoder
│   │   └── webp-muxer.js           # Animated WebP RIFF muxer
│   ├── live2d.min.js               # Cubism 2.1 SDK for Web (C2 models)
│   ├── live2dcubismcore.min.js     # Cubism 4 SDK for Web (C3/C4 models)
│   ├── pixi.min.js                 # PixiJS v6.5.10
│   ├── pixi-live2d-display.min.js  # pixi-live2d-display (guansss), dual C2+C3
│   ├── pixi-spine.js               # Custom pixi-spine from cullus/gfSpinePiXi (Spine 2.x runtime)
│   ├── pixi-live2d.js              # OLD v4 bridge (retained for reference, unused)
│   └── spine2-skeleton-binary.js   # Spine 2.1.27 binary parser (from cullus/gfSpinePiXi)
├── models/
│   ├── cubism2/                    # Cubism 2 model dirs + manifest
│   ├── cubism3/                    # Cubism 3 model dirs (m1903_5, m1903_1107) + manifest
│   └── spine/                      # Spine chibi model dirs + manifest
└── README.md                       # Project documentation
```

> The bundled *Girls' Frontline* Springfield (M1903) assets are a reference implementation. Swap or add your own models by editing the manifest files under `models/`.

## Adding your own models

### 1. Drop your files into the right folder

| Format | Folder | Required files |
|---|---|---|
| Cubism 2 | `models/cubism2/<name>/` | `*.moc`, `*.model.json`, textures, motions |
| Cubism 3/4 | `models/cubism3/<name>/` | `*.moc3`, `*.model3.json`, textures, motions |
| Spine 2.x | `models/spine/<name>/` | `atlas.txt`, `skeleton.skel`, `spritemap.png` (+ optional `atlas_dorm.txt`, `skeleton_dorm.skel`, `spritemap_dorm.png`) |

### 2. Register your model in the manifest

Add an entry to the appropriate manifest under `models/`:

Cubism 2 (`models/cubism2/manifest.json`):
```json
{ "id": "my_model", "name": "My Model", "type": "cubism2",
  "json": "models/cubism2/my_model/my_model.model.json" }
```

Cubism 3/4 (`models/cubism3/manifest.json`):
```json
{ "id": "my_model", "name": "My Model", "type": "cubism3",
  "json": "models/cubism3/my_model/my_model.model3.json" }
```

Spine (`models/spine/manifest.json`):
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

## Format notes

### Cubism 2 vs Cubism 3
Both are rendered by [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display). The library auto-detects the format from the entry point file extension (`.model.json` = C2, `.model3.json` = C3).

### Spine version compatibility
Only Spine 2.x binary (`.skel`) is supported. `lib/spine2-skeleton-binary.js` converts the binary to JSON, which the included pixi-spine v4 runtime then parses.
- Spine 3.x / 4.x would need a matching runtime version to replace `lib/pixi-spine.js`.
- Spine JSON format (any version) would need a JSON parser from the matching runtime.

## Springfield model inventory

### Cubism 2 (Live2D)
| Game Code | Costume | EN Search | JP Search | CN Search | Motions | In Viewer |
|-----------|---------|-----------|-----------|-----------|---------|-----------| 
| `M1903_302` | costume1 (Classic Witch) | Classic Witch | クラシックウィッチ | 经典魔女 | 10 + physics | ✅ N + D |
| `M1903_4?` | costume4 (Stirring Mermaid) | Stirring Mermaid | スターリングマーメイド | 清凉夏日 | 1 idle, no physics | ✅ N + D |

IOP Wiki: `https://iopwiki.com/images/{hash1}/{hash2}/Springfield_costume{N}_{variant}_{type}.{ext}`

### Cubism 3 (moc3)
| Game Code | Costume Name | Variants | Motions | Source |
|-----------|--------------|----------|---------|--------|
| `M1903_5` | Classic Witch (costume1) | normal + destroy | 11 normal, 8 destroy | [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) |
| `M1903_1107` | Stirring Mermaid (costume4) | normal + destroy | 1 each (simplified) | [Eikanya/Live2d-model](https://github.com/Eikanya/Live2d-model) |

- C3 models use `Groups` instead of `HitAreas`, `.motion3.json` instead of `.mtn`, `.moc3` instead of `.moc`
- Needs `live2dcubismcore.min.js` (Cubism 4 SDK) + `pixi-live2d-display` to render
- Models were extracted from the GFL game client by the Eikanya project ([`少女前线 girls Frontline/live2dnew`](https://github.com/Eikanya/Live2d-model/tree/master/%E5%B0%91%E5%A5%B3%E5%89%8D%E7%BA%BF%20girls%20Frontline/live2dnew)). The internal game IDs (`m1903_5`, `m1903_1107`) map to Classic Witch and Stirring Mermaid, confirmed by visual inspection.
- The `live2dold` subfolder of the same Eikanya repo also has C2 (`.moc`/`.mtn`) versions of the same two costumes, equivalent to what we have under `models/`.

### Spine chibis
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

### Springfield costume summary

> The GFL1 anniversary costume is "Queen under the Lantern" (灯下女王). "Queen in Radiance" is a separate GFL2:Exilium costume, unrelated to GFL1 assets.

| Costume | EN Name (GFL1) | Internal ID | C2 (moc) | C3 (moc3) | Chibi (skel) | L2D? |
|---------|---------------|-------------|----------|----------|--------------|------|
| costume1 | Classic Witch | `m1903_5` | ✅ | ✅ | ✅ | YES |
| costume2 | O Holy Night | `m1903_302` | ❌ | ❌ | ✅ | NO (confirmed IOP wiki) |
| costume3 | Queen under the Lantern | `m1903_802` | ❌ | ❌ | ✅ | NO (confirmed namu.wiki) |
| costume4 | Stirring Mermaid | `m1903_1107` | ✅ | ✅ | ✅ | YES |

Only 2 of Springfield's 4 costumes have Live2D in GFL1. This viewer includes both.

## Model discovery research

### Search guidelines for agents
When doing exhaustive asset searches for other games (e.g. GFL2, Nikke, Azur Lane), follow these steps:
1. Run multilingual web searches across EN, JP, CN, and KR using native characters (e.g. 少女前线, 소녀전선, ドルフロ) and terms like `live2d`, `spine`, `moc3`, `skel`, `extract`, `asset dump` to find community repos and CDN mirrors.
2. Check GitHub for dedicated community datamine/extraction repos (sort by recently updated).
3. Check specialized wikis, fan sites, and community boards (e.g. namu.wiki, moegirl).
4. Cross-reference found assets against official costume lists to confirm whether an asset actually has Live2D/Spine or is just a static image.

Exhaustive search conducted for GFL1 Springfield (2026-07-17) across game asset repos, community mirrors, CN/JP/KR sources, and IOP wiki data.

### Repositories checked (GitHub)
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

### Confirmation sources
- O Holy Night has no L2D: IOP wiki T-Doll Costume Index marks it as non-Live2D ([source](https://iopwiki.com/wiki/T-Doll_Costume_Index))
- Queen under the Lantern has no L2D: confirmed by namu.wiki costume listing
- IOP wiki's Live2D page for Springfield stopped being updated with newer costumes due to incompatible file formats. It only hosts older C2 assets.
- All 8+ repos checked exhaustively, including C2 (moc/mtn) and C3 (moc3) paths. Zero additional Springfield costumes found.

### Conclusion
The search is complete. Only Classic Witch and Stirring Mermaid have Live2D in GFL1. O Holy Night and Queen under the Lantern are static costumes. No public dump, CDN, or game data repo contains additional Springfield L2D models beyond what we already have.

## Architecture

### Integration hooks (`window.__viewerCallbacks`)

The core controllers (`chibi.js`, `app.js`, `playground.js`) and the network cache (`cache.js`) never touch the DOM. They emit state objects to optional hooks on `window.__viewerCallbacks`. Utilities like `resize.js` and `pan-zoom.js` do interact with the DOM but stay decoupled by taking generic arguments and exposing an API rather than hardcoding element references. All project-specific UI logic lives in `main.js`.

| Hook | Called when |
|------|-------------|
| `onStateChange(state)` | Loading progress, model ready state, errors, playground states |
| `onDormChange(active)` | Dorm mode toggled or restored on mode switch |

Set these before mode switching. Both are null-checked. If unset, state updates are silently skipped.

```js
window.__viewerCallbacks = {
  onStateChange: function(state) {
    // state is a structured object, e.g. { type: 'ready', mode: 'live2d', modelName: 'M1903' }
    // main.js builds dynamic UI text from this and toggles the gfl-spinner.svg visibility.
  },
  onDormChange:  function(active) { /* toggle button class, etc. */ }
};
```

### Config (`js/config.js`)
`window.VIEWER_CONFIG` controls viewer behavior:
- `relativeDraw` (bool): if `false`, skip all repositioning (centering + scaling) on resize. If `true` (or unset), re-center and re-scale the model on canvas resize.
- `keepOriginalDimensions` (bool): when scaling with canvas, never exceed original pixel size.
- `live2dBaseY` (number): base vertical anchor multiplier for Live2D (default `0.5`, center).
- `chibiBaseY` (number): base vertical anchor multiplier for Spine chibis (default `0.8`, near bottom).
- `layout`: per-model overrides keyed by entry `id`:
  - `offsetY` (number): vertical shift multiplier relative to screen height (e.g. `-0.25` is 25% up)
  - `scale` (number): scale multiplier
- `spineAnim`: animation config for Spine chibis with a `global` fallback or per-model keys. Supports `loop: false`, `followUp: 'anim_name'`, and `hidden: true` (hides from manual clicks).
- Default: `{ relativeDraw: true, keepOriginalDimensions: false }`.

### Model asset cache (`js/cache.js`)
In-memory cache map (URL → response data) that prevents re-downloading files when switching between previously loaded models. Two loading paths are intercepted:

- Live2D files: wraps `PIXI.live2d.XHRLoader.loader` middleware (all .moc, .moc3, textures, motions, physics, etc.). Also updates `Live2DLoader.middlewares[0]` which held a stale reference to the original loader.
- Spine files (`skeleton.skel`, `atlas.txt`): wraps `window.fetch`. `spritemap.png` loads via `new Image()` (browser HTTP cache handles it, no patch needed).

To add a new fetch-loaded file type, extend the regex: `/(skel|atlas\.txt|new_ext)$/i`. For a new loading API, follow the same pattern: save original → wrap → check `cache[url]` → return cached or call original + store (check for stale references too). Debug via `window.__MODEL_CACHE`.

### Shared PIXI application (`js/main.js`)
- A single persistent `PIXI.Application` created on page load, stored in `window.__sharedApp`.
- Both modes share this app's stage/renderer. No WebGL context destruction between mode switches.
- Canvas resize uses `ResizeObserver` on `#canvas-wrap` + `requestAnimationFrame` (not PIXI's `resizeTo`). PIXI's built-in `resizeTo` causes a blank-frame flicker because `renderer.resize()` reallocates the WebGL framebuffer (clearing it) and the next render waits for the following tick. The manual approach calls `renderer.resize()` then `ticker.update()` synchronously, so model reposition + render happen in the same frame with no blank flicker.
- Mode switching toggles between Live2D and Chibi. `destroyCurrent()` clears stage children before initializing the next mode. Pill/dropdown clicks reset the stage transform.
- Reset button resets stage position/scale and re-runs `repositionLive2D`/`repositionChibi`.
- Theme toggle uses the View-Transition API for a radial clip animation. Persisted in localStorage.

### Live2D mode (Cubism 2 + Cubism 3)
1. `live2d.min.js`, Cubism 2.1 WebGL SDK (.moc parse, for C2 models)
2. `live2dcubismcore.min.js`, Cubism 4 WebGL SDK (.moc3 parse + physics, for C3 models)
3. `pixi.min.js` v6.5.10, WebGL framework
4. `pixi-live2d-display.min.js` (guansss), unified Live2D display plugin for PixiJS v6
   - Auto-detects model version (`.model.json` = C2, `.model3.json` = C3/C4)
   - API: `PIXI.live2d.Live2DModel.from(url, { autoHitTest: false, autoFocus: false })`
   - `model.focus(x, y)` for mouse tracking
   - `model.on('hit', areas => ...)` for hit area testing
   - `model.motion(group)` for playing random motion from group
   - Handles its own WebGL state, no VAO or shader reset needed when switching models
5. `app.js`, loads, positions, and repositions Live2D models
   - `repositionLive2D()` early-returns if `cfg.relativeDraw === false`. Otherwise re-centers (with `layout.offsetY`) and re-scales (respecting `keepOriginalDimensions` and `_cfgScale`).
   - `Live2DModel.from()` called with `autoHitTest: false, autoFocus: false` for manual mouse tracking via `model.focus()` and hit events.
   - `model._cfgScale` and `model._entryId` stored on the model for repositioning.
   - `model.internalModel.localTransform` reset for C2 models to bypass `pixi-live2d-display`'s layout bug (incorrect shift with `center_x:0`).
   - `loadModel()` is `await`-ed in `initLive2DMode()` so errors propagate to `switchMode()` try/catch.

### Chibi mode (Spine)
1. `pixi-spine.js` (custom from gfSpinePiXi), Spine 2.x runtime with PIXI.spine.SpineRuntime namespace
   - PixiJS v6 compat stubs added via `<script>` in index.html:
     - `PIXI.loaders.Loader.addPixiMiddleware` → no-op
     - `PIXI.loader.use` → no-op
     - `PIXI.mesh.Mesh` → mapped to `PIXI.SimpleMesh` (prevents `Cannot set properties of undefined (setting '_parentID')` crashes when PIXI's rendering loop traverses a destroyed Spine object during mode switch cleanup).
2. `spine2-skeleton-binary.js`, parses Spine 2.1.27 binary .skel → JSON
3. `chibi.js`, pipeline: SkeletonBinary → PIXI.spine.SpineRuntime.Atlas → AtlasAttachmentParser → SkeletonJsonParser → PIXI.spine.Spine, rendered on shared app stage
   - `repositionChibi()` early-returns if `cfg.relativeDraw === false`. Otherwise centers at `(screen.width/2, screen.height * 0.80)`.
   - Per-model `layout.scale` and `layout.offsetY` applied from `entryCfg`.
   - Starts on `wait` animation (looping). Click cycles through all animations in order (each loops).

### Dorm variant (Spine)
A Dorm toggle in the mode tab row swaps in `skeleton_dorm.skel` and, when present, `atlas_dorm.txt` + `spritemap_dorm.png`. Atlas and spritemap pair as a unit. If no dorm atlas exists, both base files are reused (texture shared, only skeleton changes). Dorm state persists across chibi switches and mode switches but resets on page reload.

### Pan & zoom canvas (`js/pan-zoom.js`)
Stage-level transform with pointer drag + wheel zoom, applied directly to `app.stage`.
- Zoom clamped 0.2x–5.0x, cursor-relative.
- Stage position clamped to `maxBound * 2 * scale`.
- Decoupled API (`enable`, `disable`, `suspend`, `resume`), UI wiring left to `main.js`.

### Multi-model playground (`js/playground.js`)
An experimental mode that puts multiple Spine instances on a shared PIXI stage. This serves as a reference for how to build new features on top of the existing modules (`chibi.js`, `pan-zoom.js`, etc.) without modifying them.
- Serializes model state (positions, animations, dorm variant, duplicate origins) to `localStorage` on interaction and reconstructs the scene graph on reload.
- Uses rejection sampling for initial placement with a 20% bounding margin via `app.screen` to prevent edge-clipping.
- Drag events (`pointermove`, `pointerup`) are bound to `app.stage` rather than individual Spine objects, so drag keeps working during fast mouse movements.
- `app.stage` manages the background cursor (`move` during pan) while interactive children define their own hover state (`pointer`).
- Uses `spine.getLocalBounds()` to position generated sprites relative to each skeleton's actual dimensions.
- Touch and desktop parity: right-click duplicates, double-right-click deletes. On touch, double-tap duplicates and triple-tap deletes.

### Animation exporter (`js/exporter.js`)
A browser-side frame-by-frame animation encoder supporting APNG, Animated WebP, GIF, and PNG.
- APNG (default) via `UPNG.js` (full alpha). Animated WebP via native browser VP8L encoding and a custom RIFF muxer (`webp-muxer.js`, full alpha). GIF via `gif.js` (chroma-key fallback). Single-frame PNG snapshots. Dependencies are lazy-loaded on first use.
- Auto-detects loop duration by scanning Spine skeletons and Live2D `motionGroups` (Cubism 2, 3, & 4) for the precise floating-point animation length, so exported loops are seamless without manual duration input.
- Reads `VIEWER_CONFIG.layout` offsets (`offsetX`/`offsetY`). If a model is shifted in the viewport to compensate for odd logical PSD bounds, the exporter translates those offsets to correctly frame the output. Includes a `scale` option for supersampled rendering.
- Suspends the main `PIXI.Ticker` while capturing frames via `app.renderer.render()`, disables Live2D mouse-tracking so the character faces forward, and restores both the tracker and the previously playing Spine animations when done.

## Playwright tests

Test scripts live in `playwright/` and need Playwright installed:

```bash
cd playwright
npm install
node run-verify-final.mjs    # Self-contained server, tests all models (C2, C3, Spine)
```

Debug scripts for troubleshooting:
- `debug-bounds.mjs` (model dimensions, original size, drawable bounds)
- `debug-c2-deep.mjs` (C2 model internals, 404s, console log capture)
- `debug-switchback.mjs` (L2D→chibi→L2D cycle with full console output)

> Use headed mode (`headless: false`) for debugging. Headless Playwright lacks WebGL support needed by the C2 SDK.

## Known issues & workarounds
- Stirring Mermaid C2 has only `daiji_idle_01.mtn`, no tap_body motions. `app.js` calls `model.motion()` which plays a random motion from the group. If the group is empty, nothing happens.
- `pixi-live2d-display` v0.5.0-beta (guansss) may have edge cases with C3 model groups vs hit areas, and has a layout bug with C2 models that define absolute position (fixed in app.js by resetting `localTransform`).
- Chibi mode stubs `PIXI.mesh.Mesh` to `PIXI.SimpleMesh` to prevent `_parentID` crashes during cleanup.
- PixiJS v6 compat stubs in index.html: `cullus/gfSpinePiXi`'s pixi-spine reads Spine 2.x binary (.skel) on PixiJS v4. Official pixi-spine v6 only reads Spine 3.x+ JSON. Converting all .skel assets is impractical.
- `relativeDraw: true` (default) enables dynamic centering + re-scaling on canvas resize. Set to `false` to keep the model at its initial position/scale.
- Canvas resize blank-frame flicker: PIXI's `resizeTo` calls `renderer.resize()` which clears the WebGL framebuffer, then renders next tick, showing one frame of flash. Fixed by replacing `resizeTo` with a `ResizeObserver` that calls `renderer.resize()` + `ticker.update()` synchronously.

## License

Third-party Live2D SDKs are subject to the [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html). Model assets are subject to their respective game/publisher terms.
