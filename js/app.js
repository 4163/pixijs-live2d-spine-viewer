// app.js: Live2D (Cubism 2 + 3) viewer, via pixi-live2d-display (guansss).
// "L2D element": the Live2D model (PIXI display object) drawn on canvas.

(function () {
  'use strict';

  let currentModel = null;
  let _onMove = null;
  let _onLeave = null;

  function resetLive2DFocus() {
    if (currentModel && currentModel.internalModel && currentModel.internalModel.focusController) {
      currentModel.internalModel.focusController.focus(0, 0);
    }
  }

  // Remap non-standard model parameter IDs to activate mouse tracking and procedural animation
  function normalizeLive2DParameters(model) {
    if (!model || !model.internalModel) return;
    const im = model.internalModel;
    const core = im.coreModel;
    if (!core) return;

    // Cubism 2: map non-standard or PascalCase parameter names to real MOC indices
    if (core._$5S && Array.isArray(core._$5S._$pb)) {
      const s5 = core._$5S;
      const realParams = new Map();
      for (let i = 0; i < s5._$pb.length; i++) {
        const item = s5._$pb[i];
        if (item && item.id && s5.getParamMin(i) > -999999) {
          realParams.set(item.id, i);
        }
      }

      const resolveC2 = (candidates) => {
        for (const name of candidates) {
          if (realParams.has(name)) return realParams.get(name);
        }
        return -1;
      };

      const ax = resolveC2(['PARAM_ANGLE_X', 'ParamAngleX', 'PARAM_X']);
      if (ax >= 0) im.angleXParamIndex = ax;

      const ay = resolveC2(['PARAM_ANGLE_Y', 'ParamAngleY', 'PARAM_Y']);
      if (ay >= 0) im.angleYParamIndex = ay;

      const az = resolveC2(['PARAM_ANGLE_Z', 'ParamAngleZ', 'PARAM_ALE_Z', 'PARAM_Z']);
      if (az >= 0) im.angleZParamIndex = az;

      const ex = resolveC2(['PARAM_EYE_BALL_X', 'ParamEyeBallX', 'PARAM_EYE_X']);
      if (ex >= 0) im.eyeballXParamIndex = ex;

      const ey = resolveC2(['PARAM_EYE_BALL_Y', 'ParamEyeBallY', 'PARAM_EYE_Y']);
      if (ey >= 0) im.eyeballYParamIndex = ey;

      const bx = resolveC2(['PARAM_BODY_ANGLE_X', 'ParamBodyAngleX', 'PARAM_BOGLE_X']);
      if (bx >= 0) im.bodyAngleXParamIndex = bx;

      const br = resolveC2(['PARAM_BREATH', 'ParamBreath']);
      if (br >= 0) im.breathParamIndex = br;

      if (im.eyeBlink) {
        const el = resolveC2(['PARAM_EYE_L_OPEN', 'ParamEyeLOpen', 'PARAM_EYE_OPEN']);
        if (el >= 0) im.eyeBlink.leftParam = el;
        const er = resolveC2(['PARAM_EYE_R_OPEN', 'ParamEyeROpen']);
        if (er >= 0) im.eyeBlink.rightParam = er;
      }
    }

    // Cubism 3 / 4: map non-standard parameter IDs for focus tracking
    if (Array.isArray(core._parameterIds)) {
      const paramIds = core._parameterIds;
      const resolveC3 = (currentId, candidates) => {
        if (paramIds.includes(currentId)) return currentId;
        for (const name of candidates) {
          if (paramIds.includes(name)) return name;
        }
        return currentId;
      };

      im.idParamAngleX = resolveC3(im.idParamAngleX, ['ParamAngleX', 'PARAM_ANGLE_X', 'PARAM_X']);
      im.idParamAngleY = resolveC3(im.idParamAngleY, ['ParamAngleY', 'PARAM_ANGLE_Y', 'PARAM_Y']);
      im.idParamAngleZ = resolveC3(im.idParamAngleZ, ['ParamAngleZ', 'PARAM_ANGLE_Z', 'PARAM_ALE_Z', 'PARAM_Z']);
      im.idParamEyeBallX = resolveC3(im.idParamEyeBallX, ['ParamEyeBallX', 'PARAM_EYE_BALL_X', 'PARAM_EYE_X']);
      im.idParamEyeBallY = resolveC3(im.idParamEyeBallY, ['ParamEyeBallY', 'PARAM_EYE_BALL_Y', 'PARAM_EYE_Y']);
      im.idParamBodyAngleX = resolveC3(im.idParamBodyAngleX, ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X', 'PARAM_BOGLE_X']);
    }
  }

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
    resetLive2DFocus();
  }
  window.repositionLive2D = repositionLive2D;

  function destroyLive2D() {
    const app = window.__sharedApp;
    if (_onMove && app) app.stage.off('pointermove', _onMove);
    _onMove = null;
    if (_onLeave) {
      window.removeEventListener('pointerout', _onLeave);
      window.removeEventListener('blur', _onLeave);
      _onLeave = null;
    }
    if (currentModel) { currentModel.destroy(); currentModel = null; }
  }
  window.destroyLive2D = destroyLive2D;

  // Load a single model from a manifest entry {id, name, type, json}
  async function loadLive2DModel(app, entry) {
    if (currentModel) {
      app.stage.removeChild(currentModel);
      if (_onMove) app.stage.off('pointermove', _onMove);
      _onMove = null;
      if (_onLeave) {
        window.removeEventListener('pointerout', _onLeave);
        window.removeEventListener('blur', _onLeave);
        _onLeave = null;
      }
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
      console.warn(`${entry.name}: Live2D model load failed`, e.message || e);
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

    normalizeLive2DParameters(model);

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

    _onLeave = e => {
      if (!e || !e.relatedTarget) {
        resetLive2DFocus();
      }
    };
    window.addEventListener('pointerout', _onLeave);
    window.addEventListener('blur', _onLeave);

    model.on('hit', hitAreas => {
      try {
        if (hitAreas.includes('head'))      model.motion('tap_head');
        else if (hitAreas.includes('body')) model.motion('tap_body');
        else if (hitAreas.includes('arm'))  model.motion('tap_arm');
        else if (hitAreas.includes('leg'))  model.motion('tap_leg');
        else {
          if (!model.motion('idle')) model.motion('Idle');
        }
      } catch (e) {
        console.warn(`${entry.name}: motion error`, e.message || e);
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
