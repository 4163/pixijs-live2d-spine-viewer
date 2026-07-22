/* ============================================================
   chibi.js ΓÇö Spine 2.x Skeletal Animation Viewer
   ============================================================
   Pipeline:
     1. Fetch atlas.txt (text), skeleton.skel (binary), spritemap.png
     2. spine2-skeleton-binary.js (SkeletonBinary) converts .skel ΓåÆ JSON
        Γå│ pixi-spine v3 binary parser rejects Spine 2.1.27; shim is required
     3. pixi-spine.js SpineRuntime.Atlas parses the atlas text
     4. pixi-spine.js SpineRuntime.SkeletonJsonParser reads the JSON
     5. new PIXI.spine.Spine(skeletonData) renders on stage
   ============================================================ */

(function () {
  'use strict';

  let currentSpine = null;
  let currentModelEntry = null;
  let dormMode = false;

  function stripDel(obj) {
    if (typeof obj === 'string') return obj.replace(/\u007f/g, '');
    if (Array.isArray(obj)) return obj.map(stripDel);
    if (obj && typeof obj === 'object') {
      const r = {};
      for (const k in obj) r[stripDel(k)] = stripDel(obj[k]);
      return r;
    }
    return obj;
  }

  // Exported: called on canvas resize to re-center the chibi
  function repositionChibi() {
    if (!currentSpine) return;
    const app = window.__sharedApp;
    if (!app) return;
    const cfg = window.VIEWER_CONFIG || {};
    if (cfg.relativeDraw === false) return;
    const baseY = cfg.chibiBaseY !== undefined ? cfg.chibiBaseY : 0.80;
    
    // Position
    currentSpine.position.set(app.screen.width / 2, app.screen.height * baseY);
    
    // Scale dynamically: only shrink if it exceeds fitRatio of the canvas
    const cfgScale = currentSpine._cfgScale || 1.0;
    const w = currentSpine._origWidth || 1000;
    const h = currentSpine._origHeight || 1000;
    const fitRatio = cfg.screenFitRatio !== undefined ? cfg.screenFitRatio : 0.9;
    const scaleBase = Math.min(app.screen.width / w, app.screen.height / h) * fitRatio;
    const scale = Math.min(scaleBase, 1.0) * cfgScale;
    currentSpine.scale.set(scale);
  }
  window.repositionChibi = repositionChibi;

  async function fetchWithFallback(url, fallbackUrl, responseType, label) {
    try {
      const r = await fetch(url);
      if (r.ok) return responseType === 'text' ? r.text() : r.arrayBuffer();
      if (!r.ok && r.status === 404) console.warn(`${label || url} not found, using fallback`);
    } catch (_) {}
    const r = await fetch(fallbackUrl);
    return responseType === 'text' ? r.text() : r.arrayBuffer();
  }

  function loadImageWithFallback(url, fallbackUrl) {
    return new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => {
        const i2 = new Image();
        i2.onload = () => resolve(i2);
        i2.onerror = reject;
        i2.src = fallbackUrl;
      };
      i.src = url;
    });
  }

  async function loadChibiModel(app, entry, useDorm) {
    // Graceful cleanup of previous model
    if (currentSpine) {
      currentSpine.autoUpdate = false;
      if (currentSpine.state) currentSpine.state.clearTracks();
      if (currentSpine.parent) currentSpine.parent.removeChild(currentSpine);
      currentSpine.removeAllListeners();
      const toDestroy = currentSpine;
      // Defer destroy one frame so the renderer finishes its current pass
      requestAnimationFrame(() => {
        try { toDestroy.destroy({ children: true, texture: false }); } catch (_) {}
      });
      currentSpine = null;
    }

    window.__loadToken = (window.__loadToken || 0) + 1;
    const myToken = window.__loadToken;

    const dir = entry.dir;
    dormMode = useDorm !== undefined ? !!useDorm : dormMode;
    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
      window.__viewerCallbacks.onStateChange({ type: 'loading', modelName: entry.name, isDorm: dormMode });

    let atlasText, skelBuffer, img;

    try {
      if (dormMode) {
        skelBuffer = await fetchWithFallback(`${dir}/skeleton_dorm.skel`, `${dir}/skeleton.skel`, 'buffer', 'Dorm skel');
        if (entry.dormAtlas) {
          let dormAtlas = null;
          try {
            const r = await fetch(`${dir}/atlas_dorm.txt`);
            if (r.ok) dormAtlas = await r.text();
          } catch (_) {}
          if (dormAtlas) {
            atlasText = dormAtlas;
            img = await loadImageWithFallback(`${dir}/spritemap_dorm.png`, `${dir}/spritemap.png`);
          } else {
            const [t, i] = await Promise.all([
              fetch(`${dir}/atlas.txt`).then(r => { if (!r.ok) throw new Error('base atlas not found'); return r.text(); }),
              new Promise((resolve, reject) => {
                const i2 = new Image();
                i2.onload = () => resolve(i2);
                i2.onerror = reject;
                i2.src = `${dir}/spritemap.png`;
              })
            ]);
            atlasText = t;
            img = i;
          }
        } else {
          const [t, i] = await Promise.all([
            fetch(`${dir}/atlas.txt`).then(r => { if (!r.ok) throw new Error('base atlas not found'); return r.text(); }),
            new Promise((resolve, reject) => {
              const i2 = new Image();
              i2.onload = () => resolve(i2);
              i2.onerror = reject;
              i2.src = `${dir}/spritemap.png`;
            })
          ]);
          atlasText = t;
          img = i;
        }
      } else {
        [atlasText, skelBuffer, img] = await Promise.all([
          fetch(`${dir}/atlas.txt`).then(r => { if (!r.ok) throw new Error('atlas not found'); return r.text(); }),
          fetch(`${dir}/skeleton.skel`).then(r => { if (!r.ok) throw new Error('skel not found'); return r.arrayBuffer(); }),
          new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = `${dir}/spritemap.png`;
          })
        ]);
      }
    } catch (e) {
      console.warn(`${entry.name}: failed to load model files ΓÇö`, e.message || e);
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
        window.__viewerCallbacks.onStateChange({ type: 'error', modelName: entry.name });
      return;
    }
    
    // Abort if another load started (even from another module) while we were waiting
    if (window.__loadToken !== myToken) return;

    let skeletonJson, atlas, skeletonData, spine;
    try {
      // Step 1: Spine 2.1.27 binary ΓåÆ JSON via custom shim
      const skelBin = new SkeletonBinary();
      skelBin.data = new Uint8Array(skelBuffer);
      skelBin.initJson();
      skeletonJson = stripDel(skelBin.json);

      // Step 2: Build atlas (single spritemap page) ΓÇö strip DEL chars from region names
      const baseTex = new PIXI.BaseTexture(img);
      atlas = await new Promise(resolve => {
        new PIXI.spine.SpineRuntime.Atlas(atlasText.replace(/^\u007f/gm, ''), (_line, cb) => cb(baseTex), resolve);
      });

      // Step 3: Ensure all events referenced in animations exist
      if (skeletonJson.events && skeletonJson.animations) {
        for (const animName in skeletonJson.animations) {
          const evts = skeletonJson.animations[animName].events;
          if (evts) {
            for (const evt of evts) {
              if (evt.name && !skeletonJson.events[evt.name])
                skeletonJson.events[evt.name] = {};
            }
          }
        }
      }

      // Step 4: Parse skeleton JSON
      const atlasParser  = new PIXI.spine.SpineRuntime.AtlasAttachmentParser(atlas);
      const jsonParser   = new PIXI.spine.SpineRuntime.SkeletonJsonParser(atlasParser);
      skeletonData = jsonParser.readSkeletonData(skeletonJson, dir.split('/').pop());
    } catch (e) {
      console.warn(`${entry.name}: parse/atlas error ΓÇö`, e.message || e);
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) window.__viewerCallbacks.onStateChange({ type: 'error', modelName: entry.name });
      return;
    }

    // Step 5: Create Spine display object
    const vc = window.VIEWER_CONFIG || {};
    const entryCfg = (vc.layout && vc.layout[entry.id]) || {};
    const cfgScale = entryCfg.scale || 1.0;
    const offsetY = (entryCfg.offsetY || 0) * app.screen.height;

    const baseY = vc.chibiBaseY !== undefined ? vc.chibiBaseY : 0.80;
    
    try {
      spine = new PIXI.spine.Spine(skeletonData);
      
      spine._cfgScale = cfgScale;
      spine._entryId = entry.id;
      
      spine._origWidth = skeletonData.width || spine.width || 1000;
      spine._origHeight = skeletonData.height || spine.height || 1000;

      const fitRatio = vc.screenFitRatio !== undefined ? vc.screenFitRatio : 0.9;
      const scaleBase = Math.min(app.screen.width / spine._origWidth, app.screen.height / spine._origHeight) * fitRatio;
      const initialScale = Math.min(scaleBase, 1.0) * cfgScale;

      spine.scale.set(initialScale);
      spine.position.set(app.screen.width / 2, app.screen.height * baseY + offsetY);
      spine.eventMode = 'static';
      spine.interactive = true;
      app.stage.addChild(spine);
    } catch (e) {
      console.warn(`${entry.name}: spine creation error —`, e.message || e);
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) window.__viewerCallbacks.onStateChange({ type: 'error', modelName: entry.name });
      return;
    }
    currentSpine = spine;
    currentModelEntry = entry;

    // Play default animation
    const anims = skeletonData.animations;
    const hasVictoryLoop = anims.some(a => a.name === 'victoryloop');
    const defaultAnim = anims.find(a => a.name === 'wait') || anims[0];
    let animIndex = anims.indexOf(defaultAnim);

    function getAnimCfg(name) {
      const globalCfg = (vc.spineAnim && vc.spineAnim['global']) || {};
      const perModel  = (vc.spineAnim && vc.spineAnim[entry.id]) || {};
      return perModel[name] || globalCfg[name] || null;
    }
    function getLoop(name) {
      const cfg = getAnimCfg(name);
      if (cfg && cfg.loop !== undefined) return cfg.loop;
      // Wiki-style defaults: die=false, victory=false (when victoryloop exists), else true
      return name !== 'die' && (name !== 'victory' || !hasVictoryLoop);
    }
    function playAnim(name) {
      const loop = getLoop(name);
      const cfg  = getAnimCfg(name);

      // Clear tracks to ensure clean start, especially for queued animations
      spine.state.clearTracks();
      spine.skeleton.setToSetupPose();

      if (loop && cfg && cfg.followUp) {
        // Sequence loop: A (once) ΓåÆ B (once) ΓåÆ A (once) ΓåÆ B (once) ...
        spine.state.setAnimationByName(0, name, false);
        spine.state.addAnimationByName(0, cfg.followUp, false, 0);
        let lastQueued = cfg.followUp;
        spine.state.onComplete = function (trackIndex) {
          if (trackIndex !== 0) return;
          if (lastQueued === cfg.followUp) {
            spine.state.addAnimationByName(0, name, false, 0);
            lastQueued = name;
          } else {
            spine.state.addAnimationByName(0, cfg.followUp, false, 0);
            lastQueued = cfg.followUp;
          }
        };
      } else {
        // Normal playback (single anim looping, or play-once then chain)
        spine.state.onComplete = null;
        spine.state.setAnimationByName(0, name, loop);
        if (spine.state.tracks[0]) spine.state.tracks[0].listener = null;
        if (!loop && cfg && cfg.followUp) {
          spine.state.addAnimationByName(0, cfg.followUp, true, 0);
        } else if (name === 'victory' && !loop && hasVictoryLoop) {
          spine.state.addAnimationByName(0, 'victoryloop', true, 0);
        }
      }
    }
    if (defaultAnim) playAnim(defaultAnim.name);

    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
      window.__viewerCallbacks.onStateChange({ type: 'ready', mode: 'spine', modelName: entry.name, defaultAnim: defaultAnim ? defaultAnim.name : 'none' });

    spine.on('pointerdown', () => {
      if (anims.length < 2) return;
      let nextAnim = null;
      const startIdx = animIndex;
      do {
        animIndex = (animIndex + 1) % anims.length;
        const cfg = getAnimCfg(anims[animIndex].name);
        if (!cfg || !cfg.hidden) { nextAnim = anims[animIndex]; break; }
      } while (animIndex !== startIdx);
      if (nextAnim) {
        playAnim(nextAnim.name);
        if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
          window.__viewerCallbacks.onStateChange({ type: 'anim-cycle', modelName: entry.name, animName: nextAnim.name });
      }
    });
  }
  window.loadChibiModel = loadChibiModel;

  async function toggleDormMode() {
    if (!currentModelEntry) return;
    dormMode = !dormMode;
    if (window.__viewerCallbacks && window.__viewerCallbacks.onDormChange) window.__viewerCallbacks.onDormChange(dormMode);
    await loadChibiModel(window.__sharedApp, currentModelEntry, dormMode);
  }
  window.toggleDormMode = toggleDormMode;

  function getDormMode() { return dormMode; }
  window.getDormMode = getDormMode;

  async function initChibiMode(app, models) {
    while (app.stage.children.length > 0) app.stage.removeChildAt(0);
    currentSpine = null;
    currentModelEntry = null;
    if (window.__viewerCallbacks && window.__viewerCallbacks.onDormChange) window.__viewerCallbacks.onDormChange(dormMode);

    if (!models || models.length === 0) {
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
        window.__viewerCallbacks.onStateChange({ type: 'error', message: 'No Spine models found.' });
      return;
    }
    await loadChibiModel(app, models[0]);
  }
  window.initChibiMode = initChibiMode;

  function destroyChibi() {
    if (!currentSpine) return;
    currentSpine.autoUpdate = false;
    if (currentSpine.state) currentSpine.state.clearTracks();
    if (currentSpine.parent) currentSpine.parent.removeChild(currentSpine);
    currentSpine.removeAllListeners();
    const toDestroy = currentSpine;
    requestAnimationFrame(() => {
      try { toDestroy.destroy({ children: true, texture: false }); } catch (_) {}
    });
    currentSpine = null;
    currentModelEntry = null;
    dormMode = false;
    if (window.__viewerCallbacks && window.__viewerCallbacks.onDormChange) window.__viewerCallbacks.onDormChange(false);
  }
  window.destroyChibi = destroyChibi;

})();
