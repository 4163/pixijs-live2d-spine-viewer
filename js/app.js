/* ============================================================
   app.js — Live2D (Cubism 2 + 3) Viewer
   Uses pixi-live2d-display (guansss) for both C2 and C3.
   
   Terminology:
     "L2D element" — the Live2D model (PIXI display object) drawn on canvas.
   ============================================================ */

(function () {
  'use strict';

  let currentModel = null;
  let _onMove = null;

  // Exported: called on canvas resize to re-center and/or re-scale the model
  function repositionLive2D() {
    if (!currentModel) return;
    const app = window.__sharedApp;
    if (!app) return;
    const cfg = window.VIEWER_CONFIG || {};
    if (cfg.relativeDraw === false) return;

    const entryCfg = (cfg.layout && cfg.layout[currentModel._entryId]) || {};
    const baseY = cfg.live2dBaseY !== undefined ? cfg.live2dBaseY : 0.5;
    const offsetY = (entryCfg.offsetY || 0) * app.screen.height;
    currentModel.x = app.screen.width / 2;
    currentModel.y = app.screen.height * baseY + offsetY;

    const w = currentModel.internalModel.originalWidth;
    const h = currentModel.internalModel.originalHeight;
    const cfgScale = currentModel._cfgScale || 1.0;
    const fitRatio = cfg.screenFitRatio !== undefined ? cfg.screenFitRatio : 0.9;
    const scaleBase = Math.min(app.screen.width / w, app.screen.height / h) * fitRatio;
    const scale = Math.min(scaleBase, 1.0) * cfgScale;
    currentModel.scale.set(scale);
  }
  window.repositionLive2D = repositionLive2D;

  function destroyLive2D() {
    const app = window.__sharedApp;
    if (_onMove && app) app.stage.off('pointermove', _onMove);
    _onMove = null;
    if (currentModel) { currentModel.destroy(); currentModel = null; }
  }
  window.destroyLive2D = destroyLive2D;

  // Load a single model from a manifest entry {id, name, type, json}
  async function loadLive2DModel(app, entry) {
    if (currentModel) {
      app.stage.removeChild(currentModel);
      if (_onMove) app.stage.off('pointermove', _onMove);
      _onMove = null;
      currentModel.destroy();
      currentModel = null;
    }

    window.__loadToken = (window.__loadToken || 0) + 1;
    const myToken = window.__loadToken;

    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
      window.__viewerCallbacks.onStateChange({ type: 'loading', modelName: entry.name });

    let model;
    try {
      model = await PIXI.live2d.Live2DModel.from(entry.json, { autoHitTest: false, autoFocus: false });
    } catch (e) {
      console.warn(`${entry.name}: Live2D model load failed —`, e.message || e);
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
        window.__viewerCallbacks.onStateChange({ type: 'error', modelName: entry.name });
      return;
    }
    
    // Abort if another load started (even from another module) while we were waiting
    if (window.__loadToken !== myToken) {
      model.destroy();
      return;
    }

    app.stage.addChild(model);
    currentModel = model;

    // Cubism 2 layout bug fix: pixi-live2d-display sometimes applies an
    // incorrect localTransform on C2 models (absolute position from model.json).
    if (model.internalModel && model.internalModel.localTransform) {
      model.internalModel.localTransform.identity();
    }

    // Auto-fit to canvas (90% of canvas size)
    const w = model.internalModel.originalWidth;
    const h = model.internalModel.originalHeight;
    const vc = window.VIEWER_CONFIG || {};
    const entryCfg = (vc.layout && vc.layout[entry.id]) || {};
    model._cfgScale = entryCfg.scale || 1.0;
    model._entryId = entry.id;

    const fitRatio = vc.screenFitRatio !== undefined ? vc.screenFitRatio : 0.9;
    const scaleBase = Math.min(app.screen.width / w, app.screen.height / h) * fitRatio;
    const scale = Math.min(scaleBase, 1.0) * model._cfgScale;
    const baseY = vc.live2dBaseY !== undefined ? vc.live2dBaseY : 0.5;
    const offsetY = (entryCfg.offsetY || 0) * app.screen.height;

    model.anchor.set(0.5, 0.5);
    model.scale.set(scale);
    model.x = app.screen.width / 2;
    model.y = app.screen.height * baseY + offsetY;

    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
      window.__viewerCallbacks.onStateChange({ type: 'ready', mode: 'live2d', modelName: entry.name });

    _onMove = e => model.focus(e.data.global.x, e.data.global.y);
    app.stage.on('pointermove', _onMove);

    model.on('hit', hitAreas => {
      try {
        if (hitAreas.includes('head'))      model.motion('tap_head');
        else if (hitAreas.includes('body')) model.motion('tap_body');
        else if (hitAreas.includes('arm'))  model.motion('tap_arm');
        else                                model.motion('idle');
      } catch (e) {
        console.warn(`${entry.name}: motion error —`, e.message || e);
      }
    });
  }
  window.loadLive2DModel = loadLive2DModel;

  // Called by main.js with the pre-fetched model list
  async function initLive2DMode(app, models) {
    while (app.stage.children.length > 0) app.stage.removeChildAt(0);
    currentModel = null;
    _onMove = null;

    if (!models || models.length === 0) {
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) 
        window.__viewerCallbacks.onStateChange({ type: 'error', message: 'No Live2D models found.' });
      return;
    }
    await loadLive2DModel(app, models[0]);
  }
  window.initLive2DMode = initLive2DMode;

})();
