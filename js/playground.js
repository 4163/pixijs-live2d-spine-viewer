/* ============================================================
   playground.js — Example: render all Spine models side-by-side
   ============================================================
   This file demonstrates how a developer can use the raw
   Spine 2.x + PixiJS API (the same stack that chibi.js uses)
   to build a custom multi-model scene — without touching the
   core chibi.js viewer logic.

   Dependencies (must already be loaded):
     - pixi.min.js
     - pixi-spine.js (PIXI.spine.SpineRuntime)
     - spine2-skeleton-binary.js (SkeletonBinary)

   Exposes:
     window.initPlaygroundMode(app, models)
     window.destroyPlayground()
   ============================================================ */

(function () {
  'use strict';

  let playgroundSpines = [];
  let duplicateCounts = {};
  let playgroundApp = null;
  let playgroundModels = null;

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

  function updateOriginIcon(originId) {
    const originSpine = playgroundSpines.find(s => s.isOrigin && s.originId === originId);
    if (originSpine && originSpine.duplicateIcon) {
      const count = duplicateCounts[originId] || 0;
      originSpine.duplicateIcon.visible = count > 0;
    }
  }

  function savePlaygroundState() {
    const state = playgroundSpines.map(s => ({
      originId: s.originId,
      isOrigin: s.isOrigin,
      x: s.position.x,
      y: s.position.y,
      isDorm: s.isDorm,
      animName: s.currentAnimName
    }));
    localStorage.setItem('playgroundState', JSON.stringify(state));
  }

  function pickDormMode() {
    return Math.random() > 0.5;
  }

  function getSpineVariantFiles(entry, useDorm) {
    const dorm = !!useDorm;
    const useDormAtlas = dorm && entry.dormAtlas === true;

    return {
      dorm,
      atlasFile: useDormAtlas ? 'atlas_dorm.txt' : 'atlas.txt',
      skelFile: dorm ? 'skeleton_dorm.skel' : 'skeleton.skel',
      imgFile: useDormAtlas ? 'spritemap_dorm.png' : 'spritemap.png'
    };
  }

  // options: { isOrigin, useDorm, animName, randomAnim }
  async function spawnSpineModel(app, entry, x, y, options = {}) {
    const isOrigin = options.isOrigin !== false;
    const useDorm = !!options.useDorm;
    const randomAnim = !!options.randomAnim;
    const animName = options.animName || null;

    const dir = entry.dir;
    const { dorm, atlasFile, skelFile, imgFile } = getSpineVariantFiles(entry, useDorm);

    let atlasText, skelBuffer, img;
    try {
      [atlasText, skelBuffer, img] = await Promise.all([
        fetch(`${dir}/${atlasFile}`).then(r => { if (!r.ok) throw new Error('atlas not found'); return r.text(); }),
        fetch(`${dir}/${skelFile}`).then(r => { if (!r.ok) throw new Error('skel not found'); return r.arrayBuffer(); }),
        new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = `${dir}/${imgFile}`;
        })
      ]);
    } catch (e) {
      console.warn(`[Playground] ${entry.name}: failed to load -`, e.message || e);
      return null;
    }

    let skeletonJson, atlas, skeletonData, spine;
    try {
      const skelBin = new SkeletonBinary();
      skelBin.data = new Uint8Array(skelBuffer);
      skelBin.initJson();
      skeletonJson = stripDel(skelBin.json);

      const baseTex = new PIXI.BaseTexture(img);
      atlas = await new Promise(resolve => {
        new PIXI.spine.SpineRuntime.Atlas(
          atlasText.replace(/^\u007f/gm, ''),
          (_line, cb) => cb(baseTex),
          resolve
        );
      });

      if (skeletonJson.events && skeletonJson.animations) {
        for (const aName in skeletonJson.animations) {
          const evts = skeletonJson.animations[aName].events;
          if (evts) {
            for (const evt of evts) {
              if (evt.name && !skeletonJson.events[evt.name])
                skeletonJson.events[evt.name] = {};
            }
          }
        }
      }

      const atlasParser = new PIXI.spine.SpineRuntime.AtlasAttachmentParser(atlas);
      const jsonParser  = new PIXI.spine.SpineRuntime.SkeletonJsonParser(atlasParser);
      skeletonData = jsonParser.readSkeletonData(skeletonJson, dir.split('/').pop());

      const vc = window.VIEWER_CONFIG || {};
      const entryCfg = (vc.layout && vc.layout[entry.id]) || {};
      const scale = entryCfg.scale || 1.0;

      spine = new PIXI.spine.Spine(skeletonData);
      spine.scale.set(scale);
      spine.position.set(x, y);
      spine.eventMode = 'static';
      spine.interactive = true;
      spine.cursor = 'pointer';
      app.stage.addChild(spine);

      spine.isOrigin = isOrigin;
      spine.originId = entry.id;
      spine.isDorm = dorm;
      spine.lastRightClickTime = 0;

      if (isOrigin) {
        if (duplicateCounts[entry.id] === undefined) duplicateCounts[entry.id] = 0;
        
        const icon = new PIXI.Text('✨', new PIXI.TextStyle({
          fontSize: 16, fill: '#ffffff', dropShadow: true,
          dropShadowColor: '#000000', dropShadowBlur: 2, dropShadowDistance: 1, padding: 10
        }));
        icon.anchor.set(0.5, 0.5);
        const bounds = spine.getLocalBounds();
        let iconX = bounds.x + bounds.width;
        let iconY = bounds.y;
        
        // Specifically pull the icon left for Queen in Radiance (large bounding box)
        if (entry.id === 'spine_queen_in_radiance') {
          iconX -= 45;
        }
        
        icon.position.set(iconX, iconY);
        icon.visible = duplicateCounts[entry.id] > 0;
        spine.addChild(icon);
        spine.duplicateIcon = icon;
      }

      const anims = skeletonData.animations;
      let animIndex = 0;

      if (animName && anims.some(a => a.name === animName)) {
        animIndex = anims.findIndex(a => a.name === animName);
        spine.currentAnimName = animName;
        spine.state.setAnimationByName(0, animName, true);
      } else if (randomAnim && anims.length > 0) {
        animIndex = Math.floor(Math.random() * anims.length);
        spine.currentAnimName = anims[animIndex].name;
        spine.state.setAnimationByName(0, spine.currentAnimName, true);
      } else {
        const defaultAnim = anims.find(a => a.name === 'wait') || anims[0];
        if (defaultAnim) {
          animIndex = anims.indexOf(defaultAnim);
          spine.currentAnimName = defaultAnim.name;
          spine.state.setAnimationByName(0, defaultAnim.name, true);
        }
      }

      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let offset = { x: 0, y: 0 };

      spine.onMove = (e) => {
        if (!dragging) return;
        const newPosition = e.data.getLocalPosition(spine.parent);
        spine.position.x = newPosition.x + offset.x;
        spine.position.y = newPosition.y + offset.y;
      };

      const doCycleAnimation = () => {
        if (anims.length >= 2) {
          animIndex = (animIndex + 1) % anims.length;
          spine.state.clearTracks();
          spine.skeleton.setToSetupPose();
          spine.currentAnimName = anims[animIndex].name;
          spine.state.setAnimationByName(0, spine.currentAnimName, true);
          savePlaygroundState();
        }
      };

      spine.onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        window.__playgroundDragging = false;

        const newPosition = e.data.getLocalPosition(spine.parent);
        const dx = newPosition.x - dragStartX;
        const dy = newPosition.y - dragStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          if (e.data.pointerType === 'touch') {
            spine.wasTap = true;
          } else {
            doCycleAnimation();
          }
        } else {
          spine.wasTap = false;
          savePlaygroundState();
        }
      };

      const doDelete = () => {
        if (spine.isOrigin) return;
        if (spine.onMove) app.stage.off('pointermove', spine.onMove);
        if (spine.onUp) {
          app.stage.off('pointerup', spine.onUp);
          app.stage.off('pointerupoutside', spine.onUp);
        }
        spine.autoUpdate = false;
        if (spine.state) spine.state.clearTracks();
        if (spine.parent) spine.parent.removeChild(spine);
        spine.removeAllListeners();
        
        const idx = playgroundSpines.indexOf(spine);
        if (idx > -1) playgroundSpines.splice(idx, 1);
        
        duplicateCounts[spine.originId] = Math.max(0, duplicateCounts[spine.originId] - 1);
        updateOriginIcon(spine.originId);
        savePlaygroundState();

        const toDestroy = spine;
        requestAnimationFrame(() => {
          try { toDestroy.destroy({ children: true, texture: false }); } catch (_) {}
        });
      };

      const doDuplicate = () => {
        duplicateCounts[spine.originId]++;
        const offX = (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 60);
        const offY = (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 60);
        const dupUseDorm = pickDormMode();
        
        spawnSpineModel(app, entry, spine.x + offX, spine.y + offY, { isOrigin: false, useDorm: dupUseDorm, randomAnim: true }).then(dupSpine => {
          if (dupSpine) {
            playgroundSpines.push(dupSpine);
            app.stage.addChild(dupSpine);
            updateOriginIcon(spine.originId);
            savePlaygroundState();
          }
        });
      };

      spine.on('pointerdown', (e) => {
        if (e.data.originalEvent) {
          e.data.originalEvent.stopImmediatePropagation();
        }
        // Allow primary mouse button OR any touch/pen interaction
        if (e.data.button !== 0 && e.data.pointerType === 'mouse') return; 

        if (e.data.pointerType === 'touch') {
          const now = Date.now();
          if (!spine.lastTapTime || (now - spine.lastTapTime) > 300) {
            spine.tapCount = 1;
            spine.wasTap = false; // Reset tap distance flag
            spine.tapTimeout = setTimeout(() => {
              if (spine.tapCount === 1 && spine.wasTap) {
                doCycleAnimation();
                spine.tapCount = 0;
              }
            }, 300);
          } else {
            spine.tapCount++;
          }
          spine.lastTapTime = now;

          if (spine.tapCount === 3) {
            if (spine.tapTimeout) clearTimeout(spine.tapTimeout);
            doDelete();
            spine.tapCount = 0;
            return;
          } else if (spine.tapCount === 2) {
            if (spine.tapTimeout) clearTimeout(spine.tapTimeout);
            spine.tapTimeout = setTimeout(() => {
              if (spine.tapCount === 2) {
                doDuplicate();
                spine.tapCount = 0;
              }
            }, 300);
            return; // Prevent drag starting on the second tap
          }
        }
        
        dragging = true;
        window.__playgroundDragging = true;
        const newPosition = e.data.getLocalPosition(spine.parent);
        dragStartX = newPosition.x;
        dragStartY = newPosition.y;
        
        offset.x = spine.x - newPosition.x;
        offset.y = spine.y - newPosition.y;
      });

      app.stage.on('pointermove', spine.onMove);
      app.stage.on('pointerup', spine.onUp);
      app.stage.on('pointerupoutside', spine.onUp);

      spine.on('rightdown', (e) => {
        if (e.data.originalEvent) {
          e.data.originalEvent.stopImmediatePropagation();
        }
        const now = Date.now();
        const diff = now - spine.lastRightClickTime;
        spine.lastRightClickTime = now;

        if (diff < 300) {
          if (spine.singleClickTimeout) {
            clearTimeout(spine.singleClickTimeout);
            spine.singleClickTimeout = null;
          }
          doDelete();
        } else {
          if (spine.singleClickTimeout) clearTimeout(spine.singleClickTimeout);
          spine.singleClickTimeout = setTimeout(() => {
            doDuplicate();
          }, 300);
        }
      });

      return spine;
    } catch (e) {
      console.warn(`[Playground] ${entry.name}: parse error -`, e.message || e);
      return null;
    }
  }

  function destroyPlayground() {
    const stage = window.__sharedApp ? window.__sharedApp.stage : null;
    for (const s of playgroundSpines) {
      try {
        if (stage) {
          if (s.onMove) stage.off('pointermove', s.onMove);
          if (s.onUp) {
            stage.off('pointerup', s.onUp);
            stage.off('pointerupoutside', s.onUp);
          }
        }
        s.autoUpdate = false;
        if (s.state) s.state.clearTracks();
        if (s.parent) s.parent.removeChild(s);
        if (s.singleClickTimeout) clearTimeout(s.singleClickTimeout);
        s.removeAllListeners();
        const toDestroy = s;
        requestAnimationFrame(() => {
          try { toDestroy.destroy({ children: true, texture: false }); } catch (_) {}
        });
      } catch (_) {}
    }
    playgroundSpines = [];
    duplicateCounts = {};
  }

  function resetPlayground() {
    if (playgroundApp && playgroundModels) {
      localStorage.removeItem('playgroundState');
      initPlaygroundMode(playgroundApp, playgroundModels);
    }
  }

  async function initPlaygroundMode(app, models) {
    if (!window.__playgroundWheelBlocker) {
      window.__playgroundWheelBlocker = true;
      window.addEventListener('wheel', e => {
        if (e.target === app.view && app.view.style.cursor === 'pointer') {
           e.stopPropagation();
        }
      }, { capture: true });
    }

    destroyPlayground();
    playgroundApp = app;
    playgroundModels = models;

    if (!models || models.length === 0) {
      if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange)
        window.__viewerCallbacks.onStateChange({ type: 'playground-empty' });
      return;
    }

    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange)
      window.__viewerCallbacks.onStateChange({ type: 'playground-loading' });

    const savedStateStr = localStorage.getItem('playgroundState');
    let savedState = null;
    try { if (savedStateStr) savedState = JSON.parse(savedStateStr); } catch (_) {}

    if (savedState && savedState.length > 0) {
      const results = await Promise.all(
        savedState.map(s => {
          const entry = models.find(m => m.id === s.originId);
          if (!entry) return null;
          return spawnSpineModel(app, entry, s.x, s.y, {
            isOrigin: s.isOrigin,
            useDorm: s.isDorm,
            animName: s.animName
          });
        })
      );
      playgroundSpines = results.filter(Boolean);
    } else {
      // Random generation (rejection sampling for better scatter)
      const w = app.screen.width;
      const h = app.screen.height;
      // Use dynamic margins (20% of screen size) to ensure chibis stay well within the viewable area
      const marginX = w * 0.20;
      const marginY = h * 0.20;
      
      const pts = [];
      const shuffledModels = [...models].sort(() => Math.random() - 0.5);

      const results = await Promise.all(
        shuffledModels.map((entry) => {
          let cx = w/2, cy = h/2, attempts = 0;
          do {
            cx = marginX + Math.random() * (w - marginX * 2);
            cy = marginY + Math.random() * (h - marginY * 2);
            attempts++;
            let tooClose = pts.some(p => Math.hypot(p.x - cx, p.y - cy) < 180);
            if (!tooClose || attempts > 50) {
              pts.push({x: cx, y: cy});
              break;
            }
          } while (true);

          const useDorm = pickDormMode();
          return spawnSpineModel(app, entry, cx, cy, { isOrigin: true, useDorm, randomAnim: true });
        })
      );
      playgroundSpines = results.filter(Boolean);
      savePlaygroundState();
    }

    if (window.__viewerCallbacks && window.__viewerCallbacks.onStateChange) {
      window.__viewerCallbacks.onStateChange({ type: 'playground-ready' });
    }
  }

  window.initPlaygroundMode = initPlaygroundMode;
  window.destroyPlayground  = destroyPlayground;
  window.resetPlayground    = resetPlayground;

})();
